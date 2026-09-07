/**
 * Reading statistics aggregation (Phase 7).
 *
 * Reuses activityService page/session/day semantics — UI must not run raw SQL.
 * Books finished respect EXACT / YEAR / UNKNOWN date precision rules.
 */

import type { BookFormat } from '@/constants/domain'
import type { LibraryStatusCounts } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import {
	getActivityForRange,
	getBooksFinishedInRange,
	getPageDeltaInRange,
	getSessionSecondsInRange,
	type DayActivity,
} from '@/domain/activityService'
import { getLibraryStatusCounts } from '@/domain/libraryService'
import { toDateOnlyLocal } from '@/utils/dates'
import {
	addLocalDays,
	compareDayKeys,
	eachLocalDay,
	isoRangeCoveringLocalDays,
	parseLocalDayKey,
	startOfWeekMonday,
	toLocalDayKey,
} from '@/utils/period'
import {
	resolveStatsPeriod,
	type StatsPeriodKind,
	type StatsPeriodRange,
} from '@/utils/statsPeriod'

export type SeriesGranularity = 'day' | 'week' | 'month' | 'year'
export type SeriesMetric = 'time' | 'pages'

export interface StatsSummary {
	booksFinished: number
	pagesRead: number
	readingSeconds: number
	readingDays: number
	/** Net positive percent progress (ebooks); secondary insight only. */
	percentProgress: number
	/** YEAR-precision books included in annual / ALL totals. */
	yearPrecisionBooks: number
	/** UNKNOWN-precision books (ALL only). */
	unknownPrecisionBooks: number
}

export interface SeriesPoint {
	key: string
	label: string
	pages: number
	seconds: number
	active: boolean
}

export interface MonthlyBooksBucket {
	/** 0–11 */
	monthIndex: number
	label: string
	count: number
}

export interface CompletedBooksSeries {
	months: MonthlyBooksBucket[]
	/** Sum of monthly EXACT buckets. */
	exactInMonths: number
	/** YEAR precision for the selected year (not in monthly bars). */
	yearPrecisionOnly: number
	/** UNKNOWN count when period is ALL. */
	unknownPrecision: number
	/** Annual / ALL headline total (exact + year [+ unknown for ALL]). */
	headlineTotal: number
}

export interface FormatStats {
	PAPER: number
	EBOOK: number
	AUDIOBOOK: number
}

export interface RatingStats {
	average: number | null
	ratedCount: number
	finishedCount: number
}

export interface SessionStats {
	count: number
	averageSeconds: number | null
	maxSeconds: number | null
}

export interface NoteStats {
	QUOTE: number
	THOUGHT: number
	NOTE: number
}

export interface TopBookStat {
	libraryEntryId: string
	title: string
	authorText: string
	durationSeconds: number
}

export interface AuthorStat {
	authorText: string
	bookCount: number
}

export interface MostActiveDay {
	dayKey: string
	seconds: number
}

export interface StatsAverages {
	secondsPerActiveDay: number | null
	pagesPerActiveDay: number | null
}

export interface StatsDashboard {
	period: StatsPeriodRange
	summary: StatsSummary
	series: SeriesPoint[]
	granularity: SeriesGranularity
	monthlyBooks: CompletedBooksSeries | null
	formats: FormatStats
	ratings: RatingStats
	sessions: SessionStats
	notes: NoteStats
	topBooks: TopBookStat[]
	topAuthors: AuthorStat[]
	mostActiveDay: MostActiveDay | null
	averages: StatsAverages
	libraryNow: LibraryStatusCounts
	/** True when user has any sessions, progress events, or finished books. */
	hasReadingSignal: boolean
	/** Pages per active day over last 30 days (pace insight). */
	pacePagesPerActiveDay30: number | null
}

const MONTH_LABELS_RU = [
	'янв',
	'фев',
	'мар',
	'апр',
	'май',
	'июн',
	'июл',
	'авг',
	'сен',
	'окт',
	'ноя',
	'дек',
] as const

function dayLabelShort (dayKey: string): string {
	const d = parseLocalDayKey(dayKey)
	return `${d.getDate()} ${MONTH_LABELS_RU[d.getMonth()]}`
}

