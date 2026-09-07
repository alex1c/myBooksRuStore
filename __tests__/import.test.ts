/**
 * Phase 10 — mass library CSV import pipeline.
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	createBook,
	createLibraryEntry,
	ensureAppSettings,
	listActiveLibraryEntries,
	listActiveShelves,
} from '@/db/repositories'
import { getStreakSummary } from '@/domain/activityService'
import { buildLibraryCsv } from '@/domain/export/csvExport'
import {
	applyDuplicatePolicy,
	autoMapHeaders,
	detectImportFormat,
	ImportParseError,
	mappingHasTitle,
	parseCsv,
	prepareImportFromCsvText,
	runImportCommit,
} from '@/domain/import/importService'
import {
	normalizeFormat,
	normalizeRating,
	normalizeStatus,
	unwrapSpreadsheetLiteral,
} from '@/domain/import/normalize'
import { getSummary } from '@/domain/statisticsService'
import { getYearInBooks } from '@/domain/yearInBooksService'
import { resolveStatsPeriod } from '@/utils/statsPeriod'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function emptyDb () {
	const db = createTestSqlExecutor()
	await applyMigrations(db)
	await ensureAppSettings(db)
	return db
}

describe('CSV parser', () => {
	it('detects semicolon / comma / tab delimiters', () => {
		expect(parseCsv('a;b\n1;2').delimiter).toBe(';')
		expect(parseCsv('a,b\n1,2').delimiter).toBe(',')
		expect(parseCsv('a\tb\n1\t2').delimiter).toBe('\t')
	})

	it('strips UTF-8 BOM', () => {
		const table = parseCsv('\uFEFFНазвание;Автор\nДюна;Герберт')
		expect(table.headers[0]).toBe('Название')
		expect(table.rows[0]![0]).toBe('Дюна')
	})

	it('handles quoted delimiter, multiline, escaped quotes, Cyrillic', () => {
		const csv =
			'Название;Отзыв\n' +
			'"Дюна";"Первая строка\nВторая; строка\n""цитата"""\n'
		const table = parseCsv(csv)
		expect(table.rows).toHaveLength(1)
		expect(table.rows[0]![0]).toBe('Дюна')
		expect(table.rows[0]![1]).toBe(
			'Первая строка\nВторая; строка\n"цитата"',
		)
	})
})

describe('format detection', () => {
	it('detects our CSV, Goodreads, generic, unknown', () => {
		expect(
			detectImportFormat([
				'Название',
				'Автор',
				'Статус',
				'Формат',
				'Режим прогресса',
				'Текущий прогресс',
				'Общий объём',
				'Дата начала',
				'Дата прочтения',
				'Точность даты',
				'Оценка',
				'Полки',
				'ISBN-10',
				'ISBN-13',
				'Издательство',
				'Год издания',
				'Отзыв',
			]),
		).toBe('MYBOOKS_CSV')

		expect(
			detectImportFormat([
				'Title',
				'Author',
				'ISBN',
				'ISBN13',
				'Exclusive Shelf',
				'My Rating',
			]),
		).toBe('GOODREADS_CSV')

		expect(detectImportFormat(['Title', 'Author', 'Pages'])).toBe(
			'GENERIC_CSV',
		)
		expect(detectImportFormat(['ColA', 'ColB'])).toBe('UNKNOWN')
	})
})

describe('header mapping', () => {
	it('auto-maps Russian and English case-insensitively', () => {
		const ru = autoMapHeaders(['НАЗВАНИЕ', 'Автор', 'Статус', 'ISBN'])
		expect(ru.title).toBe('НАЗВАНИЕ')
		expect(ru.author).toBe('Автор')
		expect(ru.status).toBe('Статус')

		const en = autoMapHeaders([
			'Book Title',
			'AUTHOR',
			'My Rating',
			'Page Count',
		])
		expect(en.title).toBe('Book Title')
		expect(en.author).toBe('AUTHOR')
		expect(en.rating).toBe('My Rating')
		expect(en.totalVolume).toBe('Page Count')
	})

	it('requires title mapping', () => {
		expect(mappingHasTitle(autoMapHeaders(['Author', 'Pages']))).toBe(
			false,
		)
	})
})

describe('normalization', () => {
	it('maps statuses, formats, rating, ISBN wrappers', () => {
		expect(normalizeStatus('currently-reading').value).toBe('READING')
		expect(normalizeStatus('xyz').value).toBe('WANT_TO_READ')
		expect(normalizeStatus('xyz').warning).toMatch(/не распознан/i)

		expect(normalizeFormat('kindle').value).toBe('EBOOK')
		expect(normalizeFormat('weird').warning).toBeTruthy()

		expect(normalizeRating('4.5').value).toBe(4.5)
		expect(normalizeRating('9').value).toBeNull()
		expect(normalizeRating('9').warning).toMatch(/0–5/)

		expect(unwrapSpreadsheetLiteral(`'=SUM(A1)`)).toBe('=SUM(A1)')
		expect(unwrapSpreadsheetLiteral('="9780441172719"')).toBe(
			'9780441172719',
		)
	})
})

describe('Goodreads import', () => {
	it('maps Exclusive Shelf, Bookshelves, rating, Date Read, ISBN ="..."', async () => {
		const db = await emptyDb()
		const csv = [
			'Title,Author,ISBN,ISBN13,My Rating,Number of Pages,Date Read,Exclusive Shelf,Bookshelves,My Review,Publisher,Year Published',
			'"Dune","Herbert",="0441172717",="9780441172719",5,600,2024/01/15,read,"sci-fi, classics","Great",Ace,1965',
			'"Unread","Someone","","",0,100,,to-read,wishlist,,,',
		].join('\n')

		const prepared = await prepareImportFromCsvText(db, csv)
		expect(prepared.format).toBe('GOODREADS_CSV')
		expect(prepared.candidates).toHaveLength(2)

		const dune = prepared.candidates[0]!
		expect(dune.title).toBe('Dune')
		expect(dune.status).toBe('FINISHED')
		expect(dune.rating).toBe(5)
		expect(dune.isbn13).toBe('9780441172719')
		expect(dune.finishedDatePrecision).toBe('EXACT')
		expect(dune.finishedOn).toBe('2024-01-15')
		expect(dune.shelves).toEqual(
			expect.arrayContaining(['sci-fi', 'classics']),
		)
		expect(dune.shelves).not.toContain('read')

		const unread = prepared.candidates[1]!
		expect(unread.status).toBe('WANT_TO_READ')
		expect(unread.shelves).toEqual(['wishlist'])
		expect(unread.shelves).not.toContain('to-read')
	})
})

describe('duplicates', () => {
	it('detects ISBN and title+author vs library and within-file', async () => {
		const db = await emptyDb()
		const book = await createBook(db, {
			title: 'Existing',
			authorText: 'Author',
			isbn13: '9780441172719',
		})
		await createLibraryEntry(db, {
			bookId: book.id,
			status: 'FINISHED',
			format: 'PAPER',
			progressMode: 'PAGES',
			finishedDatePrecision: 'UNKNOWN',
		})

		const b2 = await createBook(db, {
			title: 'Same Title',
			authorText: 'Same Author',
		})
		await createLibraryEntry(db, {
			bookId: b2.id,
			status: 'WANT_TO_READ',
			format: 'PAPER',
			progressMode: 'PAGES',
		})

		const csv = [
			'Title;Author;ISBN-13',
			'Dune;Herbert;9780441172719',
			'Same Title;Same Author;',
			'File Only;Only;',
			'File Only;Only;',
			'Other;Edition;9780000000000',
			'Different ISBN same title;Herbert;9781111111111',
		].join('\n')

		const prepared = await prepareImportFromCsvText(db, csv)
		const kinds = prepared.candidates.map((c) => c.duplicateKind)
		expect(kinds[0]).toBe('EXISTING_LIBRARY')
		expect(kinds[1]).toBe('EXISTING_LIBRARY')
		expect(kinds[2]).toBeNull()
		expect(kinds[3]).toBe('WITHIN_FILE')
		expect(kinds[4]).toBeNull()
		expect(kinds[5]).toBeNull()
	})

	it('supports skip vs add-edition policies', async () => {
		const db = await emptyDb()
		const book = await createBook(db, {
			title: 'Dup',
			authorText: 'A',
			isbn13: '9780441172719',
		})
		await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
		})

		const csv = 'Title;Author;ISBN-13\nDup;A;9780441172719\n'
		const prepared = await prepareImportFromCsvText(db, csv)
		expect(prepared.candidates[0]!.selected).toBe(false)
		expect(prepared.candidates[0]!.policy).toBe('SKIP')

		const added = applyDuplicatePolicy(prepared.candidates, 'ADD_EDITION')
		expect(added[0]!.selected).toBe(true)
		expect(added[0]!.policy).toBe('ADD_EDITION')

		const report = await runImportCommit(db, added)
		expect(report.added).toBe(1)
		const entries = await listActiveLibraryEntries(db)
		expect(entries).toHaveLength(2)
	})

	it('duplicate batch A B A C B is deterministic first-wins', async () => {
		const db = await emptyDb()
		const csv = [
			'Title;Author',
			'A;x',
			'B;x',
			'A;x',
			'C;x',
			'B;x',
		].join('\n')
		const prepared = await prepareImportFromCsvText(db, csv)
		expect(
			prepared.candidates.map((c) => [
				c.title,
				c.duplicateKind,
				c.selected,
			]),
		).toEqual([
			['A', null, true],
			['B', null, true],
			['A', 'WITHIN_FILE', false],
			['C', null, true],
			['B', 'WITHIN_FILE', false],
		])
	})
})

describe('invalid rows', () => {
	it('skips missing title; warns on bad rating/date/unknown status', async () => {
		const db = await emptyDb()
		const csv = [
			'Title;Author;Status;Rating;Date Read',
			';Someone;read;9;not-a-date',
			'Ok;Auth;mystery;4;2020-01-01',
			'Finished;A;Прочитано;5;',
		].join('\n')
		const prepared = await prepareImportFromCsvText(db, csv)
		expect(prepared.candidates[0]!.valid).toBe(false)
		expect(prepared.candidates[0]!.errors[0]).toMatch(/название/i)

		expect(prepared.candidates[1]!.valid).toBe(true)
		expect(prepared.candidates[1]!.warnings.join(' ')).toMatch(/Статус/)
		expect(prepared.candidates[1]!.rating).toBe(4)

		expect(prepared.candidates[2]!.status).toBe('FINISHED')
		expect(prepared.candidates[2]!.finishedDatePrecision).toBe('UNKNOWN')
		expect(prepared.candidates[2]!.warnings.join(' ')).toMatch(/Дата/)
	})
})

describe('commit + shelves + historical safety', () => {
	it('imports atomically with shelves; creates no sessions/events/streak', async () => {
		const db = await emptyDb()
		const csv = [
			'Title;Author;Status;Shelves;Date Read;ISBN-13',
			'One;A;Прочитано;Sci-Fi, sci-fi;2024-06-01;9781111111111',
			'Two;B;Читаю;Fantasy;;9782222222222',
		].join('\n')

		const prepared = await prepareImportFromCsvText(db, csv)
		const report = await runImportCommit(db, prepared.candidates)
		expect(report.added).toBe(2)
		expect(report.shelvesCreated).toBe(2)

		const shelves = await listActiveShelves(db)
		expect(shelves.map((s) => s.name).sort()).toEqual([
			'Fantasy',
			'Sci-Fi',
		])

		const events = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM reading_progress_events`,
		)
		const sessions = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM reading_sessions`,
		)
		expect(events?.c).toBe(0)
		expect(sessions?.c).toBe(0)

		const streak = await getStreakSummary(db)
		expect(streak.current).toBe(0)
		expect(streak.best).toBe(0)
	})

	it('rolls back entire commit on unexpected DB error', async () => {
		const db = await emptyDb()
		const before = await createBook(db, {
			title: 'Keep',
			authorText: 'Me',
		})
		await createLibraryEntry(db, {
			bookId: before.id,
			status: 'WANT_TO_READ',
			format: 'PAPER',
			progressMode: 'PAGES',
		})

		const lines = ['Title;Author']
		for (let i = 0; i < 500; i += 1) {
			lines.push(`Book ${i};Author ${i}`)
		}
		const prepared = await prepareImportFromCsvText(db, lines.join('\n'))
		expect(prepared.candidates.filter((c) => c.selected)).toHaveLength(500)

		let inserts = 0
		const original = db.runAsync.bind(db)
		db.runAsync = async (sql, params) => {
			if (typeof sql === 'string' && sql.includes('INSERT INTO books')) {
				inserts += 1
				if (inserts === 250) {
					throw new Error('INJECTED_FAILURE')
				}
			}
			return original(sql, params)
		}

		await expect(runImportCommit(db, prepared.candidates)).rejects.toThrow(
			'INJECTED_FAILURE',
		)

		const books = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM books WHERE archived_at IS NULL`,
		)
		const entries = await db.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM library_entries WHERE archived_at IS NULL`,
		)
		expect(books?.c).toBe(1)
		expect(entries?.c).toBe(1)
	})
})

describe('statistics precision after import', () => {
	it('EXACT / YEAR / UNKNOWN affect completed counts without page totals', async () => {
		const db = await emptyDb()
		const csv = [
			'Title;Author;Status;Date Read;Точность даты;Общий объём',
			'Exact;A;Прочитано;2026-03-01;Точная дата;400',
			'YearOnly;B;Прочитано;2026;Только год;300',
			'Unknown;C;Прочитано;;Дата неизвестна;200',
		].join('\n')

		const prepared = await prepareImportFromCsvText(db, csv)
		await runImportCommit(db, prepared.candidates)

		const yearPeriod = resolveStatsPeriod(
			'YEAR',
			new Date('2026-06-01T12:00:00'),
			2026,
		)
		const yearStats = await getSummary(db, yearPeriod)
		expect(yearStats.booksFinished).toBeGreaterThanOrEqual(2)
		expect(yearStats.pagesRead).toBe(0)

		const allStats = await getSummary(
			db,
			resolveStatsPeriod('ALL', new Date('2026-06-01T12:00:00')),
		)
		expect(allStats.booksFinished).toBe(3)
		expect(allStats.pagesRead).toBe(0)

		const yib = await getYearInBooks(db, 2026)
		expect(yib.completedBooks).toBeGreaterThanOrEqual(2)
		expect(yib.pages.hasObservations).toBe(false)
		expect(yib.readingTime.hasObservations).toBe(false)
		expect(yib.activeDays).toBe(0)
	})
})

describe('our CSV round-trip', () => {
	it('export → import restores library fields (not sessions/notes/goals)', async () => {
		const source = await emptyDb()
		const book = await createBook(source, {
			title: 'Дюна',
			authorText: 'Фрэнк Герберт',
			isbn13: '9780441172719',
			publisher: 'Ace',
			publishedYear: 1965,
			pageCount: 600,
		})
		await createLibraryEntry(source, {
			bookId: book.id,
			status: 'FINISHED',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 600,
			totalPages: 600,
			finishedDatePrecision: 'EXACT',
			finishedOn: '2025-11-02',
			rating: 5,
			reviewText: 'Отзыв с "кавычками"; и\nпереносом',
		})

		const csv = await buildLibraryCsv(source)
		const target = await emptyDb()
		const prepared = await prepareImportFromCsvText(target, csv)
		expect(prepared.format).toBe('MYBOOKS_CSV')
		expect(prepared.candidates[0]!.title).toBe('Дюна')
		expect(prepared.candidates[0]!.authorText).toBe('Фрэнк Герберт')
		expect(prepared.candidates[0]!.status).toBe('FINISHED')
		expect(prepared.candidates[0]!.isbn13).toBe('9780441172719')
		expect(prepared.candidates[0]!.finishedOn).toBe('2025-11-02')
		expect(prepared.candidates[0]!.rating).toBe(5)

		await runImportCommit(target, prepared.candidates)
		const entries = await listActiveLibraryEntries(target)
		expect(entries).toHaveLength(1)
		expect(entries[0]!.status).toBe('FINISHED')
		expect(entries[0]!.rating).toBe(5)
		expect(entries[0]!.finishedOn).toBe('2025-11-02')

		const sessions = await target.getFirstAsync<{ c: number }>(
			`SELECT COUNT(*) AS c FROM reading_sessions`,
		)
		expect(sessions?.c).toBe(0)
	})
})

describe('mass import fixture', () => {
	it('handles 1000 rows with duplicates and invalids', async () => {
		const db = await emptyDb()
		for (let i = 0; i < 100; i += 1) {
			const book = await createBook(db, {
				title: `Existing ${i}`,
				authorText: 'Lib',
				isbn13: `9780000000${String(i).padStart(3, '0')}`,
			})
			await createLibraryEntry(db, {
				bookId: book.id,
				status: 'WANT_TO_READ',
				format: 'PAPER',
				progressMode: 'PAGES',
			})
		}

		const lines = ['Title;Author;ISBN-13;Shelves;Status']
		for (let i = 0; i < 1000; i += 1) {
			if (i < 20) {
				lines.push(`;Bad;9789999999${String(i).padStart(3, '0')};;`)
				continue
			}
			const isbn =
				i < 120
					? `9780000000${String(i - 20).padStart(3, '0')}`
					: `9781000000${String(i).padStart(3, '0')}`
			const title = i < 120 ? `Existing ${i - 20}` : `New ${i}`
			lines.push(`${title};Lib;${isbn};Shelf-${i % 5};Хочу прочитать`)
		}

		const prepared = await prepareImportFromCsvText(db, lines.join('\n'))
		expect(prepared.summary.errorCount).toBe(20)
		expect(prepared.summary.duplicateCount).toBeGreaterThanOrEqual(100)

		const report = await runImportCommit(db, prepared.candidates)
		expect(report.errorRows).toBe(20)
		expect(report.added).toBe(
			prepared.candidates.filter((c) => c.selected).length,
		)
		expect(report.added).toBeGreaterThan(800)
	})
})

describe('limits', () => {
	it('rejects oversized row count', () => {
		const lines = ['Title']
		for (let i = 0; i < 20_001; i += 1) {
			lines.push(`T${i}`)
		}
		expect(() => parseCsv(lines.join('\n'))).toThrow(ImportParseError)
	})
})
