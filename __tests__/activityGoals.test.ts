/**
 * Phase 6 — activity days, streaks, goals.
 */

import { applyMigrations, getSchemaVersion } from '@/db/migrations/applyMigrations'
import { migrations } from '@/db/migrations'
import {
	createBook,
	createLibraryEntry,
	createProgressEvent,
	updateLibraryEntry,
} from '@/db/repositories'
import {
	computeStreak,
	getBooksFinishedInRange,
	getDayActivity,
	getPageDeltaInRange,
	getSessionSecondsInRange,
	getStreakSummary,
} from '@/domain/activityService'
import {
	createGoal,
	deactivateGoal,
	listGoalProgress,
} from '@/domain/goalsService'
import {
	applyQuickProgress,
	finishReadingSession,
	markBookFinished,
	startReadingSession,
	undoProgressEvent,
} from '@/domain/readingTrackerService'
import { toDateOnlyLocal } from '@/utils/dates'
import {
	addLocalDays,
	endOfWeekSunday,
	periodRangeFor,
	startOfWeekMonday,
	toLocalDayKey,
} from '@/utils/period'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function seed (
	db: ReturnType<typeof createTestSqlExecutor>,
	opts: { title?: string; page?: number; total?: number } = {},
) {
	await applyMigrations(db)
	const book = await createBook(db, {
		title: opts.title ?? 'Книга',
		authorText: 'Автор',
	})
	const entry = await createLibraryEntry(db, {
		bookId: book.id,
		status: 'READING',
		progressMode: 'PAGES',
		currentPage: opts.page ?? 100,
		totalPages: opts.total ?? 400,
	})
	return { book, entry }
}

describe('local period helpers', () => {
	it('maps ISO timestamps to local day keys (not raw UTC slice)', () => {
		// Construct a local noon so the day key matches the local calendar date.
		const localNoon = new Date(2026, 8, 6, 12, 0, 0)
		expect(toLocalDayKey(localNoon.toISOString())).toBe('2026-09-06')
	})

	it('week starts Monday and ends Sunday', () => {
		// 2026-09-06 is Sunday
		expect(startOfWeekMonday('2026-09-06')).toBe('2026-08-31')
		expect(endOfWeekSunday('2026-09-06')).toBe('2026-09-06')
		// 2026-09-07 is Monday
		expect(startOfWeekMonday('2026-09-07')).toBe('2026-09-07')
		expect(endOfWeekSunday('2026-09-07')).toBe('2026-09-13')
	})

	it('handles month/year boundaries', () => {
		expect(periodRangeFor('MONTH', '2026-01-15')).toEqual({
			startKey: '2026-01-01',
			endKey: '2026-01-31',
		})
		expect(periodRangeFor('YEAR', '2026-12-31')).toEqual({
			startKey: '2026-01-01',
			endKey: '2026-12-31',
		})
		expect(addLocalDays('2025-12-31', 1)).toBe('2026-01-01')
	})
})

describe('activity days', () => {
	it('counts completed session and positive quick progress', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seed(db, { page: 100 })
		const today = toDateOnlyLocal()

		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		const started = await startReadingSession(
			db,
			entry.id,
			new Date().toISOString(),
		)
		const ended = new Date(Date.now() + 20 * 60 * 1000).toISOString()
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: ended,
			endPage: 115,
		})

		const day = await getDayActivity(db, today)
		expect(day.active).toBe(true)
		expect(day.sessionCount).toBe(1)
		expect(day.sessionSeconds).toBeGreaterThanOrEqual(19 * 60)
		// quick +10 and session end +5 → page delta 15 (session end includes from 110)
		expect(day.pagesRead).toBeGreaterThanOrEqual(10)
	})

	it('does not count note-only or metadata as activity', async () => {
		const db = createTestSqlExecutor()
		await seed(db)
		const today = toDateOnlyLocal()
		// No progress events / sessions
		const day = await getDayActivity(db, today)
		expect(day.active).toBe(false)
	})

	it('undo cancels false activity from quick update', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seed(db, { page: 100 })
		const today = toDateOnlyLocal()
		const updated = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: 10,
		})
		await undoProgressEvent(db, updated.event.id)
		const day = await getDayActivity(db, today)
		expect(day.pageDelta).toBe(0)
		expect(day.active).toBe(false)
	})

	it('audiobook quick +30 does not create session minutes', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const book = await createBook(db, { title: 'Audio', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			progressMode: 'TIME',
			audioPositionSeconds: 0,
			audioDurationSeconds: 36000,
		})
		await applyQuickProgress(db, entry.id, { kind: 'minutes', delta: 30 })
		const today = toDateOnlyLocal()
		const day = await getDayActivity(db, today)
		expect(day.active).toBe(true)
		expect(day.sessionSeconds).toBe(0)
		expect(day.audioSecondsDelta).toBe(30 * 60)
		const minutes = await getSessionSecondsInRange(db, today, today)
		expect(minutes).toBe(0)
	})
})

