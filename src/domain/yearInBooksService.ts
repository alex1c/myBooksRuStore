/**
 * Year in Books aggregate (Phase 8).
 *
 * Presentation layer over Phase 6–7 statistics — no competing SQL semantics.
 */

import type { BookFormat } from '@/constants/domain'
import { formatLabels } from '@/constants/labels'
import { SqlExecutor } from '@/db/sqlExecutor'
import {
	getActivityForRange,
	getBestStreakInYear,
	type ActivityIntensity,
	type DayActivity,
} from '@/domain/activityService'
import {
	getCompletedBooksSeries,
	getFormatStats,
	getNoteStats,
	getRatingStats,
	getReadingSeries,
	getSessionStats,
	getSummary,
	getTopAuthors,
	getTopBooks,
	type FormatStats,
	type NoteStats,
	type RatingStats,
	type SessionStats,
	type SeriesPoint,
	type TopBookStat,
} from '@/domain/statisticsService'
import {
	compareDayKeys,
	isoRangeCoveringLocalDays,
	toLocalDayKey,
} from '@/utils/period'
import { resolveStatsPeriod } from '@/utils/statsPeriod'

/** Distinguishes missing observations from a true numeric zero. */
export interface MetricPresence {
	/** True when at least one observation exists for this metric. */
	hasObservations: boolean
	/** Net / aggregate value (0 when no observations). */
	value: number
}

export interface YearTopBook extends TopBookStat {
	coverUri: string | null
	/** Pages contributed in the year when ranking by pages (fallback). */
	pagesInYear?: number
	rankBy: 'time' | 'pages'
}

export interface BestMonthInsight {
	monthIndex: number
	/** Russian month name in nominative, e.g. «Август». */
	label: string
	seconds: number
	pages: number
	booksExact: number
	/** Primary ranking basis used for this insight. */
	criterion: 'time' | 'pages'
}

export interface FavoriteBookInsight {
	title: string
	authorText: string
	rating: number
	coverUri: string | null
	finishedOn: string | null
}

export interface LongestBookInsight {
	title: string
	authorText: string
	pageCount: number
	coverUri: string | null
}

export interface QuoteSample {
	text: string
	createdAt: string
	bookTitle: string
}

export interface YearActivityDay {
	dayKey: string
	intensity: ActivityIntensity
	active: boolean
}

export interface YearInBooks {
	year: number
	/** Any meaningful reading signal for the year. */
	hasData: boolean
	completedBooks: number
	yearPrecisionBooks: number
	exactMonthlyBooks: number
	pages: MetricPresence
	readingTime: MetricPresence
	activeDays: number
	bestStreakInYear: number
	sessions: SessionStats
	averages: {
		secondsPerActiveDay: number | null
		pagesPerActiveDay: number | null
	}
	bestMonthByTime: BestMonthInsight | null
	bestMonthByPages: BestMonthInsight | null
	monthlySeries: SeriesPoint[]
	monthlyBooks: { monthIndex: number; label: string; count: number }[]
	topBooks: YearTopBook[]
	topAuthor: { authorText: string; bookCount: number } | null
	formats: FormatStats
	favoriteFormat: { format: BookFormat; label: string; count: number } | null
	ratings: RatingStats
	favoriteBook: FavoriteBookInsight | null
	longestBook: LongestBookInsight | null
	notes: NoteStats
	quoteSample: QuoteSample | null
	activityDays: YearActivityDay[]
}

const MONTH_NAMES_RU = [
	'Январь',
	'Февраль',
	'Март',
	'Апрель',
	'Май',
	'Июнь',
	'Июль',
	'Август',
	'Сентябрь',
	'Октябрь',
	'Ноябрь',
	'Декабрь',
] as const

const FORMAT_PLURAL: Record<BookFormat, string> = {
	PAPER: 'Бумажные',
	EBOOK: 'Электронные',
	AUDIOBOOK: 'Аудио',
}

function yearAnchor (year: number): Date {
	return new Date(year, 5, 15, 12, 0, 0)
}

/**
 * Years the user may browse: earliest signal year … current calendar year.
 * Never allows a future year beyond `now`.
 */