function weekLabel (weekStart: string): string {
	const end = addLocalDays(weekStart, 6)
	return `${dayLabelShort(weekStart)}–${dayLabelShort(end)}`
}

function monthLabel (year: number, monthIndex: number): string {
	return `${MONTH_LABELS_RU[monthIndex]} ${year}`
}

/**
 * Net positive percent progress in range (same event types as pages).
 * Not mixed into the primary "pages" metric.
 */
export async function getPercentDeltaInRange (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
): Promise<number> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const events = await db.getAllAsync<{
		previous_percent: number | null
		new_percent: number | null
		created_at: string
	}>(
		`SELECT previous_percent, new_percent, created_at
		 FROM reading_progress_events
		 WHERE created_at >= ? AND created_at <= ?
			AND type IN ('QUICK_UPDATE', 'MANUAL_UPDATE', 'SESSION_END', 'UNDO', 'FINISH_BOOK')`,
		[fromIso, toIso],
	)
	let sum = 0
	for (const row of events) {
		const dayKey = toLocalDayKey(row.created_at)
		if (
			compareDayKeys(dayKey, startKey) < 0 ||
			compareDayKeys(dayKey, endKey) > 0
		) {
			continue
		}
		if (row.new_percent == null && row.previous_percent == null) {
			continue
		}
		sum += (row.new_percent ?? 0) - (row.previous_percent ?? 0)
	}
	return Math.max(0, sum)
}

