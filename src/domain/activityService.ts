/**
 * Activity aggregation — reading days, streaks, day details.
 *
 * Session activity day = local day of session.startedAt
 * (documented midnight rule: overnight sessions count on the start day).
 *
 * Progress events (QUICK/MANUAL/UNDO/FINISH) contribute progress deltas;
 * SESSION_END is excluded from activity-day detection (session already counts)
 * but IS included in page-goal deltas (single source of truth for pages).
 */

import type { ProgressEventType } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'
import {
	addLocalDays,
	compareDayKeys,
	eachLocalDay,
	endOfMonth,
	isoRangeCoveringLocalDays,
	startOfMonth,
	toLocalDayKey,
} from '@/utils/period'
import { toDateOnlyLocal } from '@/utils/dates'

export type ActivityIntensity = 'none' | 'light' | 'medium' | 'strong'

export interface DayActivity {
	dayKey: string
	active: boolean
	intensity: ActivityIntensity
	sessionCount: number
	/** Wall-clock reading from completed sessions (seconds). */
	sessionSeconds: number
	/** Net page delta including undos (may be 0 after undo). */
	pageDelta: number
	percentDelta: number
	audioSecondsDelta: number
	/** Positive pages for display (max(0, pageDelta)). */
	pagesRead: number
	finishBookCount: number
	noteCount: number
	bookTitles: string[]
}

export interface StreakSummary {
	current: number
	best: number
	/** True when yesterday continues the streak but today has no activity yet. */
	todayPending: boolean
	message: string | null
}

interface SessionRow {
	id: string
	library_entry_id: string
	started_at: string
	ended_at: string | null
	duration_seconds: number | null
	title: string
}

interface EventRow {
	id: string
	library_entry_id: string
	type: string
	previous_page: number | null
	new_page: number | null
	previous_percent: number | null
	new_percent: number | null
	previous_audio_seconds: number | null
	new_audio_seconds: number | null
	created_at: string
	title: string
}

interface NoteRow {
	id: string
	created_at: string
	library_entry_id: string
	title: string
}

function emptyDay (dayKey: string): DayActivity {
	return {
		dayKey,
		active: false,
		intensity: 'none',
		sessionCount: 0,
		sessionSeconds: 0,
		pageDelta: 0,
		percentDelta: 0,
		audioSecondsDelta: 0,
		pagesRead: 0,
		finishBookCount: 0,
		noteCount: 0,
		bookTitles: [],
	}
}

function intensityFor (day: DayActivity): ActivityIntensity {
	if (!day.active) {
		return 'none'
	}
	const minutes = Math.floor(day.sessionSeconds / 60)
	if (minutes >= 45) {
		return 'strong'
	}
	if (minutes >= 15) {
		return 'medium'
	}
	// Session under 15 min, or progress-only day → light
	return 'light'
}

function finalizeDay (day: DayActivity): DayActivity {
	const active =
		day.sessionSeconds > 0 ||
		day.pageDelta > 0 ||
		day.percentDelta > 0 ||
		day.audioSecondsDelta > 0 ||
		day.finishBookCount > 0
	day.active = active
	day.pagesRead = Math.max(0, day.pageDelta)
	day.intensity = intensityFor(day)
	day.bookTitles = [...new Set(day.bookTitles)].filter(Boolean)
	return day
}

function addTitle (day: DayActivity, title: string) {
	if (title) {
		day.bookTitles.push(title)
	}
}

/**
 * Aggregate activity for an inclusive local day range.
 * One bulk session query + one events query + optional notes.
 */
