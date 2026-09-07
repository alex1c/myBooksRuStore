/**
 * Phase 7 — reading statistics aggregation and consistency.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	createBook,
	createLibraryEntry,
	createProgressEvent,
	createReadingNote,
	createReadingSession,
	updateLibraryEntry,
} from '@/db/repositories'
import {
	getDayActivity,
	getPageDeltaInRange,
	getSessionSecondsInRange,
} from '@/domain/activityService'
import { createGoal, listGoalProgress } from '@/domain/goalsService'
import {
	applyQuickProgress,
	finishReadingSession,
	startReadingSession,
	undoProgressEvent,
} from '@/domain/readingTrackerService'
import {
	getCompletedBooksSeries,
	getFormatStats,
	getNoteStats,
	getRatingStats,
	getReadingSeries,
	getSessionStats,
	getStatsDashboard,
	getSummary,
	getTopBooks,
} from '@/domain/statisticsService'
import { toDateOnlyLocal } from '@/utils/dates'
import {
	formatBooksCount,
	formatDaysCount,
	formatIntegerRu,
	formatRatingRu,
	formatStatsDuration,
} from '@/utils/format'
import { resolveStatsPeriod } from '@/utils/statsPeriod'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function seedReading (
	db: ReturnType<typeof createTestSqlExecutor>,
	opts: {
		title?: string
		author?: string
		page?: number
		total?: number
		format?: 'PAPER' | 'EBOOK' | 'AUDIOBOOK'
	} = {},
) {
	await applyMigrations(db)
	const book = await createBook(db, {
		title: opts.title ?? 'Книга',
		authorText: opts.author ?? 'Автор',
	})
	const entry = await createLibraryEntry(db, {
		bookId: book.id,
		status: 'READING',
		format: opts.format ?? 'PAPER',
		progressMode: 'PAGES',
		currentPage: opts.page ?? 100,
		totalPages: opts.total ?? 400,
	})
	return { book, entry }
}

describe('format helpers', () => {
	it('formats Russian integers and plurals', () => {
		expect(formatIntegerRu(1284)).toBe('1 284')
		expect(formatBooksCount(1)).toBe('1 книга')
		expect(formatBooksCount(2)).toBe('2 книги')
		expect(formatBooksCount(5)).toBe('5 книг')
		expect(formatDaysCount(1)).toBe('1 день')
		expect(formatDaysCount(22)).toBe('22 дня')
		expect(formatDaysCount(5)).toBe('5 дней')
	})

	it('formats stats duration and rating', () => {
		expect(formatStatsDuration(42 * 60)).toBe('42 мин')
		expect(formatStatsDuration(18 * 3600 + 42 * 60)).toBe('18 ч 42 мин')
		expect(formatStatsDuration(126 * 3600)).toBe('126 ч')
		expect(formatRatingRu(4.3)).toMatch(/4[,.]3/)
	})
})

describe('stats period ranges', () => {
	it('resolves rolling 7/30/90 including today', () => {
		const now = new Date(2026, 8, 7, 12, 0, 0) // Sep 7 2026
		expect(resolveStatsPeriod('D7', now)).toMatchObject({
			startKey: '2026-09-01',
			endKey: '2026-09-07',
			bounded: true,
		})
		expect(resolveStatsPeriod('D30', now).startKey).toBe('2026-08-09')
		expect(resolveStatsPeriod('D90', now).endKey).toBe('2026-09-07')
	})

	it('resolves calendar year and all', () => {
		const now = new Date(2026, 5, 15)
		const year = resolveStatsPeriod('YEAR', now, 2026)
		expect(year.startKey).toBe('2026-01-01')
		expect(year.endKey).toBe('2026-12-31')
		expect(year.year).toBe(2026)
		const all = resolveStatsPeriod('ALL', now)
		expect(all.bounded).toBe(false)
		expect(all.startKey).toBe('1970-01-01')
	})
})

describe('summary pages / time / undo', () => {
	it('nets undo and correction without fake pages', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReading(db, { page: 100 })
		const today = toDateOnlyLocal()
		const period = resolveStatsPeriod('D7')

		// 100 → +25 → 125
		const first = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: 25,
		})
		await undoProgressEvent(db, first.event.id)
		// 100 → +10 → 110
		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })

		const summary = await getSummary(db, period)
		expect(summary.pagesRead).toBe(10)
		expect(await getPageDeltaInRange(db, today, today)).toBe(10)

		// Manual correction 110 → 150 then 150 → 120: net +20 from 100 base? 
		// From current 110: set absolute via events
		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 40 }) // 150
		// Correction down: MANUAL with negative delta via createProgressEvent style
		// Use applyQuickProgress negative if supported, else manual event
		const afterUp = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: -30,
		})
		expect(afterUp.entry.currentPage).toBe(120)
		const pages = await getPageDeltaInRange(db, today, today)
		// 10 + 40 - 30 = 20 net positive
		expect(pages).toBe(20)
	})

	it('session time excludes active / zero / cancelled', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReading(db, { page: 50 })
		const period = resolveStatsPeriod('D30')

		const started = await startReadingSession(db, entry.id)
		const ended = new Date(Date.now() + 30 * 60 * 1000).toISOString()
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: ended,
			endPage: 70,
		})

		// Active unfinished session
		await startReadingSession(db, entry.id)

		// Zero-duration completed session inserted directly
		await createReadingSession(db, {
			libraryEntryId: entry.id,
			startedAt: new Date().toISOString(),
			endedAt: new Date().toISOString(),
			durationSeconds: 0,
			endPage: 70,
		})

		const stats = await getSessionStats(db, period)
		expect(stats.count).toBe(1)
		expect(stats.averageSeconds).toBeGreaterThanOrEqual(29 * 60)
		expect(stats.maxSeconds).toBeGreaterThanOrEqual(29 * 60)

		const seconds = await getSessionSecondsInRange(
			db,
			period.startKey,
			period.endKey,
		)
		expect(seconds).toBeGreaterThanOrEqual(29 * 60)
		expect(seconds).toBeLessThan(40 * 60)
	})
})

describe('completed books precision', () => {
	it('YEAR vs monthly EXACT vs ALL UNKNOWN', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		async function finishedBook (
			title: string,
			precision: 'EXACT' | 'YEAR' | 'UNKNOWN',
			finishedOn?: string,
			finishedYear?: number,
			format: 'PAPER' | 'EBOOK' | 'AUDIOBOOK' = 'PAPER',
			rating?: number,
		) {
			const book = await createBook(db, {
				title,
				authorText: 'Достоевский',
			})
			return createLibraryEntry(db, {
				bookId: book.id,
				status: 'FINISHED',
				format,
				progressMode: 'PAGES',
				finishedDatePrecision: precision,
				finishedOn: finishedOn ?? null,
				finishedYear: finishedYear ?? null,
				rating: rating ?? null,
			})
		}

		await finishedBook('A', 'EXACT', '2026-02-10', 2026, 'PAPER', 5)
		await finishedBook('B', 'EXACT', '2026-07-12', 2026, 'EBOOK', 4)
		await finishedBook('C', 'YEAR', undefined, 2026, 'AUDIOBOOK', 4.5)
		await finishedBook('D', 'UNKNOWN', undefined, undefined, 'PAPER')

		const yearPeriod = resolveStatsPeriod(
			'YEAR',
			new Date(2026, 5, 1),
			2026,
		)
		const yearSummary = await getSummary(db, yearPeriod)
		expect(yearSummary.booksFinished).toBe(3)
		expect(yearSummary.yearPrecisionBooks).toBe(1)

		const monthly = await getCompletedBooksSeries(db, yearPeriod)
		expect(monthly).not.toBeNull()
		expect(monthly!.exactInMonths).toBe(2)
		expect(monthly!.yearPrecisionOnly).toBe(1)
		expect(monthly!.headlineTotal).toBe(3)
		expect(monthly!.months.reduce((s, m) => s + m.count, 0)).toBe(2)
		expect(monthly!.months[1].count).toBe(1) // February
		expect(monthly!.months[6].count).toBe(1) // July

		const allPeriod = resolveStatsPeriod('ALL', new Date(2026, 5, 1))
		const allSummary = await getSummary(db, allPeriod)
		expect(allSummary.booksFinished).toBe(4)
		expect(allSummary.unknownPrecisionBooks).toBe(1)

		const d30 = resolveStatsPeriod('D30', new Date(2026, 8, 7))
		const d30Summary = await getSummary(db, d30)
		// None of EXACT dates fall in Sep 2026 rolling 30d from Sep 7
		expect(d30Summary.booksFinished).toBe(0)

		const formats = await getFormatStats(db, yearPeriod)
		expect(formats.PAPER).toBe(1)
		expect(formats.EBOOK).toBe(1)
		expect(formats.AUDIOBOOK).toBe(1)

		const ratings = await getRatingStats(db, yearPeriod)
		expect(ratings.ratedCount).toBe(3)
		expect(ratings.average).toBeCloseTo((5 + 4 + 4.5) / 3, 5)
		expect(ratings.finishedCount).toBe(3)
	})
})

describe('cross-service consistency', () => {
	it('calendar / goals / statistics share page and time totals', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReading(db, { page: 100 })
		const today = toDateOnlyLocal()

		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		const started = await startReadingSession(db, entry.id)
		const ended = new Date(Date.now() + 30 * 60 * 1000).toISOString()
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: ended,
			endPage: 130,
		})

		await createGoal(db, {
			type: 'PAGES',
			period: 'DAY',
			targetValue: 50,
		})

		const day = await getDayActivity(db, today)
		const pageDelta = await getPageDeltaInRange(db, today, today)
		const goals = await listGoalProgress(db)
		const series = await getReadingSeries(db, resolveStatsPeriod('D7'))
		const point = series.series.find((p) => p.key === today)

		// quick +10, session end +20 → 30 pages everywhere
		expect(day.pagesRead).toBe(30)
		expect(pageDelta).toBe(30)
		expect(point?.pages).toBe(30)

		const pageGoal = goals.find((g) => g.goal.type === 'PAGES')
		expect(pageGoal?.current).toBe(30)

		expect(day.active).toBe(true)
		expect(day.sessionSeconds).toBeGreaterThanOrEqual(29 * 60)
		expect(point?.seconds).toBe(day.sessionSeconds)

		const summary = await getSummary(db, resolveStatsPeriod('D7'))
		expect(summary.pagesRead).toBe(30)
		expect(summary.readingSeconds).toBe(day.sessionSeconds)
		expect(summary.readingDays).toBeGreaterThanOrEqual(1)
	})
})

describe('daily series timezone grouping', () => {
	it('groups near-midnight event on local day like activity', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReading(db, { page: 10 })
		// Local evening timestamp
		const local = new Date(2026, 8, 6, 23, 30, 0)
		await createProgressEvent(db, {
			libraryEntryId: entry.id,
			type: 'QUICK_UPDATE',
			previousPage: 10,
			newPage: 41,
			createdAt: local.toISOString(),
		})
		await updateLibraryEntry(db, entry.id, { currentPage: 41 })

		const dayKey = toDateOnlyLocal(local)
		const day = await getDayActivity(db, dayKey)
		const series = await getReadingSeries(
			db,
			resolveStatsPeriod('D7', local),
		)
		const point = series.series.find((p) => p.key === dayKey)
		expect(day.pagesRead).toBe(31)
		expect(point?.pages).toBe(31)
	})
})

describe('top books / notes / empty', () => {
	it('ranks top books by session duration only', async () => {
		const db = createTestSqlExecutor()
		const a = await seedReading(db, { title: 'Дюна', page: 1 })
		const b = await seedReading(db, {
			title: '1984',
			page: 1,
			author: 'Оруэлл',
		})

		const s1 = await startReadingSession(db, a.entry.id)
		await finishReadingSession(db, {
			sessionId: s1.session.id,
			endedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			endPage: 20,
		})
		const s2 = await startReadingSession(db, b.entry.id)
		await finishReadingSession(db, {
			sessionId: s2.session.id,
			endedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
			endPage: 5,
		})
		// Huge progress on B without more session time
		await applyQuickProgress(db, b.entry.id, { kind: 'pages', delta: 200 })

		const top = await getTopBooks(db, resolveStatsPeriod('D30'))
		expect(top[0].title).toBe('Дюна')
		expect(top[1].title).toBe('1984')
	})

	it('orders equal-duration top books deterministically', async () => {
		const db = createTestSqlExecutor()
		const first = await seedReading(db, { title: 'Бета', page: 1 })
		const second = await seedReading(db, { title: 'Альфа', page: 1 })

		for (const entry of [first.entry, second.entry]) {
			const session = await startReadingSession(db, entry.id)
			await finishReadingSession(db, {
				sessionId: session.session.id,
				endedAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
				endPage: 10,
			})
		}

		const top = await getTopBooks(db, resolveStatsPeriod('D30'))
		expect(top.map((book) => book.title)).toEqual(['Альфа', 'Бета'])
	})

	it('counts notes by createdAt in period', async () => {
		const db = createTestSqlExecutor()
		const { entry } = await seedReading(db)
		await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Цитата',
		})
		await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'THOUGHT',
			text: 'Мысль',
		})
		await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'NOTE',
			text: 'Заметка',
		})
		const notes = await getNoteStats(db, resolveStatsPeriod('D7'))
		expect(notes.QUOTE).toBe(1)
		expect(notes.THOUGHT).toBe(1)
		expect(notes.NOTE).toBe(1)
	})

	it('empty dashboard has no NaN averages', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const dash = await getStatsDashboard(db, 'D30')
		expect(dash.hasReadingSignal).toBe(false)
		expect(dash.summary.pagesRead).toBe(0)
		expect(dash.sessions.averageSeconds).toBeNull()
		expect(dash.ratings.average).toBeNull()
		expect(Number.isNaN(dash.summary.readingDays)).toBe(false)
	})
})

describe('performance sanity', () => {
	it('aggregates thousands of rows without nested day×event loops hanging', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const started = Date.now()

		// 200 books + events is enough to catch O(days×events) blowups in CI.
		for (let i = 0; i < 200; i += 1) {
			const book = await createBook(db, {
				title: `Book ${i}`,
				authorText: `Author ${i % 17}`,
			})
			const entry = await createLibraryEntry(db, {
				bookId: book.id,
				status: i % 5 === 0 ? 'FINISHED' : 'READING',
				format: i % 3 === 0 ? 'EBOOK' : 'PAPER',
				progressMode: 'PAGES',
				currentPage: 10,
				totalPages: 300,
				finishedDatePrecision: i % 5 === 0 ? 'EXACT' : null,
				finishedOn: i % 5 === 0 ? '2026-03-15' : null,
				finishedYear: i % 5 === 0 ? 2026 : null,
				rating: i % 5 === 0 ? 4 : null,
			})
			for (let j = 0; j < 5; j += 1) {
				const t = new Date(2026, 2, 1 + (i % 28), 10, j, 0)
				await createProgressEvent(db, {
					libraryEntryId: entry.id,
					type: 'QUICK_UPDATE',
					previousPage: 10 + j * 5,
					newPage: 15 + j * 5,
					createdAt: t.toISOString(),
				})
			}
			const sessionStart = new Date(
				2026,
				2,
				2 + (i % 20),
				12,
				0,
				0,
			).toISOString()
			const sessionEnd = new Date(
				2026,
				2,
				2 + (i % 20),
				12,
				25,
				0,
			).toISOString()
			await createReadingSession(db, {
				libraryEntryId: entry.id,
				startedAt: sessionStart,
				endedAt: sessionEnd,
				durationSeconds: 25 * 60,
				endPage: 40,
			})
		}

		const dash = await getStatsDashboard(
			db,
			'YEAR',
			new Date(2026, 8, 1),
			2026,
		)
		expect(dash.summary.pagesRead).toBeGreaterThan(0)
		expect(dash.sessions.count).toBe(200)
		expect(Date.now() - started).toBeLessThan(60_000)
	}, 90_000)
})
