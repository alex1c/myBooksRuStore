import {
	applyMigrations,
	getLatestSchemaVersion,
	getSchemaVersion,
} from '@/db/migrations/applyMigrations'
import { migrations } from '@/db/migrations'
import {
	archiveLibraryEntry,
	createBook,
	createLibraryEntry,
	createReadingNote,
	createReadingSession,
	countActiveLibraryEntries,
	countBooks,
	countNotesForEntry,
	countSessionsForEntry,
	deleteBookHard,
	deleteLibraryEntryHard,
	ensureAppSettings,
	getAppSettings,
	getBookById,
	getLibraryEntryById,
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
	it('migrates an empty database to schema v1', async () => {
		const db = createTestSqlExecutor()
		const version = await applyMigrations(db)

		expect(version).toBe(1)
		expect(version).toBe(getLatestSchemaVersion())
		expect(await getSchemaVersion(db)).toBe(1)

		for (const table of EXPECTED_TABLES) {
			const row = await db.getFirstAsync(
				`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
				[table],
			)
			expect(row).not.toBeNull()
		}
	})

	it('does not corrupt the database when initialization is repeated', async () => {
		const db = createTestSqlExecutor()
		expect(await applyMigrations(db)).toBe(1)
		await ensureAppSettings(db)

		const book = await createBook(db, {
			title: 'Мастер и Маргарита',
			authorText: 'М. Булгаков',
		})

		expect(await applyMigrations(db)).toBe(1)
		expect(await applyMigrations(db)).toBe(1)
		await ensureAppSettings(db)

		expect(await getSchemaVersion(db)).toBe(1)
		expect(await countBooks(db)).toBe(1)
		expect(await getBookById(db, book.id)).toMatchObject({
			title: 'Мастер и Маргарита',
			authorText: 'М. Булгаков',
		})

		const settings = await getAppSettings(db)
		expect(settings.defaultProgressMode).toBe('PAGES')
		expect(settings.reminderEnabled).toBe(false)
	})

	it('registers exactly one Phase 1 migration', () => {
		expect(migrations).toHaveLength(1)
		expect(migrations[0]?.version).toBe(1)
		expect(migrations[0]?.name).toBe('001_initial')
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

	it('preserves sessions and notes when a library entry is archived', async () => {
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

		// Hard delete must fail while history rows still reference the entry.
		await expect(deleteLibraryEntryHard(db, entry.id)).rejects.toThrow()
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