export async function getActivityForRange (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
	options: { includeNotes?: boolean; fillEmptyDays?: boolean } = {},
): Promise<Map<string, DayActivity>> {
	const map = new Map<string, DayActivity>()
	const fillEmpty = options.fillEmptyDays !== false
	if (fillEmpty) {
		for (const key of eachLocalDay(startKey, endKey)) {
			map.set(key, emptyDay(key))
		}
	}

	const ensure = (dayKey: string): DayActivity | null => {
		if (compareDayKeys(dayKey, startKey) < 0 || compareDayKeys(dayKey, endKey) > 0) {
			return null
		}
		let day = map.get(dayKey)
		if (!day) {
			day = emptyDay(dayKey)
			map.set(dayKey, day)
		}
		return day
	}

	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)

	const sessions = await db.getAllAsync<SessionRow>(
		`SELECT rs.id, rs.library_entry_id, rs.started_at, rs.ended_at,
			rs.duration_seconds, b.title AS title
		 FROM reading_sessions rs
		 INNER JOIN library_entries le ON le.id = rs.library_entry_id
		 INNER JOIN books b ON b.id = le.book_id
		 WHERE rs.ended_at IS NOT NULL
			 AND rs.duration_seconds IS NOT NULL
			 AND rs.duration_seconds > 0
			 AND rs.started_at >= ?
			 AND rs.started_at <= ?
		 ORDER BY rs.started_at ASC`,
		[fromIso, toIso],
	)

	for (const row of sessions) {
		const dayKey = toLocalDayKey(row.started_at)
		const day = ensure(dayKey)
		if (!day) {
			continue
		}
		day.sessionCount += 1
		day.sessionSeconds += row.duration_seconds ?? 0
		addTitle(day, row.title)
	}

	const events = await db.getAllAsync<EventRow>(
		`SELECT e.id, e.library_entry_id, e.type,
			e.previous_page, e.new_page, e.previous_percent, e.new_percent,
			e.previous_audio_seconds, e.new_audio_seconds, e.created_at,
			b.title AS title
		 FROM reading_progress_events e
		 INNER JOIN library_entries le ON le.id = e.library_entry_id
		 INNER JOIN books b ON b.id = le.book_id
		 WHERE e.created_at >= ? AND e.created_at <= ?
		 ORDER BY e.created_at ASC`,
		[fromIso, toIso],
	)

	for (const row of events) {
		const dayKey = toLocalDayKey(row.created_at)
		const day = ensure(dayKey)
		if (!day) {
			continue
		}
		const type = row.type as ProgressEventType

		if (type === 'FINISH_BOOK') {
			day.finishBookCount += 1
			addTitle(day, row.title)
		}

		// Page / percent / audio nets (including UNDO negatives).
		// SESSION_END pages count for goals via getPageProgressInRange;
		// for activity day we skip SESSION_END so overnight session is not
		// double-counted on endedAt day when startedAt already counted.
		if (type === 'SESSION_END') {
			continue
		}

		if (
			type === 'QUICK_UPDATE' ||
			type === 'MANUAL_UPDATE' ||
			type === 'UNDO' ||
			type === 'FINISH_BOOK'
		) {
			if (row.new_page != null || row.previous_page != null) {
				day.pageDelta += (row.new_page ?? 0) - (row.previous_page ?? 0)
			}
			if (row.new_percent != null || row.previous_percent != null) {
				day.percentDelta +=
					(row.new_percent ?? 0) - (row.previous_percent ?? 0)
			}
			if (
				row.new_audio_seconds != null ||
				row.previous_audio_seconds != null
			) {
				day.audioSecondsDelta +=
					(row.new_audio_seconds ?? 0) -
					(row.previous_audio_seconds ?? 0)
			}
			if (type !== 'UNDO') {
				addTitle(day, row.title)
			}
		}
	}

	if (options.includeNotes) {
		const notes = await db.getAllAsync<NoteRow>(
			`SELECT n.id, n.created_at, n.library_entry_id, b.title AS title
			 FROM reading_notes n
			 INNER JOIN library_entries le ON le.id = n.library_entry_id
			 INNER JOIN books b ON b.id = le.book_id
			 WHERE n.created_at >= ? AND n.created_at <= ?`,
			[fromIso, toIso],
		)
		for (const row of notes) {
			const dayKey = toLocalDayKey(row.created_at)
			const day = ensure(dayKey)
			if (!day) {
				continue
			}
			day.noteCount += 1
			// Notes alone do NOT mark the day active (finalize ignores noteCount).
		}
	}

	for (const [key, day] of map) {
		map.set(key, finalizeDay(day))
	}
	return map
}

export async function getDayActivity (
	db: SqlExecutor,
	dayKey: string,
): Promise<DayActivity> {
	const map = await getActivityForRange(db, dayKey, dayKey, {
		includeNotes: true,
	})
	return map.get(dayKey) ?? emptyDay(dayKey)
}

export async function getMonthActivity (
	db: SqlExecutor,
	year: number,
	monthIndex: number,
): Promise<Map<string, DayActivity>> {
	const anchor = toDateOnlyLocal(new Date(year, monthIndex, 1))
	const start = startOfMonth(anchor)
	const end = endOfMonth(anchor)
	return getActivityForRange(db, start, end, { includeNotes: true })
}

/**
 * Current streak: consecutive active days ending at today (if active)
 * or yesterday (if today still pending). Missed full calendar day → 0.
 */
export function computeStreak (
	activeDaysSortedAsc: string[],
	todayKey: string,
): StreakSummary {
	const set = new Set(activeDaysSortedAsc)
	const yesterday = addLocalDays(todayKey, -1)
	const todayActive = set.has(todayKey)
	const yesterdayActive = set.has(yesterday)

	let current = 0
	let todayPending = false
	let message: string | null = null

	if (todayActive) {
		current = countBackwards(set, todayKey)
	} else if (yesterdayActive) {
		current = countBackwards(set, yesterday)
		todayPending = current > 0
		message =
			current > 0
				? 'Сегодня ещё можно продолжить серию.'
				: null
	} else {
		current = 0
	}

	const best = computeBestStreak(activeDaysSortedAsc)

	if (activeDaysSortedAsc.length === 0) {
		message = 'Серия начнётся после первого дня чтения.'
	}

	return { current, best, todayPending, message }
}