async function countFinishedYearPrecision (
	db: SqlExecutor,
	year: number,
): Promise<number> {
	const row = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM library_entries
		 WHERE archived_at IS NULL
			 AND status = 'FINISHED'
			 AND finished_date_precision = 'YEAR'
			 AND finished_year = ?`,
		[year],
	)
	return row?.count ?? 0
}

async function countAllFinished (db: SqlExecutor): Promise<{
	total: number
	yearPrecision: number
	unknown: number
}> {
	const rows = await db.getAllAsync<{
		precision: string | null
		count: number
	}>(
		`SELECT finished_date_precision AS precision, COUNT(*) AS count
		 FROM library_entries
		 WHERE archived_at IS NULL AND status = 'FINISHED'
		 GROUP BY finished_date_precision`,
	)
	let exact = 0
	let yearPrecision = 0
	let unknown = 0
	for (const row of rows) {
		if (row.precision === 'EXACT') {
			exact = row.count
		} else if (row.precision === 'YEAR') {
			yearPrecision = row.count
		} else if (row.precision === 'UNKNOWN') {
			unknown = row.count
		}
	}
	return {
		total: exact + yearPrecision + unknown,
		yearPrecision,
		unknown,
	}
}

/**
 * Finished books for the selected stats period with precision semantics.
 */
export async function getFinishedBooksSummary (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<{
	total: number
	yearPrecisionBooks: number
	unknownPrecisionBooks: number
}> {
	if (period.kind === 'ALL') {
		const all = await countAllFinished(db)
		return {
			total: all.total,
			yearPrecisionBooks: all.yearPrecision,
			unknownPrecisionBooks: all.unknown,
		}
	}
	if (period.kind === 'YEAR' && period.year != null) {
		const total = await getBooksFinishedInRange(
			db,
			period.startKey,
			period.endKey,
			{ allowYearPrecision: true, year: period.year },
		)
		const yearPrecisionBooks = await countFinishedYearPrecision(
			db,
			period.year,
		)
		return {
			total,
			yearPrecisionBooks,
			unknownPrecisionBooks: 0,
		}
	}
	const total = await getBooksFinishedInRange(
		db,
		period.startKey,
		period.endKey,
		{ allowYearPrecision: false },
	)
	return {
		total,
		yearPrecisionBooks: 0,
		unknownPrecisionBooks: 0,
	}
}

export async function getSummary (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<StatsSummary> {
	const activity = await getActivityForRange(
		db,
		period.startKey,
		period.endKey,
		{ fillEmptyDays: false, includeNotes: false },
	)
	const readingDays = [...activity.values()].filter((d) => d.active).length

	const [pagesRead, readingSeconds, percentProgress, books] =
		await Promise.all([
			getPageDeltaInRange(db, period.startKey, period.endKey),
			getSessionSecondsInRange(db, period.startKey, period.endKey),
			getPercentDeltaInRange(db, period.startKey, period.endKey),
			getFinishedBooksSummary(db, period),
		])

	return {
		booksFinished: books.total,
		pagesRead,
		readingSeconds,
		readingDays,
		percentProgress,
		yearPrecisionBooks: books.yearPrecisionBooks,
		unknownPrecisionBooks: books.unknownPrecisionBooks,
	}
}

function aggregateSeries (
	days: DayActivity[],
	granularity: SeriesGranularity,
	period: StatsPeriodRange,
): SeriesPoint[] {
	if (granularity === 'day') {
		const keys = eachLocalDay(period.startKey, period.endKey)
		const map = new Map(days.map((d) => [d.dayKey, d]))
		return keys.map((key) => {
			const d = map.get(key)
			return {
				key,
				label: dayLabelShort(key),
				pages: d?.pagesRead ?? 0,
				seconds: d?.sessionSeconds ?? 0,
				active: d?.active ?? false,
			}
		})
	}

	if (granularity === 'week') {
		const buckets = new Map<
			string,
			{ pages: number; seconds: number; active: boolean }
		>()
		for (const d of days) {
			const week = startOfWeekMonday(d.dayKey)
			const cur = buckets.get(week) ?? {
				pages: 0,
				seconds: 0,
				active: false,
			}
			cur.pages += d.pagesRead
			cur.seconds += d.sessionSeconds
			cur.active = cur.active || d.active
			buckets.set(week, cur)
		}
		// Ensure weeks covering the period appear even if empty.
		const firstWeek = startOfWeekMonday(period.startKey)
		const lastWeek = startOfWeekMonday(period.endKey)
		let cursor = firstWeek
		const keys: string[] = []
		while (compareDayKeys(cursor, lastWeek) <= 0) {
			keys.push(cursor)
			cursor = addLocalDays(cursor, 7)
			if (keys.length > 40) {
				break
			}
		}
		return keys.map((key) => {
			const b = buckets.get(key)
			return {
				key,
				label: weekLabel(key),
				pages: b?.pages ?? 0,
				seconds: b?.seconds ?? 0,
				active: b?.active ?? false,
			}
		})
	}

	if (granularity === 'month') {
		const year = period.year ?? parseLocalDayKey(period.startKey).getFullYear()
		const buckets = new Map<number, { pages: number; seconds: number; active: boolean }>()
		for (const d of days) {
			const m = parseLocalDayKey(d.dayKey).getMonth()
			const cur = buckets.get(m) ?? {
				pages: 0,
				seconds: 0,
				active: false,
			}
			cur.pages += d.pagesRead
			cur.seconds += d.sessionSeconds
			cur.active = cur.active || d.active
			buckets.set(m, cur)
		}
		return Array.from({ length: 12 }, (_, monthIndex) => {
			const b = buckets.get(monthIndex)
			return {
				key: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
				label: MONTH_LABELS_RU[monthIndex],
				pages: b?.pages ?? 0,
				seconds: b?.seconds ?? 0,
				active: b?.active ?? false,
			}
		})
	}

	// year granularity (ALL)
	const byYear = new Map<
		number,
		{ pages: number; seconds: number; active: boolean }
	>()
	for (const d of days) {
		const y = parseLocalDayKey(d.dayKey).getFullYear()
		const cur = byYear.get(y) ?? {
			pages: 0,
			seconds: 0,
			active: false,
		}
		cur.pages += d.pagesRead
		cur.seconds += d.sessionSeconds
		cur.active = cur.active || d.active
		byYear.set(y, cur)
	}
	const years = [...byYear.keys()].sort((a, b) => a - b)
	// Cap to last 12 years of signal for readability.
	const trimmed = years.slice(-12)
	return trimmed.map((y) => {
		const b = byYear.get(y)!
		return {
			key: String(y),
			label: String(y),
			pages: b.pages,
			seconds: b.seconds,
			active: b.active,
		}
	})
}

export async function getReadingSeries (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<{ series: SeriesPoint[]; granularity: SeriesGranularity }> {
	let granularity: SeriesGranularity = 'day'
	if (period.kind === 'D90') {
		granularity = 'week'
	} else if (period.kind === 'YEAR') {
		granularity = 'month'
	} else if (period.kind === 'ALL') {
		granularity = 'year'
	}

	const map = await getActivityForRange(db, period.startKey, period.endKey, {
		fillEmptyDays: false,
		includeNotes: false,
	})
	const days = [...map.values()]
	return {
		series: aggregateSeries(days, granularity, period),
		granularity,
	}
}

export async function getCompletedBooksSeries (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<CompletedBooksSeries | null> {
	if (period.kind !== 'YEAR' && period.kind !== 'ALL') {
		return null
	}

	const year =
		period.kind === 'YEAR'
			? (period.year ?? new Date().getFullYear())
			: null

	const startKey =
		period.kind === 'YEAR' ? period.startKey : addLocalDays(toDateOnlyLocal(), -365 * 12)
	const endKey = period.endKey

	const exactRows = await db.getAllAsync<{ finished_on: string }>(
		`SELECT finished_on FROM library_entries
		 WHERE archived_at IS NULL
			 AND status = 'FINISHED'
			 AND finished_date_precision = 'EXACT'
			 AND finished_on IS NOT NULL
			 AND finished_on >= ?
			 AND finished_on <= ?`,
		[startKey, endKey],
	)

	if (period.kind === 'YEAR' && year != null) {
		const months: MonthlyBooksBucket[] = Array.from(
			{ length: 12 },
			(_, monthIndex) => ({
				monthIndex,
				label: MONTH_LABELS_RU[monthIndex],
				count: 0,
			}),
		)
		for (const row of exactRows) {
			const d = parseLocalDayKey(row.finished_on)
			if (d.getFullYear() === year) {
				months[d.getMonth()].count += 1
			}
		}
		const exactInMonths = months.reduce((s, m) => s + m.count, 0)
		const yearPrecisionOnly = await countFinishedYearPrecision(db, year)
		return {
			months,
			exactInMonths,
			yearPrecisionOnly,
			unknownPrecision: 0,
			headlineTotal: exactInMonths + yearPrecisionOnly,
		}
	}

	// ALL — last 12 calendar months of EXACT finishes + lifetime UNKNOWN note
	const today = toDateOnlyLocal()
	const monthKeys: string[] = []
	const months: MonthlyBooksBucket[] = []
	{
		const base = parseLocalDayKey(today)
		base.setDate(1)
		for (let i = 11; i >= 0; i -= 1) {
			const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
			monthKeys.push(
				`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
			)
			months.push({
				monthIndex: d.getMonth(),
				label: monthLabel(d.getFullYear(), d.getMonth()),
				count: 0,
			})
		}
	}
	const countByKey = new Map(monthKeys.map((k) => [k, 0]))
	for (const row of exactRows) {
		const d = parseLocalDayKey(row.finished_on)
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
		if (countByKey.has(key)) {
			countByKey.set(key, (countByKey.get(key) ?? 0) + 1)
		}
	}
	monthKeys.forEach((key, idx) => {
		months[idx].count = countByKey.get(key) ?? 0
	})

	const all = await countAllFinished(db)
	const exactInMonths = months.reduce((s, m) => s + m.count, 0)
	return {
		months,
		exactInMonths,
		yearPrecisionOnly: all.yearPrecision,
		unknownPrecision: all.unknown,
		headlineTotal: all.total,
	}
}

