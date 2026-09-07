/**
 * Phase 8 — Year in Books aggregate + share model.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	createBook,
	createLibraryEntry,
	createReadingNote,
	createReadingSession,
} from '@/db/repositories'
import {
	getActivityForRange,
	getBestStreakInYear,
} from '@/domain/activityService'
import {
	applyQuickProgress,
	finishReadingSession,
	startReadingSession,
	undoProgressEvent,
} from '@/domain/readingTrackerService'
import { getSummary } from '@/domain/statisticsService'
import {
	buildYearShareCardModel,
	getYearInBooks,
	pickBestMonth,
} from '@/domain/yearInBooksService'
import {
	formatBooksCount,
	formatDaysCount,
	formatHoursCount,
	formatIntegerRu,
	formatPagesCount,
} from '@/utils/format'
import { resolveStatsPeriod } from '@/utils/statsPeriod'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function migrate (db: ReturnType<typeof createTestSqlExecutor>) {
	await applyMigrations(db)
}

describe('pickBestMonth', () => {
	it('prefers higher score and earlier month on ties', () => {
		const months = [
			{ monthIndex: 0, seconds: 100, pages: 10, booksExact: 1 },
			{ monthIndex: 1, seconds: 200, pages: 5, booksExact: 0 },
			{ monthIndex: 2, seconds: 200, pages: 50, booksExact: 2 },
		]
		const byTime = pickBestMonth(months, 'time')
		// Tie 200s → earlier month (January index 1 wins over 2)
		expect(byTime?.monthIndex).toBe(1)
		const byPages = pickBestMonth(months, 'pages')
		expect(byPages?.monthIndex).toBe(2)
	})
})

describe('Year in Books aggregate', () => {
	it('returns empty year without fake metrics', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const year = await getYearInBooks(db, 2024)
		expect(year.hasData).toBe(false)
		expect(year.completedBooks).toBe(0)
		expect(year.pages.hasObservations).toBe(false)
		expect(year.readingTime.hasObservations).toBe(false)
		expect(year.sessions.averageSeconds).toBeNull()
		expect(Number.isNaN(year.activeDays)).toBe(false)
	})

	it('applies EXACT / YEAR / UNKNOWN book semantics', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)

		async function finished (
			title: string,
			precision: 'EXACT' | 'YEAR' | 'UNKNOWN',
			finishedOn?: string,
			finishedYear?: number,
			author = 'Достоевский',
		) {
			const book = await createBook(db, { title, authorText: author })
			return createLibraryEntry(db, {
				bookId: book.id,
				status: 'FINISHED',
				format: 'PAPER',
				progressMode: 'PAGES',
				finishedDatePrecision: precision,
				finishedOn: finishedOn ?? null,
				finishedYear: finishedYear ?? null,
				rating: 4.5,
			})
		}

		await finished('A', 'EXACT', '2026-02-10', 2026)
		await finished('B', 'EXACT', '2026-07-12', 2026, 'Толстой')
		await finished('C', 'YEAR', undefined, 2026)
		await finished('D', 'UNKNOWN')

		const y = await getYearInBooks(db, 2026)
		expect(y.completedBooks).toBe(3)
		expect(y.exactMonthlyBooks).toBe(2)
		expect(y.yearPrecisionBooks).toBe(1)
		expect(y.monthlyBooks.reduce((s, m) => s + m.count, 0)).toBe(2)

		expect(y.topAuthor?.authorText).toBe('Достоевский')
		expect(y.topAuthor?.bookCount).toBe(2)
	})

	it('matches statistics YEAR for books/pages/time/days', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const book = await createBook(db, { title: 'Книга', authorText: 'А' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			progressMode: 'PAGES',
			currentPage: 100,
			totalPages: 400,
		})

		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })
		const started = await startReadingSession(db, entry.id)
		await finishReadingSession(db, {
			sessionId: started.session.id,
			endedAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
			endPage: 130,
		})

		const now = new Date()
		const year = now.getFullYear()
		const period = resolveStatsPeriod('YEAR', now, year)
		const summary = await getSummary(db, period)
		const yib = await getYearInBooks(db, year)

		expect(yib.completedBooks).toBe(summary.booksFinished)
		expect(yib.pages.value).toBe(summary.pagesRead)
		expect(yib.readingTime.value).toBe(summary.readingSeconds)
		expect(yib.activeDays).toBe(summary.readingDays)
	})

	it('nets undo/corrections same as statistics pages', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const book = await createBook(db, { title: 'X', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			progressMode: 'PAGES',
			currentPage: 100,
			totalPages: 400,
		})
		const first = await applyQuickProgress(db, entry.id, {
			kind: 'pages',
			delta: 25,
		})
		await undoProgressEvent(db, first.event.id)
		await applyQuickProgress(db, entry.id, { kind: 'pages', delta: 10 })

		const year = new Date().getFullYear()
		const period = resolveStatsPeriod('YEAR', new Date(), year)
		const summary = await getSummary(db, period)
		const yib = await getYearInBooks(db, year)
		expect(yib.pages.value).toBe(10)
		expect(yib.pages.value).toBe(summary.pagesRead)
		expect(yib.pages.hasObservations).toBe(true)
	})

	it('clips best streak to selected year', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const book = await createBook(db, { title: 'S', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			progressMode: 'PAGES',
			currentPage: 1,
			totalPages: 100,
		})

		const days = [
			'2025-12-30',
			'2025-12-31',
			'2026-01-01',
			'2026-01-02',
			'2026-01-03',
		]
		for (const day of days) {
			const started = `${day}T12:00:00.000`
			// Construct local noon ISO via Date
			const [y, m, d] = day.split('-').map(Number)
			const local = new Date(y!, m! - 1, d!, 12, 0, 0)
			await createReadingSession(db, {
				libraryEntryId: entry.id,
				startedAt: local.toISOString(),
				endedAt: new Date(local.getTime() + 20 * 60 * 1000).toISOString(),
				durationSeconds: 20 * 60,
			})
			void started
		}

		expect(await getBestStreakInYear(db, 2026)).toBe(3)

		const yib = await getYearInBooks(db, 2026)
		expect(yib.bestStreakInYear).toBe(3)
		expect(yib.activeDays).toBe(3)

		const map = await getActivityForRange(db, '2026-01-01', '2026-01-03')
		expect([...map.values()].filter((d) => d.active).length).toBe(3)
	})

	it('ignores empty author for top author', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const b1 = await createBook(db, { title: 'One', authorText: '   ' })
		await createLibraryEntry(db, {
			bookId: b1.id,
			status: 'FINISHED',
			format: 'PAPER',
			progressMode: 'PAGES',
			finishedDatePrecision: 'EXACT',
			finishedOn: '2026-03-01',
		})
		const b2 = await createBook(db, {
			title: 'Two',
			authorText: 'Чехов',
		})
		await createLibraryEntry(db, {
			bookId: b2.id,
			status: 'FINISHED',
			format: 'EBOOK',
			progressMode: 'PAGES',
			finishedDatePrecision: 'YEAR',
			finishedYear: 2026,
			rating: 5,
		})

		const y = await getYearInBooks(db, 2026)
		expect(y.topAuthor?.authorText).toBe('Чехов')
		expect(y.favoriteFormat?.count).toBe(1)
		expect(['PAPER', 'EBOOK']).toContain(y.favoriteFormat?.format)
		expect(y.ratings.average).toBe(5)
		expect(y.ratings.ratedCount).toBe(1)
	})

	it('counts notes in selected year only', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const book = await createBook(db, { title: 'N', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			progressMode: 'PAGES',
		})
		await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Цитата года',
		})
		// Old note via raw insert with 2024 timestamp
		const old = await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'THOUGHT',
			text: 'Старая',
		})
		await db.runAsync(
			`UPDATE reading_notes SET created_at = ? WHERE id = ?`,
			['2024-06-01T12:00:00.000Z', old.id],
		)

		const year = new Date().getFullYear()
		const y = await getYearInBooks(db, year)
		expect(y.notes.QUOTE).toBe(1)
		expect(y.notes.THOUGHT).toBe(0)
		expect(y.quoteSample?.text).toBe('Цитата года')
	})

	it('share model omits private notes and unavailable metrics', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const book = await createBook(db, {
			title: 'Секрет',
			authorText: 'А',
			pageCount: 900,
		})
		await createLibraryEntry(db, {
			bookId: book.id,
			status: 'FINISHED',
			format: 'PAPER',
			progressMode: 'PAGES',
			finishedDatePrecision: 'EXACT',
			finishedOn: '2026-04-01',
			rating: 5,
		})
		const entry = await createLibraryEntry(db, {
			bookId: (
				await createBook(db, { title: 'Reading', authorText: 'B' })
			).id,
			status: 'READING',
			progressMode: 'PAGES',
			currentPage: 1,
			totalPages: 100,
		})
		await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Приватная цитата не для шаринга',
		})

		const y = await getYearInBooks(db, 2026)
		const share = buildYearShareCardModel(y, {
			books: formatBooksCount,
			pages: formatPagesCount,
			hours: formatHoursCount,
			days: formatDaysCount,
			streak: (n) => `${formatIntegerRu(n)} дн.`,
		})
		expect(share.title).toBe('Мой 2026 год')
		expect(share.brand).toBe('Дневник чтения')
		expect(share.textFallback).not.toContain('Приватная')
		expect(share.lines.some((l) => l.label === 'Книги')).toBe(true)
		// No page/time observations → omitted
		expect(share.lines.some((l) => l.label === 'Страницы')).toBe(false)
		expect(share.lines.some((l) => l.label === 'Время')).toBe(false)
	})

	it('partial time-only year hides pages highlight', async () => {
		const db = createTestSqlExecutor()
		await migrate(db)
		const book = await createBook(db, { title: 'Timer', authorText: 'A' })
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			progressMode: 'PAGES',
			currentPage: 10,
			totalPages: 200,
		})
		const local = new Date(2026, 5, 10, 12, 0, 0)
		await createReadingSession(db, {
			libraryEntryId: entry.id,
			startedAt: local.toISOString(),
			endedAt: new Date(local.getTime() + 45 * 60 * 1000).toISOString(),
			durationSeconds: 45 * 60,
		})

		const y = await getYearInBooks(db, 2026)
		expect(y.readingTime.hasObservations).toBe(true)
		expect(y.readingTime.value).toBe(45 * 60)
		expect(y.pages.hasObservations).toBe(false)
		expect(y.bestMonthByTime?.monthIndex).toBe(5)
	})
})
