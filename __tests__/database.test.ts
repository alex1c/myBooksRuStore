import {
	applyMigrations,
	getLatestSchemaVersion,
	getSchemaVersion,
} from '@/db/migrations/applyMigrations'
import { migrations } from '@/db/migrations'
import {
	archiveLibraryEntry,
	countActiveLibraryEntries,
	countBooks,
	countNotesForEntry,
	countSessionsForEntry,
	createBook,
	createLibraryEntry,
	createReadingNote,
	createReadingSession,
	deleteBookHard,
	deleteLibraryEntryHard,
	ensureAppSettings,
	getAppSettings,
	getBookById,
	getLibraryEntryById,
	restoreLibraryEntry,
} from '@/db/repositories'
import {
	isBookFormat,
	isGoalPeriod,
	isGoalType,
	isLibraryStatus,
	isNoteType,
	isProgressMode,
} from '@/constants/domain'
import { createTestSqlExecutor } from './helpers/testDatabase'

const EXPECTED_TABLES = [
	'books',
	'library_entries',
	'reading_sessions',
	'reading_notes',
	'shelves',
	'library_entry_shelves',
	'reading_goals',
	'app_meta',
] as const

describe('database foundation', () => {
	it('migrates an empty database to the latest schema version', async () => {
		const db = createTestSqlExecutor()
		const version = await applyMigrations(db)

		expect(version).toBe(5)
		expect(version).toBe(getLatestSchemaVersion())
		expect(await getSchemaVersion(db)).toBe(5)

		for (const table of EXPECTED_TABLES) {
			const row = await db.getFirstAsync(
				`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
				[table],
			)
			expect(row).not.toBeNull()
		}

		const eventsTable = await db.getFirstAsync(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reading_progress_events'`,
		)
		expect(eventsTable).not.toBeNull()
	})

	it('upgrades a real v1 database to v2 without data loss', async () => {
		const db = createTestSqlExecutor()
		for (const migration of migrations.slice(0, 1)) {
			await db.execAsync(migration.sql)
			await db.runAsync(
				'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
				[migration.version, '2026-09-06T00:00:00.000Z'],
			)
		}

		await db.runAsync(
			`INSERT INTO books (
				id, title, author_text, created_at, updated_at
			) VALUES ('book-1', 'Legacy', 'Author', 'a', 'a')`,
		)
		await db.runAsync(
			`INSERT INTO library_entries (
				id, book_id, status, format, progress_mode, created_at, updated_at
			) VALUES ('lib-1', 'book-1', 'READING', 'PAPER', 'PAGES', 'a', 'a')`,
		)

		expect(await applyMigrations(db)).toBe(5)
		expect(await applyMigrations(db)).toBe(5)

		const book = await db.getFirstAsync<{ title: string }>(
			`SELECT title FROM books WHERE id = 'book-1'`,
		)
		expect(book).toEqual({ title: 'Legacy' })

		const precisionCol = await db.getFirstAsync(
			`SELECT finished_date_precision, finished_year, finished_on
			 FROM library_entries WHERE id = 'lib-1'`,
		)
		expect(precisionCol).not.toBeNull()
	})

	it('does not corrupt the database when initialization is repeated', async () => {
		const db = createTestSqlExecutor()
		expect(await applyMigrations(db)).toBe(5)
		await ensureAppSettings(db)

		const book = await createBook(db, {
			title: 'Мастер и Маргарита',
			authorText: 'М. Булгаков',
		})

		expect(await applyMigrations(db)).toBe(5)
		expect(await applyMigrations(db)).toBe(5)
		await ensureAppSettings(db)

		expect(await getSchemaVersion(db)).toBe(5)
		expect(await countBooks(db)).toBe(1)
		expect(await getBookById(db, book.id)).toMatchObject({
			title: 'Мастер и Маргарита',
			authorText: 'М. Булгаков',
		})

		const settings = await getAppSettings(db)
		expect(settings.defaultProgressMode).toBe('PAGES')
		expect(settings.reminderEnabled).toBe(false)
	})

	it('registers Phase 1–5 migrations', () => {
		expect(migrations).toHaveLength(5)
		expect(migrations[0]?.version).toBe(1)
		expect(migrations[1]?.version).toBe(2)
		expect(migrations[2]?.version).toBe(3)
		expect(migrations[3]?.version).toBe(4)
		expect(migrations[4]?.version).toBe(5)
	})
})

describe('domain enum validation', () => {
	it('accepts known library statuses, formats, and progress modes', () => {
		expect(isLibraryStatus('READING')).toBe(true)
		expect(isLibraryStatus('UNKNOWN')).toBe(false)
		expect(isBookFormat('EBOOK')).toBe(true)
		expect(isBookFormat('PDF')).toBe(false)
		expect(isProgressMode('PERCENT')).toBe(true)
		expect(isProgressMode('CHAPTER')).toBe(false)
		expect(isNoteType('QUOTE')).toBe(true)
		expect(isGoalType('PAGES')).toBe(true)
		expect(isGoalPeriod('YEAR')).toBe(true)
	})
})

describe('repository and foreign-key behavior', () => {
	it('creates books and library entries through the repository layer', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const book = await createBook(db, {
			title: '1984',
			authorText: 'George Orwell',
			isbn13: '9780451524935',
			pageCount: 328,
		})
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
			format: 'PAPER',
			progressMode: 'PAGES',
			currentPage: 40,
			totalPages: 328,
		})

		expect(entry.bookId).toBe(book.id)
		expect(entry.status).toBe('READING')
		expect(await countActiveLibraryEntries(db)).toBe(1)
		expect(await getLibraryEntryById(db, entry.id)).not.toBeNull()
	})

	it('allows books without an author', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const book = await createBook(db, { title: 'Сборник', authorText: '' })
		expect(book.authorText).toBe('')
	})

	it('rejects hard-delete of a book while library entries reference it', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const book = await createBook(db, {
			title: 'Sapiens',
			authorText: 'Yuval Noah Harari',
		})
		await createLibraryEntry(db, { bookId: book.id })

		await expect(deleteBookHard(db, book.id)).rejects.toThrow()
		expect(await getBookById(db, book.id)).not.toBeNull()
	})

	it('preserves sessions and notes when a library entry is archived and restored', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const book = await createBook(db, {
			title: 'Дюна',
			authorText: 'Фрэнк Герберт',
		})
		const entry = await createLibraryEntry(db, {
			bookId: book.id,
			status: 'READING',
		})

		await createReadingSession(db, {
			libraryEntryId: entry.id,
			startedAt: '2026-09-06T10:00:00.000Z',
			endedAt: '2026-09-06T10:30:00.000Z',
			durationSeconds: 1800,
			startPage: 1,
			endPage: 20,
		})
		await createReadingNote(db, {
			libraryEntryId: entry.id,
			type: 'QUOTE',
			text: 'Страх убивает разум.',
			page: 12,
		})

		await archiveLibraryEntry(db, entry.id)

		const archived = await getLibraryEntryById(db, entry.id)
		expect(archived?.archivedAt).not.toBeNull()
		expect(await countActiveLibraryEntries(db)).toBe(0)
		expect(await countSessionsForEntry(db, entry.id)).toBe(1)
		expect(await countNotesForEntry(db, entry.id)).toBe(1)

		await expect(deleteLibraryEntryHard(db, entry.id)).rejects.toThrow()

		await restoreLibraryEntry(db, entry.id)
		expect((await getLibraryEntryById(db, entry.id))?.archivedAt).toBeNull()
		expect(await countActiveLibraryEntries(db)).toBe(1)
	})

	it('enforces foreign keys for library_entry_id on sessions', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		await expect(
			createReadingSession(db, {
				libraryEntryId: 'missing-entry',
				startedAt: '2026-09-06T10:00:00.000Z',
				endedAt: '2026-09-06T10:10:00.000Z',
				durationSeconds: 600,
			}),
		).rejects.toThrow()
	})
})