export async function getFormatStats (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<FormatStats> {
	const empty: FormatStats = { PAPER: 0, EBOOK: 0, AUDIOBOOK: 0 }

	if (period.kind === 'ALL') {
		const rows = await db.getAllAsync<{ format: string; count: number }>(
			`SELECT format, COUNT(*) AS count FROM library_entries
			 WHERE archived_at IS NULL AND status = 'FINISHED'
			 GROUP BY format`,
		)
		for (const row of rows) {
			if (row.format in empty) {
				empty[row.format as BookFormat] = row.count
			}
		}
		return empty
	}

	if (period.kind === 'YEAR' && period.year != null) {
		const exact = await db.getAllAsync<{ format: string; count: number }>(
			`SELECT format, COUNT(*) AS count FROM library_entries
			 WHERE archived_at IS NULL
				 AND status = 'FINISHED'
				 AND finished_date_precision = 'EXACT'
				 AND finished_on >= ? AND finished_on <= ?
			 GROUP BY format`,
			[period.startKey, period.endKey],
		)
		const yearPrec = await db.getAllAsync<{ format: string; count: number }>(
			`SELECT format, COUNT(*) AS count FROM library_entries
			 WHERE archived_at IS NULL
				 AND status = 'FINISHED'
				 AND finished_date_precision = 'YEAR'
				 AND finished_year = ?
			 GROUP BY format`,
			[period.year],
		)
		for (const row of [...exact, ...yearPrec]) {
			if (row.format in empty) {
				empty[row.format as BookFormat] += row.count
			}
		}
		return empty
	}

	const rows = await db.getAllAsync<{ format: string; count: number }>(
		`SELECT format, COUNT(*) AS count FROM library_entries
		 WHERE archived_at IS NULL
			 AND status = 'FINISHED'
			 AND finished_date_precision = 'EXACT'
			 AND finished_on >= ? AND finished_on <= ?
		 GROUP BY format`,
		[period.startKey, period.endKey],
	)
	for (const row of rows) {
		if (row.format in empty) {
			empty[row.format as BookFormat] = row.count
		}
	}
	return empty
}

export async function getRatingStats (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<RatingStats> {
	let sql = `
		SELECT rating FROM library_entries
		 WHERE archived_at IS NULL
			 AND status = 'FINISHED'
			 AND rating IS NOT NULL`
	const params: (string | number)[] = []

	if (period.kind === 'ALL') {
		// lifetime rated finished
	} else if (period.kind === 'YEAR' && period.year != null) {
		sql = `
			SELECT rating FROM library_entries
			 WHERE archived_at IS NULL
				 AND status = 'FINISHED'
				 AND rating IS NOT NULL
				 AND (
					(finished_date_precision = 'EXACT'
						AND finished_on >= ? AND finished_on <= ?)
					OR (finished_date_precision = 'YEAR' AND finished_year = ?)
				)`
		params.push(period.startKey, period.endKey, period.year)
	} else {
		sql = `
			SELECT rating FROM library_entries
			 WHERE archived_at IS NULL
				 AND status = 'FINISHED'
				 AND rating IS NOT NULL
				 AND finished_date_precision = 'EXACT'
				 AND finished_on >= ? AND finished_on <= ?`
		params.push(period.startKey, period.endKey)
	}

	const rated = await db.getAllAsync<{ rating: number }>(sql, params)
	const finished = await getFinishedBooksSummary(db, period)
	if (rated.length === 0) {
		return {
			average: null,
			ratedCount: 0,
			finishedCount: finished.total,
		}
	}
	const sum = rated.reduce((s, r) => s + r.rating, 0)
	return {
		average: sum / rated.length,
		ratedCount: rated.length,
		finishedCount: finished.total,
	}
}

export async function getSessionStats (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<SessionStats> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(
		period.startKey,
		period.endKey,
	)
	const sessions = await db.getAllAsync<{
		started_at: string
		duration_seconds: number
	}>(
		`SELECT started_at, duration_seconds FROM reading_sessions
		 WHERE ended_at IS NOT NULL
			 AND duration_seconds IS NOT NULL
			 AND duration_seconds > 0
			 AND started_at >= ? AND started_at <= ?`,
		[fromIso, toIso],
	)
	const durations: number[] = []
	for (const row of sessions) {
		const dayKey = toLocalDayKey(row.started_at)
		if (
			compareDayKeys(dayKey, period.startKey) < 0 ||
			compareDayKeys(dayKey, period.endKey) > 0
		) {
			continue
		}
		durations.push(row.duration_seconds)
	}
	if (durations.length === 0) {
		return { count: 0, averageSeconds: null, maxSeconds: null }
	}
	const sum = durations.reduce((a, b) => a + b, 0)
	return {
		count: durations.length,
		averageSeconds: Math.round(sum / durations.length),
		maxSeconds: Math.max(...durations),
	}
}

export async function getNoteStats (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<NoteStats> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(
		period.startKey,
		period.endKey,
	)
	const rows = await db.getAllAsync<{
		type: string
		created_at: string
	}>(
		`SELECT type, created_at FROM reading_notes
		 WHERE created_at >= ? AND created_at <= ?`,
		[fromIso, toIso],
	)
	const out: NoteStats = { QUOTE: 0, THOUGHT: 0, NOTE: 0 }
	for (const row of rows) {
		const dayKey = toLocalDayKey(row.created_at)
		if (
			compareDayKeys(dayKey, period.startKey) < 0 ||
			compareDayKeys(dayKey, period.endKey) > 0
		) {
			continue
		}
		if (row.type === 'QUOTE' || row.type === 'THOUGHT' || row.type === 'NOTE') {
			out[row.type] += 1
		}
	}
	return out
}

export async function getTopBooks (
	db: SqlExecutor,
	period: StatsPeriodRange,
	limit = 3,
): Promise<TopBookStat[]> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(
		period.startKey,
		period.endKey,
	)
	const sessions = await db.getAllAsync<{
		library_entry_id: string
		started_at: string
		duration_seconds: number
		title: string
		author_text: string
	}>(
		`SELECT s.library_entry_id, s.started_at, s.duration_seconds,
						b.title, b.author_text
		 FROM reading_sessions s
		 JOIN library_entries e ON e.id = s.library_entry_id
		 JOIN books b ON b.id = e.book_id
		 WHERE s.ended_at IS NOT NULL
			 AND s.duration_seconds IS NOT NULL
			 AND s.duration_seconds > 0
			 AND s.started_at >= ? AND s.started_at <= ?`,
		[fromIso, toIso],
	)

	const byEntry = new Map<
		string,
		{ title: string; authorText: string; seconds: number }
	>()
	for (const row of sessions) {
		const dayKey = toLocalDayKey(row.started_at)
		if (
			compareDayKeys(dayKey, period.startKey) < 0 ||
			compareDayKeys(dayKey, period.endKey) > 0
		) {
			continue
		}
		const cur = byEntry.get(row.library_entry_id) ?? {
			title: row.title,
			authorText: row.author_text,
			seconds: 0,
		}
		cur.seconds += row.duration_seconds
		byEntry.set(row.library_entry_id, cur)
	}

	return [...byEntry.entries()]
		.map(([libraryEntryId, v]) => ({
			libraryEntryId,
			title: v.title,
			authorText: v.authorText,
			durationSeconds: v.seconds,
		}))
		.filter((b) => b.durationSeconds > 0)
		.sort((a, b) =>
			b.durationSeconds - a.durationSeconds ||
			a.title.localeCompare(b.title) ||
			a.authorText.localeCompare(b.authorText) ||
			a.libraryEntryId.localeCompare(b.libraryEntryId),
		)
		.slice(0, limit)
}

export async function getTopAuthors (
	db: SqlExecutor,
	period: StatsPeriodRange,
	limit = 3,
): Promise<AuthorStat[]> {
	let sql = `
		SELECT b.author_text AS author_text, COUNT(*) AS count
		 FROM library_entries e
		 JOIN books b ON b.id = e.book_id
		 WHERE e.archived_at IS NULL AND e.status = 'FINISHED'`
	const params: (string | number)[] = []

	if (period.kind === 'ALL') {
		sql += ` GROUP BY b.author_text ORDER BY count DESC LIMIT ?`
		params.push(limit)
	} else if (period.kind === 'YEAR' && period.year != null) {
		sql += ` AND (
			(e.finished_date_precision = 'EXACT'
				AND e.finished_on >= ? AND e.finished_on <= ?)
			OR (e.finished_date_precision = 'YEAR' AND e.finished_year = ?)
		) GROUP BY b.author_text ORDER BY count DESC LIMIT ?`
		params.push(period.startKey, period.endKey, period.year, limit)
	} else {
		sql += ` AND e.finished_date_precision = 'EXACT'
			AND e.finished_on >= ? AND e.finished_on <= ?
			GROUP BY b.author_text ORDER BY count DESC LIMIT ?`
		params.push(period.startKey, period.endKey, limit)
	}

	const rows = await db.getAllAsync<{ author_text: string; count: number }>(
		sql,
		params,
	)
	return rows
		.filter((r) => r.author_text?.trim())
		.map((r) => ({ authorText: r.author_text, bookCount: r.count }))
}

export async function getMostActiveDay (
	db: SqlExecutor,
	period: StatsPeriodRange,
): Promise<MostActiveDay | null> {
	const map = await getActivityForRange(db, period.startKey, period.endKey, {
		fillEmptyDays: false,
	})
	let best: MostActiveDay | null = null
	for (const day of map.values()) {
		if (day.sessionSeconds <= 0) {
			continue
		}
		if (!best || day.sessionSeconds > best.seconds) {
			best = { dayKey: day.dayKey, seconds: day.sessionSeconds }
		}
	}
	return best
}

async function detectReadingSignal (db: SqlExecutor): Promise<boolean> {
	const session = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM reading_sessions
		 WHERE ended_at IS NOT NULL AND duration_seconds > 0 LIMIT 1`,
	)
	if ((session?.c ?? 0) > 0) {
		return true
	}
	const events = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM reading_progress_events LIMIT 1`,
	)
	if ((events?.c ?? 0) > 0) {
		return true
	}
	const finished = await db.getFirstAsync<{ c: number }>(
		`SELECT COUNT(*) AS c FROM library_entries
		 WHERE status = 'FINISHED' AND archived_at IS NULL LIMIT 1`,
	)
	return (finished?.c ?? 0) > 0
}