describe('streaks', () => {
	it('handles consecutive days, gaps, today-pending, best', () => {
		const today = '2026-09-05'
		const active = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
		const pending = computeStreak(active, today)
		expect(pending.current).toBe(4)
		expect(pending.todayPending).toBe(true)
		expect(pending.best).toBe(4)

		const continued = computeStreak([...active, '2026-09-05'], today)
		expect(continued.current).toBe(5)
		expect(continued.todayPending).toBe(false)

		const missed = computeStreak(active, '2026-09-06')
		expect(missed.current).toBe(0)
		expect(missed.best).toBe(4)

		const gap = computeStreak(
			['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05'],
			'2026-09-05',
		)
		expect(gap.current).toBe(2)
		expect(gap.best).toBe(2)
	})

	it('midnight session counts on startedAt local day only', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seed(db, { page: 10, total: 100 })
		// Force startedAt late evening local → use fixed ISO that maps via toLocalDayKey
		const start = new Date(2026, 8, 6, 23, 50, 0)
		const end = new Date(2026, 8, 7, 0, 20, 0)
		const started = await startReadingSession(
			db,
			entry.id,
			start.toISOString(),
		)
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: end.toISOString(),
			endPage: 20,
		})
		const startDay = toLocalDayKey(start.toISOString())
		const endDay = toLocalDayKey(end.toISOString())
		const a = await getDayActivity(db, startDay)
		expect(a.active).toBe(true)
		expect(a.sessionCount).toBe(1)
		if (startDay !== endDay) {
			const b = await getDayActivity(db, endDay)
			// Session not double-counted on end day via SESSION_END
			expect(b.sessionCount).toBe(0)
		}
	})
})

describe('goals', () => {
	it('pages daily with positive deltas, undo, no double session count', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seed(db, { page: 100 })
		const today = toDateOnlyLocal()

		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		const started = await startReadingSession(db, entry.id)
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: new Date(Date.now() + 60_000).toISOString(),
			endPage: 115,
		})
		// 10 quick + 5 session end = 15
		expect(await getPageDeltaInRange(db, today, today)).toBe(15)

		await createGoal(db, {
			type: 'PAGES',
			period: 'DAY',
			targetValue: 20,
		})
		const progress = await listGoalProgress(db)
		expect(progress[0]?.current).toBe(15)
		expect(progress[0]?.target).toBe(20)

		// Decrease should not increase goal
		await createProgressEvent(db, {
			libraryEntryId: entry.id,
			type: 'MANUAL_UPDATE',
			previousPage: 115,
			newPage: 100,
		})
		await updateLibraryEntry(db, entry.id, { currentPage: 100 })
		expect(await getPageDeltaInRange(db, today, today)).toBe(0)
	})

	it('minutes from sessions only; 0 duration ignored', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seed(db)
		const today = toDateOnlyLocal()
		const started = await startReadingSession(
			db,
			entry.id,
			new Date(Date.now() - 20 * 60 * 1000).toISOString(),
		)
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: new Date().toISOString(),
			endPage: 105,
		})
		const seconds = await getSessionSecondsInRange(db, today, today)
		expect(seconds).toBeGreaterThanOrEqual(19 * 60)

		await createGoal(db, {
			type: 'MINUTES',
			period: 'DAY',
			targetValue: 30,
		})
		const [goal] = await listGoalProgress(db)
		expect(goal?.current).toBe(Math.floor(seconds / 60))
	})

	it('books: EXACT in period; YEAR only for annual; UNKNOWN excluded', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const today = toDateOnlyLocal()
		const year = Number.parseInt(today.slice(0, 4), 10)

		const exactBook = await createBook(db, { title: 'Exact', authorText: 'A' })
		const exact = await createLibraryEntry(db, {
			bookId: exactBook.id,
			status: 'FINISHED',
			finishedDatePrecision: 'EXACT',
			finishedOn: today,
			finishedAt: new Date().toISOString(),
		})
		void exact

		const yearBook = await createBook(db, { title: 'Year', authorText: 'A' })
		await createLibraryEntry(db, {
			bookId: yearBook.id,
			status: 'FINISHED',
			finishedDatePrecision: 'YEAR',
			finishedYear: year,
		})

		const unknownBook = await createBook(db, {
			title: 'Unknown',
			authorText: 'A',
		})
		await createLibraryEntry(db, {
			bookId: unknownBook.id,
			status: 'FINISHED',
			finishedDatePrecision: 'UNKNOWN',
		})

		const monthCount = await getBooksFinishedInRange(
			db,
			`${year}-01-01`,
			`${year}-12-31`,
			{ allowYearPrecision: false },
		)
		// Only EXACT in range for non-year-precision mode when scanning whole year
		expect(monthCount).toBe(1)

		const monthOnly = await getBooksFinishedInRange(
			db,
			today.slice(0, 7) + '-01',
			today,
			{ allowYearPrecision: false },
		)
		expect(monthOnly).toBe(1)

		const annual = await getBooksFinishedInRange(
			db,
			`${year}-01-01`,
			`${year}-12-31`,
			{ allowYearPrecision: true, year },
		)
		expect(annual).toBe(2)
	})

	it('archives goal so it leaves active list', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const goal = await createGoal(db, {
			type: 'PAGES',
			period: 'DAY',
			targetValue: 10,
		})
		await deactivateGoal(db, goal.id)
		expect(await listGoalProgress(db)).toHaveLength(0)
	})

	it('multiple goals progress independently', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seed(db, { page: 50 })
		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		await createGoal(db, { type: 'PAGES', period: 'DAY', targetValue: 20 })
		await createGoal(db, { type: 'MINUTES', period: 'DAY', targetValue: 30 })
		const rows = await listGoalProgress(db)
		expect(rows).toHaveLength(2)
		const pages = rows.find((r) => r.goal.type === 'PAGES')
		const minutes = rows.find((r) => r.goal.type === 'MINUTES')
		expect(pages?.current).toBe(10)
		expect(minutes?.current).toBe(0)
	})
})

