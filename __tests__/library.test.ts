import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	LIBRARY_STATUSES,
	type LibraryStatus,
} from '@/constants/domain'
import {
	countBooks,
	createShelf,
	getLibraryEntryById,
	listActiveShelves,
	listShelfIdsForEntry,
	renameShelf,
	archiveShelf,
} from '@/db/repositories'
import {
	addBookToLibrary,
	archiveLibraryBook,
	findLibraryDuplicates,
	getLibraryBookByEntryId,
	listLibraryBooks,
	restoreLibraryBook,
	updateLibraryBook,
} from '@/domain/libraryService'
import {
	validateProgress,
	validateRating,
} from '@/domain/libraryValidation'
import { resolveFinishedFields } from '@/db/repositories/libraryEntries'
import { createTestSqlExecutor } from './helpers/testDatabase'

describe('library CRUD service', () => {
	it('creates, reads, updates, archives and restores a library book', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const created = await addBookToLibrary(db, {
			book: { title: 'Идиот', authorText: 'Ф. Достоевский' },
			entry: {
				status: 'WANT_TO_READ',
				format: 'PAPER',
				progressMode: 'PAGES',
			},
		})

		expect(created.book.title).toBe('Идиот')
		expect(created.entry.status).toBe('WANT_TO_READ')

		const loaded = await getLibraryBookByEntryId(db, created.entry.id)
		expect(loaded?.book.authorText).toBe('Ф. Достоевский')

		const updated = await updateLibraryBook(db, {
			entryId: created.entry.id,
			book: { title: 'Идиот', authorText: 'Фёдор Достоевский' },
			entry: {
				status: 'READING',
				currentPage: 50,
				totalPages: 600,
			},
		})
		expect(updated.book.authorText).toBe('Фёдор Достоевский')
		expect(updated.entry.status).toBe('READING')
		expect(updated.entry.currentPage).toBe(50)

		await archiveLibraryBook(db, created.entry.id)
		expect(
			(await listLibraryBooks(db, { archived: false })).some(
				(item) => item.entry.id === created.entry.id,
			),
		).toBe(false)
		expect(
			(await listLibraryBooks(db, { archived: true })).some(
				(item) => item.entry.id === created.entry.id,
			),
		).toBe(true)

		await restoreLibraryBook(db, created.entry.id)
		expect(
			(await listLibraryBooks(db, {})).some(
				(item) => item.entry.id === created.entry.id,
			),
		).toBe(true)
	})

	it('persists every library status', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		for (const status of LIBRARY_STATUSES) {
			const finished =
				status === 'FINISHED'
					? {
						finishedDatePrecision: 'UNKNOWN' as const,
						finishedOn: null,
						finishedYear: null,
					}
					: {}
			const created = await addBookToLibrary(db, {
				book: { title: `Book ${status}`, authorText: 'Author' },
				entry: { status, ...finished },
			})
			const loaded = await getLibraryEntryById(db, created.entry.id)
			expect(loaded?.status).toBe(status as LibraryStatus)
		}
	})
})

describe('progress validation and modes', () => {
	it('validates PAGES / PERCENT / TIME boundaries', () => {
		expect(
			validateProgress({
				progressMode: 'PAGES',
				currentPage: 10,
				totalPages: 5,
			}),
		).not.toBeNull()
		expect(
			validateProgress({
				progressMode: 'PAGES',
				currentPage: 10,
				totalPages: 20,
			}),
		).toBeNull()
		expect(
			validateProgress({ progressMode: 'PERCENT', currentPercent: 101 }),
		).not.toBeNull()
		expect(
			validateProgress({ progressMode: 'PERCENT', currentPercent: 42.5 }),
		).toBeNull()
		expect(
			validateProgress({
				progressMode: 'TIME',
				audioPositionSeconds: 100,
				audioDurationSeconds: 50,
			}),
		).not.toBeNull()
		expect(
			validateProgress({
				progressMode: 'TIME',
				audioPositionSeconds: 90,
				audioDurationSeconds: 120,
			}),
		).toBeNull()
	})

	it('stores PAGES, PERCENT and TIME progress', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const pages = await addBookToLibrary(db, {
			book: { title: 'Paper', authorText: 'A' },
			entry: {
				format: 'PAPER',
				progressMode: 'PAGES',
				currentPage: 12,
				totalPages: 100,
			},
		})
		expect(pages.entry.currentPage).toBe(12)

		const percent = await addBookToLibrary(db, {
			book: { title: 'Ebook', authorText: 'A' },
			entry: {
				format: 'EBOOK',
				progressMode: 'PERCENT',
				currentPercent: 33,
			},
		})
		expect(percent.entry.currentPercent).toBe(33)

		const time = await addBookToLibrary(db, {
			book: { title: 'Audio', authorText: 'A' },
			entry: {
				format: 'AUDIOBOOK',
				progressMode: 'TIME',
				audioPositionSeconds: 5040,
				audioDurationSeconds: 28800,
			},
		})
		expect(time.entry.audioPositionSeconds).toBe(5040)
	})
})