export async function getYearInBooksBounds (
	db: SqlExecutor,
	now: Date = new Date(),
): Promise<{ minYear: number; maxYear: number }> {
	const maxYear = now.getFullYear()
	const rows = await db.getAllAsync<{ y: number | null }>(
		`SELECT MIN(y) AS y FROM (
			SELECT CAST(substr(finished_on, 1, 4) AS INTEGER) AS y
				FROM library_entries
				WHERE status = 'FINISHED' AND finished_date_precision = 'EXACT'
					AND finished_on IS NOT NULL
			UNION ALL
			SELECT finished_year AS y FROM library_entries
				WHERE status = 'FINISHED' AND finished_date_precision = 'YEAR'
					AND finished_year IS NOT NULL
			UNION ALL
			SELECT CAST(substr(started_at, 1, 4) AS INTEGER) AS y
				FROM reading_sessions WHERE ended_at IS NOT NULL
			UNION ALL
			SELECT CAST(substr(created_at, 1, 4) AS INTEGER) AS y
				FROM reading_progress_events
		)`,
	)
	const raw = rows[0]?.y
	const minYear =
		raw != null && Number.isFinite(raw) && raw >= 1970
			? Math.min(raw, maxYear)
			: maxYear
	return { minYear, maxYear }
}

async function metricPagePresence (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
	value: number,
): Promise<MetricPresence> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const row = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM reading_progress_events
		 WHERE created_at >= ? AND created_at <= ?
			 AND type IN ('QUICK_UPDATE', 'MANUAL_UPDATE', 'SESSION_END', 'UNDO', 'FINISH_BOOK')
			 AND (previous_page IS NOT NULL OR new_page IS NOT NULL)`,
		[fromIso, toIso],
	)
	// Local-day filter is applied in getPageDeltaInRange; observation count
	// uses the same ISO slack window (may include edge days — acceptable).
	const hasObservations = (row?.c ?? 0) > 0
	return { hasObservations, value: hasObservations ? value : 0 }
}

async function metricTimePresence (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
	value: number,
): Promise<MetricPresence> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const sessions = await db.getAllAsync<{ started_at: string }>(
		`SELECT started_at FROM reading_sessions
		 WHERE ended_at IS NOT NULL
			 AND duration_seconds IS NOT NULL
			 AND duration_seconds > 0
			 AND started_at >= ? AND started_at <= ?`,
		[fromIso, toIso],
	)
	let hasObservations = false
	for (const s of sessions) {
		const day = toLocalDayKey(s.started_at)
		if (
			compareDayKeys(day, startKey) >= 0 &&
			compareDayKeys(day, endKey) <= 0
		) {
			hasObservations = true
			break
		}
	}
	return { hasObservations, value: hasObservations ? value : 0 }
}

/**
 * Pick best month. Tie-break: earlier month wins (deterministic).
 */
export function pickBestMonth (
	months: {
		monthIndex: number
		seconds: number
		pages: number
		booksExact: number
	}[],
	criterion: 'time' | 'pages',
): BestMonthInsight | null {
	if (months.length === 0) {
		return null
	}
	let best = months[0]!
	for (let i = 1; i < months.length; i += 1) {
		const m = months[i]!
		const better =
			criterion === 'time'
				? m.seconds > best.seconds ||
					(m.seconds === best.seconds && m.monthIndex < best.monthIndex)
				: m.pages > best.pages ||
					(m.pages === best.pages && m.monthIndex < best.monthIndex)
		if (better) {
			best = m
		}
	}
	const score = criterion === 'time' ? best.seconds : best.pages
	if (score <= 0) {
		return null
	}
	return {
		monthIndex: best.monthIndex,
		label: MONTH_NAMES_RU[best.monthIndex],
		seconds: best.seconds,
		pages: best.pages,
		booksExact: best.booksExact,
		criterion,
	}
}

function favoriteFormatFrom (
	formats: FormatStats,
): { format: BookFormat; label: string; count: number } | null {
	const entries: { format: BookFormat; count: number }[] = [
		{ format: 'PAPER', count: formats.PAPER },
		{ format: 'EBOOK', count: formats.EBOOK },
		{ format: 'AUDIOBOOK', count: formats.AUDIOBOOK },
	]
	entries.sort(
		(a, b) =>
			b.count - a.count ||
			a.format.localeCompare(b.format),
	)
	const top = entries[0]
	if (!top || top.count <= 0) {
		return null
	}
	return {
		format: top.format,
		label: FORMAT_PLURAL[top.format] ?? formatLabels[top.format],
		count: top.count,
	}
}

async function loadFavoriteBook (
	db: SqlExecutor,
	year: number,
	startKey: string,
	endKey: string,
): Promise<FavoriteBookInsight | null> {
	const rows = await db.getAllAsync<{
		title: string
		author_text: string
		rating: number
		cover_uri: string | null
		finished_on: string | null
	}>(
		`SELECT b.title, b.author_text, e.rating, b.cover_uri, e.finished_on
		 FROM library_entries e
		 JOIN books b ON b.id = e.book_id
		 WHERE e.archived_at IS NULL
			 AND e.status = 'FINISHED'
			 AND e.rating IS NOT NULL
			 AND (
				(e.finished_date_precision = 'EXACT'
					AND e.finished_on >= ? AND e.finished_on <= ?)
				OR (e.finished_date_precision = 'YEAR' AND e.finished_year = ?)
			)
		 ORDER BY e.rating DESC,
			CASE WHEN e.finished_on IS NULL THEN 1 ELSE 0 END,
			e.finished_on ASC,
			b.title ASC
		 LIMIT 1`,
		[startKey, endKey, year],
	)
	const row = rows[0]
	if (!row) {
		return null
	}
	return {
		title: row.title,
		authorText: row.author_text,
		rating: row.rating,
		coverUri: row.cover_uri,
		finishedOn: row.finished_on,
	}
}

async function loadLongestBook (
	db: SqlExecutor,
	year: number,
	startKey: string,
	endKey: string,
): Promise<LongestBookInsight | null> {
	const rows = await db.getAllAsync<{
		title: string
		author_text: string
		page_count: number
		cover_uri: string | null
	}>(
		`SELECT b.title, b.author_text, b.page_count, b.cover_uri
		 FROM library_entries e
		 JOIN books b ON b.id = e.book_id
		 WHERE e.archived_at IS NULL
			 AND e.status = 'FINISHED'
			 AND b.page_count IS NOT NULL
			 AND b.page_count > 0
			 AND (
				(e.finished_date_precision = 'EXACT'
					AND e.finished_on >= ? AND e.finished_on <= ?)
				OR (e.finished_date_precision = 'YEAR' AND e.finished_year = ?)
			)
		 ORDER BY b.page_count DESC, b.title ASC
		 LIMIT 1`,
		[startKey, endKey, year],
	)
	const row = rows[0]
	if (!row) {
		return null
	}
	return {
		title: row.title,
		authorText: row.author_text,
		pageCount: row.page_count,
		coverUri: row.cover_uri,
	}
}

async function loadQuoteSample (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
): Promise<QuoteSample | null> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const rows = await db.getAllAsync<{
		text: string
		created_at: string
		title: string
	}>(
		`SELECT n.text, n.created_at, b.title
		 FROM reading_notes n
		 JOIN library_entries e ON e.id = n.library_entry_id
		 JOIN books b ON b.id = e.book_id
		 WHERE n.type = 'QUOTE'
			 AND n.created_at >= ? AND n.created_at <= ?
		 ORDER BY n.created_at ASC, n.id ASC`,
		[fromIso, toIso],
	)
	for (const row of rows) {
		const day = toLocalDayKey(row.created_at)
		if (
			compareDayKeys(day, startKey) >= 0 &&
			compareDayKeys(day, endKey) <= 0
		) {
			return {
				text: row.text,
				createdAt: row.created_at,
				bookTitle: row.title,
			}
		}
	}
	return null
}

async function enrichTopBooksWithCovers (
	db: SqlExecutor,
	books: TopBookStat[],
	rankBy: 'time' | 'pages',
): Promise<YearTopBook[]> {
	if (books.length === 0) {
		return []
	}
	const out: YearTopBook[] = []
	for (const book of books) {
		const row = await db.getFirstAsync<{ cover_uri: string | null }>(
			`SELECT b.cover_uri FROM library_entries e
			 JOIN books b ON b.id = e.book_id
			 WHERE e.id = ?`,
			[book.libraryEntryId],
		)
		out.push({
			...book,
			coverUri: row?.cover_uri ?? null,
			rankBy,
		})
	}
	return out
}

/**
 * Fallback top books by net page progress when no session time exists.
 */
async function topBooksByPages (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
	limit = 3,
): Promise<YearTopBook[]> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const events = await db.getAllAsync<{
		library_entry_id: string
		previous_page: number | null
		new_page: number | null
		created_at: string
		title: string
		author_text: string
		cover_uri: string | null
	}>(
		`SELECT e.library_entry_id, e.previous_page, e.new_page, e.created_at,
						b.title, b.author_text, b.cover_uri
		 FROM reading_progress_events e
		 JOIN library_entries le ON le.id = e.library_entry_id
		 JOIN books b ON b.id = le.book_id
		 WHERE e.created_at >= ? AND e.created_at <= ?
			 AND e.type IN ('QUICK_UPDATE', 'MANUAL_UPDATE', 'SESSION_END', 'UNDO', 'FINISH_BOOK')
			 AND (e.previous_page IS NOT NULL OR e.new_page IS NOT NULL)`,
		[fromIso, toIso],
	)
	const byEntry = new Map<
		string,
		{
			title: string
			authorText: string
			coverUri: string | null
			pages: number
		}
	>()
	for (const row of events) {
		const day = toLocalDayKey(row.created_at)
		if (
			compareDayKeys(day, startKey) < 0 ||
			compareDayKeys(day, endKey) > 0
		) {
			continue
		}
		const delta = (row.new_page ?? 0) - (row.previous_page ?? 0)
		const cur = byEntry.get(row.library_entry_id) ?? {
			title: row.title,
			authorText: row.author_text,
			coverUri: row.cover_uri,
			pages: 0,
		}
		cur.pages += delta
		byEntry.set(row.library_entry_id, cur)
	}
	return [...byEntry.entries()]
		.map(([libraryEntryId, v]) => ({
			libraryEntryId,
			title: v.title,
			authorText: v.authorText,
			durationSeconds: 0,
			coverUri: v.coverUri,
			pagesInYear: Math.max(0, v.pages),
			rankBy: 'pages' as const,
		}))
		.filter((b) => (b.pagesInYear ?? 0) > 0)
		.sort(
			(a, b) =>
				(b.pagesInYear ?? 0) - (a.pagesInYear ?? 0) ||
				a.title.localeCompare(b.title) ||
				a.libraryEntryId.localeCompare(b.libraryEntryId),
		)
		.slice(0, limit)
}

/**
 * Full Year in Books model for one calendar year.
 * Computed once per year selection — UI should memoize the result.
 */
export async function getYearInBooks (
	db: SqlExecutor,
	year: number,
): Promise<YearInBooks> {
	const period = resolveStatsPeriod('YEAR', yearAnchor(year), year)
	const { startKey, endKey } = period

	const [
		summary,
		seriesPack,
		monthlyBooksSeries,
		formats,
		ratings,
		sessions,
		notes,
		topAuthors,
		bestStreakInYear,
		activityMap,
		favoriteBook,
		longestBook,
		quoteSample,
	] = await Promise.all([
		getSummary(db, period),
		getReadingSeries(db, period),
		getCompletedBooksSeries(db, period),
		getFormatStats(db, period),
		getRatingStats(db, period),
		getSessionStats(db, period),
		getNoteStats(db, period),
		getTopAuthors(db, period, 1),
		getBestStreakInYear(db, year),
		getActivityForRange(db, startKey, endKey, { fillEmptyDays: false }),
		loadFavoriteBook(db, year, startKey, endKey),
		loadLongestBook(db, year, startKey, endKey),
		loadQuoteSample(db, startKey, endKey),
	])

	const [pages, readingTime] = await Promise.all([
		metricPagePresence(db, startKey, endKey, summary.pagesRead),
		metricTimePresence(db, startKey, endKey, summary.readingSeconds),
	])

	const monthBuckets = seriesPack.series.map((p, monthIndex) => ({
		monthIndex,
		seconds: p.seconds,
		pages: p.pages,
		booksExact: monthlyBooksSeries?.months[monthIndex]?.count ?? 0,
	}))

	const bestMonthByTime = pickBestMonth(monthBuckets, 'time')
	const bestMonthByPages = pickBestMonth(monthBuckets, 'pages')

	// Prefer time ranking for top books; fallback to pages when no sessions.
	let topBooks: YearTopBook[]
	if (readingTime.hasObservations && readingTime.value > 0) {
		const timed = await getTopBooks(db, period, 3)
		topBooks = await enrichTopBooksWithCovers(db, timed, 'time')
	} else {
		topBooks = await topBooksByPages(db, startKey, endKey, 3)
	}

	const activityDays: YearActivityDay[] = [...activityMap.values()]
		.filter((d: DayActivity) => d.active)
		.map((d) => ({
			dayKey: d.dayKey,
			intensity: d.intensity,
			active: d.active,
		}))
		.sort((a, b) => compareDayKeys(a.dayKey, b.dayKey))

	const noteTotal = notes.QUOTE + notes.THOUGHT + notes.NOTE
	const hasData =
		summary.booksFinished > 0 ||
		pages.hasObservations ||
		readingTime.hasObservations ||
		summary.readingDays > 0 ||
		noteTotal > 0

	const averages = {
		secondsPerActiveDay:
			summary.readingDays > 0 &&
			readingTime.hasObservations &&
			readingTime.value > 0
				? Math.round(readingTime.value / summary.readingDays)
				: null,
		pagesPerActiveDay:
			summary.readingDays > 0 && pages.hasObservations && pages.value > 0
				? Math.round(pages.value / summary.readingDays)
				: null,
	}

	return {
		year,
		hasData,
		completedBooks: summary.booksFinished,
		yearPrecisionBooks: summary.yearPrecisionBooks,
		exactMonthlyBooks: monthlyBooksSeries?.exactInMonths ?? 0,
		pages,
		readingTime,
		activeDays: summary.readingDays,
		bestStreakInYear,
		sessions,
		averages,
		bestMonthByTime,
		bestMonthByPages,
		monthlySeries: seriesPack.series,
		monthlyBooks: monthlyBooksSeries?.months ?? [],
		topBooks,
		topAuthor: topAuthors[0] ?? null,
		formats,
		favoriteFormat: favoriteFormatFrom(formats),
		ratings,
		favoriteBook,
		longestBook,
		notes,
		quoteSample,
		activityDays,
	}
}

/**
 * Build a safe share-card presentation model (no private notes / IDs).
 */
export interface YearShareCardModel {
	title: string
	brand: string
	lines: { label: string; value: string }[]
	/** Plain-text fallback for system share when image capture fails. */
	textFallback: string
}

export function buildYearShareCardModel (
	year: YearInBooks,
	formatters: {
		books: (n: number) => string
		pages: (n: number) => string
		hours: (seconds: number) => string
		days: (n: number) => string
		streak: (n: number) => string
	},
): YearShareCardModel {
	const lines: { label: string; value: string }[] = []
	if (year.completedBooks > 0) {
		lines.push({
			label: 'Книги',
			value: formatters.books(year.completedBooks),
		})
	}
	if (year.pages.hasObservations && year.pages.value > 0) {
		lines.push({
			label: 'Страницы',
			value: formatters.pages(year.pages.value),
		})
	}
	if (year.readingTime.hasObservations && year.readingTime.value > 0) {
		lines.push({
			label: 'Время',
			value: formatters.hours(year.readingTime.value),
		})
	}
	if (year.activeDays > 0) {
		lines.push({
			label: 'Дни чтения',
			value: formatters.days(year.activeDays),
		})
	}
	if (year.bestStreakInYear > 0) {
		lines.push({
			label: 'Лучшая серия',
			value: formatters.streak(year.bestStreakInYear),
		})
	}

	const title = `Мой ${year.year} год`
	const brand = 'Дневник чтения'
	const textFallback = [
		title,
		...lines.map((l) => `${l.value}`),
		brand,
	].join('\n')

	return { title, brand, lines, textFallback }
}