/**
 * Full statistics dashboard for one period — bulk-friendly parallel queries.
 */
export async function getStatsDashboard (
	db: SqlExecutor,
	kind: StatsPeriodKind,
	now: Date = new Date(),
	year?: number,
): Promise<StatsDashboard> {
	const period = resolveStatsPeriod(kind, now, year)

	const [
		summary,
		seriesPack,
		monthlyBooks,
		formats,
		ratings,
		sessions,
		notes,
		topBooks,
		topAuthors,
		mostActiveDay,
		libraryNow,
		hasReadingSignal,
	] = await Promise.all([
		getSummary(db, period),
		getReadingSeries(db, period),
		getCompletedBooksSeries(db, period),
		getFormatStats(db, period),
		getRatingStats(db, period),
		getSessionStats(db, period),
		getNoteStats(db, period),
		getTopBooks(db, period),
		getTopAuthors(db, period),
		getMostActiveDay(db, period),
		getLibraryStatusCounts(db),
		detectReadingSignal(db),
	])

	const averages: StatsAverages = {
		secondsPerActiveDay:
			summary.readingDays > 0 && summary.readingSeconds > 0
				? Math.round(summary.readingSeconds / summary.readingDays)
				: null,
		pagesPerActiveDay:
			summary.readingDays > 0 && summary.pagesRead > 0
				? Math.round(summary.pagesRead / summary.readingDays)
				: null,
	}

	// Pace insight: last 30 rolling days (independent of selected period).
	const pacePeriod = resolveStatsPeriod('D30', now)
	const paceActivity = await getActivityForRange(
		db,
		pacePeriod.startKey,
		pacePeriod.endKey,
		{ fillEmptyDays: false },
	)
	const paceDays = [...paceActivity.values()].filter((d) => d.active)
	const pacePages = await getPageDeltaInRange(
		db,
		pacePeriod.startKey,
		pacePeriod.endKey,
	)
	const pacePagesPerActiveDay30 =
		paceDays.length > 0 && pacePages > 0
			? Math.round(pacePages / paceDays.length)
			: null

	return {
		period,
		summary,
		series: seriesPack.series,
		granularity: seriesPack.granularity,
		monthlyBooks,
		formats,
		ratings,
		sessions,
		notes,
		topBooks,
		topAuthors,
		mostActiveDay,
		averages,
		libraryNow,
		hasReadingSignal,
		pacePagesPerActiveDay30,
	}
}

/** Exported for tests — ensure series day pages match activity day. */
export async function getDailyPageSeriesAligned (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
): Promise<Map<string, number>> {
	const map = await getActivityForRange(db, startKey, endKey, {
		fillEmptyDays: true,
	})
	const out = new Map<string, number>()
	for (const [key, day] of map) {
		out.set(key, day.pagesRead)
	}
	return out
}