describe('finished date precision', () => {
	it('keeps EXACT / YEAR / UNKNOWN semantically distinct', () => {
		expect(
			resolveFinishedFields({
				status: 'FINISHED',
				finishedDatePrecision: 'EXACT',
				finishedOn: '2024-05-01',
			}),
		).toMatchObject({
			finishedDatePrecision: 'EXACT',
			finishedOn: '2024-05-01',
			finishedYear: null,
		})

		expect(
			resolveFinishedFields({
				status: 'FINISHED',
				finishedDatePrecision: 'YEAR',
				finishedYear: 2019,
			}),
		).toEqual({
			finishedAt: null,
			finishedDatePrecision: 'YEAR',
			finishedYear: 2019,
			finishedOn: null,
		})

		const unknown = resolveFinishedFields({
			status: 'FINISHED',
			finishedDatePrecision: 'UNKNOWN',
		})
		expect(unknown.finishedAt).toBeNull()
		expect(unknown.finishedOn).toBeNull()
		expect(unknown.finishedYear).toBeNull()
		expect(unknown.finishedDatePrecision).toBe('UNKNOWN')
	})

	it('does not treat UNKNOWN as finished today when saving', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		const created = await addBookToLibrary(db, {
			book: { title: 'Old book', authorText: 'A' },
			entry: {
				status: 'FINISHED',
				finishedDatePrecision: 'UNKNOWN',
			},
		})
		expect(created.entry.finishedDatePrecision).toBe('UNKNOWN')
		expect(created.entry.finishedOn).toBeNull()
		expect(created.entry.finishedAt).toBeNull()
	})
})

describe('rating', () => {
	it('accepts half-step ratings and rejects invalid values', () => {
		expect(validateRating(0.5)).toBeNull()
		expect(validateRating(4.5)).toBeNull()
		expect(validateRating(5)).toBeNull()
		expect(validateRating(4.25)).not.toBeNull()
		expect(validateRating(6)).not.toBeNull()
		expect(validateRating(-1)).not.toBeNull()
	})
})

describe('duplicates', () => {
	it('detects similar title+author and ISBN matches', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		await addBookToLibrary(db, {
			book: {
				title: 'Война и мир',
				authorText: 'Л. Толстой',
				isbn13: '9780140447934',
			},
			entry: { status: 'WANT_TO_READ' },
		})

		const byTitle = await findLibraryDuplicates(db, {
			title: 'война и мир',
			authorText: 'л. толстой',
		})
		expect(byTitle.hasDuplicates).toBe(true)

		const byIsbn = await findLibraryDuplicates(db, {
			title: 'Другое название',
			authorText: 'Кто-то',
			isbn13: '978-0-14-044793-4',
		})
		expect(byIsbn.hasDuplicates).toBe(true)
	})
})

describe('shelves', () => {
	it('creates, renames, attaches, detaches and archives shelves', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		const shelf = await createShelf(db, 'Любимые')
		expect(shelf.name).toBe('Любимые')

		await renameShelf(db, shelf.id, 'Классика')
		expect((await listActiveShelves(db))[0]?.name).toBe('Классика')

		const created = await addBookToLibrary(db, {
			book: { title: 'Книга', authorText: 'Автор' },
			entry: {},
			shelfIds: [shelf.id],
		})
		expect(await listShelfIdsForEntry(db, created.entry.id)).toEqual([
			shelf.id,
		])

		await updateLibraryBook(db, {
			entryId: created.entry.id,
			shelfIds: [],
		})
		expect(await listShelfIdsForEntry(db, created.entry.id)).toEqual([])

		await archiveShelf(db, shelf.id)
		expect(await listActiveShelves(db)).toHaveLength(0)
	})
})

describe('transaction safety', () => {
	it('rolls back book creation when shelf attachment fails', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		await expect(
			addBookToLibrary(db, {
				book: { title: 'Broken', authorText: 'A' },
				entry: {},
				shelfIds: ['missing-shelf'],
			}),
		).rejects.toThrow()

		expect(await countBooks(db)).toBe(0)
		expect(await listLibraryBooks(db, {})).toHaveLength(0)
	})
})

describe('search filter sort', () => {
	it('combines status filter, search and sort without resetting others', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)

		await addBookToLibrary(db, {
			book: { title: 'Анна Каренина', authorText: 'Толстой' },
			entry: { status: 'FINISHED', finishedDatePrecision: 'UNKNOWN' },
		})
		await addBookToLibrary(db, {
			book: { title: 'Воскресение', authorText: 'Толстой' },
			entry: { status: 'FINISHED', finishedDatePrecision: 'YEAR', finishedYear: 2020 },
		})
		await addBookToLibrary(db, {
			book: { title: 'Другая', authorText: 'Чехов' },
			entry: { status: 'READING' },
		})

		const filtered = await listLibraryBooks(db, {
			status: 'FINISHED',
			search: 'толстой',
			sort: 'TITLE',
		})
		expect(filtered).toHaveLength(2)
		expect(filtered[0]?.book.title).toBe('Анна Каренина')
		expect(filtered[1]?.book.title).toBe('Воскресение')
	})
})