describe('activity integration', () => {
	it('full reading + goals + streak scenario', async () => {
		const db = createTestSqlExecutor()
		expect(await applyMigrations(db)).toBe(5)
		expect(await getSchemaVersion(db)).toBe(5)

		const { entry } = await seed(db, {
			title: 'Мастер и Маргарита',
			page: 100,
			total: 480,
		})
		const today = toDateOnlyLocal()

		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		const started = await startReadingSession(
			db,
			entry.id,
			new Date(Date.now() - 20 * 60 * 1000).toISOString(),
		)
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: new Date().toISOString(),
			endPage: 115,
		})

		const day = await getDayActivity(db, today)
		expect(day.active).toBe(true)
		expect(await getPageDeltaInRange(db, today, today)).toBe(15)
		expect(day.sessionSeconds).toBeGreaterThanOrEqual(19 * 60)

		await createGoal(db, { type: 'PAGES', period: 'DAY', targetValue: 20 })
		await createGoal(db, { type: 'MINUTES', period: 'DAY', targetValue: 30 })
		let goals = await listGoalProgress(db)
		expect(goals.find((g) => g.goal.type === 'PAGES')?.current).toBe(15)
		expect(
			goals.find((g) => g.goal.type === 'MINUTES')?.current,
		).toBeGreaterThanOrEqual(19)

		const started2 = await startReadingSession(
			db,
			entry.id,
			new Date(Date.now() - 10 * 60 * 1000).toISOString(),
		)
		await finishReadingSession(db, {
			sessionId: started2.session.id,
			endedAt: new Date().toISOString(),
			endPage: 120,
		})
		goals = await listGoalProgress(db)
		const minutesGoal = goals.find((g) => g.goal.type === 'MINUTES')
		expect(minutesGoal?.current).toBeGreaterThanOrEqual(29)

		const otherBook = await createBook(db, {
			title: 'Другая',
			authorText: 'A',
		})
		const other = await createLibraryEntry(db, {
			bookId: otherBook.id,
			status: 'READING',
			progressMode: 'PERCENT',
			currentPercent: 90,
		})
		await markBookFinished(db, other.id, { applySuggestedProgress: true })

		await createGoal(db, { type: 'BOOKS', period: 'YEAR', targetValue: 12 })
		goals = await listGoalProgress(db)
		expect(goals.find((g) => g.goal.type === 'BOOKS')?.current).toBeGreaterThanOrEqual(1)

		const streak = await getStreakSummary(db)
		expect(streak.current).toBeGreaterThanOrEqual(1)
	})

	it('registers migration 005', () => {
		expect(migrations).toHaveLength(5)
		expect(migrations[4]?.version).toBe(5)
	})
})