function countBackwards (set: Set<string>, fromKey: string): number {
	let count = 0
	let cursor = fromKey
	while (set.has(cursor)) {
		count += 1
		cursor = addLocalDays(cursor, -1)
		if (count > 10000) {
			break
		}
	}
	return count
}

function computeBestStreak (sortedAsc: string[]): number {
	if (sortedAsc.length === 0) {
		return 0
	}
	let best = 1
	let run = 1
	for (let i = 1; i < sortedAsc.length; i += 1) {
		const prev = sortedAsc[i - 1]!
		const cur = sortedAsc[i]!
		if (cur === addLocalDays(prev, 1)) {
			run += 1
			best = Math.max(best, run)
		} else if (cur !== prev) {
			run = 1
		}
	}
	return best
}

export async function getStreakSummary (
	db: SqlExecutor,
	now: Date = new Date(),
): Promise<StreakSummary> {
	const todayKey = toDateOnlyLocal(now)
	// Look back far enough for best streak (2 years).
	const startKey = addLocalDays(todayKey, -800)
	const map = await getActivityForRange(db, startKey, todayKey, {
		fillEmptyDays: false,
	})
	const active = [...map.values()]
		.filter((d) => d.active)
		.map((d) => d.dayKey)
		.sort(compareDayKeys)
	return computeStreak(active, todayKey)
}

/**
 * Positive+negative page deltas from progress events for a local day range.
 * Includes SESSION_END (canonical page source for sessions).
 * Period progress = max(0, sum of deltas).
 */
export async function getPageDeltaInRange (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
): Promise<number> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const events = await db.getAllAsync<{
		type: string
		previous_page: number | null
		new_page: number | null
		created_at: string
	}>(
		`SELECT type, previous_page, new_page, created_at
		 FROM reading_progress_events
		 WHERE created_at >= ? AND created_at <= ?
			AND type IN ('QUICK_UPDATE', 'MANUAL_UPDATE', 'SESSION_END', 'UNDO', 'FINISH_BOOK')`,
		[fromIso, toIso],
	)

	let sum = 0
	for (const row of events) {
		const dayKey = toLocalDayKey(row.created_at)
		if (compareDayKeys(dayKey, startKey) < 0 || compareDayKeys(dayKey, endKey) > 0) {
			continue
		}
		if (row.new_page == null && row.previous_page == null) {
			continue
		}
		sum += (row.new_page ?? 0) - (row.previous_page ?? 0)
	}
	return Math.max(0, sum)
}

/** Session wall-clock seconds in local day range (by startedAt day). */
export async function getSessionSecondsInRange (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
): Promise<number> {
	const { fromIso, toIso } = isoRangeCoveringLocalDays(startKey, endKey)
	const sessions = await db.getAllAsync<{
		started_at: string
		duration_seconds: number | null
	}>(
		`SELECT started_at, duration_seconds FROM reading_sessions
		 WHERE ended_at IS NOT NULL
			 AND duration_seconds IS NOT NULL
			 AND duration_seconds > 0
			 AND started_at >= ? AND started_at <= ?`,
		[fromIso, toIso],
	)
	let sum = 0
	for (const row of sessions) {
		const dayKey = toLocalDayKey(row.started_at)
		if (compareDayKeys(dayKey, startKey) < 0 || compareDayKeys(dayKey, endKey) > 0) {
			continue
		}
		sum += row.duration_seconds ?? 0
	}
	return sum
}

/**
 * Books finished in period:
 * - EXACT with finished_on in range
 * - YEAR only when period spans the full calendar year matching finished_year
 */
export async function getBooksFinishedInRange (
	db: SqlExecutor,
	startKey: string,
	endKey: string,
	opts: { allowYearPrecision: boolean; year?: number } = {
		allowYearPrecision: false,
	},
): Promise<number> {
	const exact = await db.getFirstAsync<{ count: number }>(
		`SELECT COUNT(*) AS count FROM library_entries
		 WHERE archived_at IS NULL
			 AND status = 'FINISHED'
			 AND finished_date_precision = 'EXACT'
			 AND finished_on IS NOT NULL
			 AND finished_on >= ?
			 AND finished_on <= ?`,
		[startKey, endKey],
	)
	let count = exact?.count ?? 0

	if (opts.allowYearPrecision && opts.year != null) {
		const yearRows = await db.getFirstAsync<{ count: number }>(
			`SELECT COUNT(*) AS count FROM library_entries
			 WHERE archived_at IS NULL
				 AND status = 'FINISHED'
				 AND finished_date_precision = 'YEAR'
				 AND finished_year = ?`,
			[opts.year],
		)
		count += yearRows?.count ?? 0
	}

	return count
}
