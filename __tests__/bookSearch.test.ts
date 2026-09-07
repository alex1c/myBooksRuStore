import {
	isBooklandEan13,
	normalizeIsbnDigits,
	parseIsbn,
	pickIsbnFields,
} from '@/utils/isbn'
import {
	computeQualityScore,
	normalizeOpenLibraryBooksApi,
	normalizeOpenLibraryDoc,
} from '@/services/bookSearch/normalize'
import { dedupeSearchResults } from '@/services/bookSearch/dedupeResults'
import {
	clearBookSearchCache,
	lookupBookByIsbn,
	searchBooks,
	setBookSearchProvider,
} from '@/services/bookSearch'
import { createOpenLibraryProvider } from '@/services/bookSearch/openLibraryProvider'
import type {
	BookSearchProvider,
	NormalizedBookCandidate,
} from '@/services/bookSearch/types'
import { NetworkError } from '@/services/network/httpClient'
import { migrations } from '@/db/migrations'
import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	addExternalBookToLibrary,
	findLibraryDuplicates,
	getLibraryBookByEntryId,
	listLibraryBooks,
} from '@/domain/libraryService'
import { countBooks, createBook } from '@/db/repositories'
import { createTestSqlExecutor } from './helpers/testDatabase'

function mockCandidate (
	partial: Partial<NormalizedBookCandidate> & Pick<NormalizedBookCandidate, 'title'>,
): NormalizedBookCandidate {
	const title = partial.title
	const authorText = partial.authorText ?? ''
	const isbn10 = partial.isbn10 ?? null
	const isbn13 = partial.isbn13 ?? null
	const coverUrl = partial.coverUrl ?? null
	const pageCount = partial.pageCount ?? null
	const publisher = partial.publisher ?? null
	const publishedYear = partial.publishedYear ?? null
	return {
		resultId: partial.resultId ?? `mock:${title}`,
		title,
		subtitle: partial.subtitle ?? null,
		authorText,
		description: partial.description ?? null,
		isbn10,
		isbn13,
		publisher,
		publishedYear,
		pageCount,
		language: partial.language ?? null,
		coverUrl,
		source: partial.source ?? 'mock',
		sourceExternalId: partial.sourceExternalId ?? `ext:${title}`,
		qualityScore:
			partial.qualityScore ??
			computeQualityScore({
				title,
				authorText,
				isbn10,
				isbn13,
				coverUrl,
				pageCount,
				publisher,
				publishedYear,
				language: partial.language ?? null,
			}),
	}
}

describe('ISBN utilities', () => {
	it('normalizes hyphens/spaces and validates ISBN-10 / ISBN-13', () => {
		expect(normalizeIsbnDigits('978-0-14-118014-4')).toBe('9780141180144')
		expect(parseIsbn('0-306-40615-2')?.kind).toBe('ISBN10')
		expect(parseIsbn('978-0-14-118014-4')?.checksumValid).toBe(true)
		expect(parseIsbn('9780141180145')?.checksumValid).toBe(false)
	})

	it('accepts Bookland EAN and rejects non-book EAN-13', () => {
		expect(isBooklandEan13('9780141180144')).toBe(true)
		expect(isBooklandEan13('4006381333931')).toBe(false)
		expect(pickIsbnFields(['978-0-14-118014-4', '0141180145'])).toEqual({
			isbn13: '9780141180144',
			isbn10: '0141180145',
		})
	})
})

describe('normalization', () => {
	it('normalizes a regular Open Library doc', () => {
		const item = normalizeOpenLibraryDoc({
			key: '/works/OL45804W',
			title: 'Мастер и Маргарита',
			author_name: ['Михаил Афанасьевич Булгаков', 'Mikhail Bulgakov'],
			first_publish_year: 1967,
			cover_i: 123,
			isbn: ['9780141180144', '0141180145'],
			number_of_pages_median: 411,
			publisher: ['Penguin'],
			language: ['rus'],
		}, { preferRussian: true })

		expect(item).toMatchObject({
			title: 'Мастер и Маргарита',
			authorText: 'Михаил Афанасьевич Булгаков, Mikhail Bulgakov',
			isbn13: '9780141180144',
			pageCount: 411,
			source: 'openlibrary',
			sourceExternalId: 'OL45804W',
		})
		expect(item?.coverUrl).toContain('covers.openlibrary.org')
	})

	it('prioritizes an exact Cyrillic title over a richer foreign edition', () => {
		const russian = normalizeOpenLibraryDoc({
			title: 'Преступление и наказание',
			author_name: ['Фёдор Достоевский'],
			language: ['rus'],
		}, { preferRussian: true, query: 'Преступление и наказание' })
		const foreign = normalizeOpenLibraryDoc({
			title: 'Schuld und Sühne',
			author_name: ['Fyodor Dostoevsky'],
			isbn: ['9780140449136'],
			cover_i: 123,
			number_of_pages_median: 671,
			publisher: ['Penguin'],
			language: ['ger'],
		}, { preferRussian: true, query: 'Преступление и наказание' })

		expect(russian?.qualityScore).toBeGreaterThan(foreign?.qualityScore ?? 0)
	})

	it('handles missing author/cover/pages and malformed input', () => {
		expect(normalizeOpenLibraryDoc({ title: '   ' })).toBeNull()
		const item = normalizeOpenLibraryDoc({
			title: 'Untitled Work',
			author_name: undefined,
			cover_i: undefined,
			isbn: ['not-an-isbn'],
		})
		expect(item?.authorText).toBe('')
		expect(item?.coverUrl).toBeNull()
		expect(item?.pageCount).toBeNull()
	})

	it('normalizes Books API ISBN lookup payloads', () => {
		const item = normalizeOpenLibraryBooksApi(
			{
				title: 'The Master and Margarita',
				authors: [{ name: 'Mikhail Bulgakov' }],
				number_of_pages: 411,
				identifiers: { isbn_13: ['9780141180144'] },
				cover: { medium: 'https://covers.example/m.jpg' },
				key: '/books/OL1M',
			},
			'9780141180144',
		)
		expect(item?.title).toBe('The Master and Margarita')
		expect(item?.isbn13).toBe('9780141180144')
		expect(item?.coverUrl).toBe('https://covers.example/m.jpg')
	})
})

describe('result dedupe', () => {
	it('keeps the richer edition for the same ISBN/title', () => {
		const weak = mockCandidate({
			title: 'Dune',
			authorText: 'Frank Herbert',
			isbn13: '9780441172719',
			qualityScore: 10,
		})
		const strong = mockCandidate({
			title: 'Dune',
			authorText: 'Frank Herbert',
			isbn13: '9780441172719',
			coverUrl: 'https://example.com/c.jpg',
			pageCount: 600,
			qualityScore: 30,
		})
		const result = dedupeSearchResults([weak, strong])
		expect(result).toHaveLength(1)
		expect(result[0]?.pageCount).toBe(600)
	})
})

describe('search facade with mock provider', () => {
	afterEach(() => {
		clearBookSearchCache()
		setBookSearchProvider(createOpenLibraryProvider())
	})

	it('returns successful results and caches them', async () => {
		let calls = 0
		const provider: BookSearchProvider = {
			id: 'mock',
			displayName: 'Mock',
			async search () {
				calls += 1
				return [mockCandidate({ title: 'Dune', authorText: 'Frank Herbert' })]
			},
			async lookupByIsbn () {
				return null
			},
		}
		setBookSearchProvider(provider)
		const first = await searchBooks('Dune')
		const second = await searchBooks('Dune')
		expect(first).toHaveLength(1)
		expect(second).toHaveLength(1)
		expect(calls).toBe(1)
	})

	it('returns empty results', async () => {
		setBookSearchProvider({
			id: 'mock',
			displayName: 'Mock',
			search: async () => [],
			lookupByIsbn: async () => null,
		})
		await expect(searchBooks('zzzz-unknown')).resolves.toEqual([])
	})

	it('surfaces provider failure', async () => {
		setBookSearchProvider({
			id: 'mock',
			displayName: 'Mock',
			search: async () => {
				throw new NetworkError('offline', 'offline')
			},
			lookupByIsbn: async () => null,
		})
		await expect(searchBooks('Dune')).rejects.toBeInstanceOf(NetworkError)
	})

	it('ignores stale aborted requests', async () => {
		setBookSearchProvider({
			id: 'mock',
			displayName: 'Mock',
			search: async (_input) => {
				await new Promise((resolve) => setTimeout(resolve, 30))
				return [mockCandidate({ title: 'Late' })]
			},
			lookupByIsbn: async () => null,
		})
		const controller = new AbortController()
		const pending = searchBooks('Late query', controller.signal)
		controller.abort()
		await expect(pending).rejects.toMatchObject({ kind: 'abort' })
	})

	it('routes ISBN-looking queries to lookupByIsbn', async () => {
		setBookSearchProvider({
			id: 'mock',
			displayName: 'Mock',
			search: async () => {
				throw new Error('should not search')
			},
			lookupByIsbn: async () =>
				mockCandidate({
					title: 'ISBN Book',
					isbn13: '9780141180144',
					sourceExternalId: 'OLISBN',
				}),
		})
		const results = await searchBooks('978-0-14-118014-4')
		expect(results[0]?.title).toBe('ISBN Book')
		await expect(lookupBookByIsbn('9780141180144')).resolves.toMatchObject({
			title: 'ISBN Book',
		})
	})
})

describe('external add integration', () => {
	it('adds mock search result into local library with local PK', async () => {
		const db = createTestSqlExecutor()
		await applyMigrations(db)
		expect(await applyMigrations(db)).toBe(5)

		const created = await addExternalBookToLibrary(db, {
			title: 'Мастер и Маргарита',
			authorText: 'Михаил Булгаков',
			isbn13: '9780141180144',
			pageCount: 411,
			coverUrl: 'https://covers.example/m.jpg',
			source: 'openlibrary',
			sourceExternalId: 'OL45804W',
		})

		expect(created.book.id.startsWith('book_')).toBe(true)
		expect(created.book.sourceExternalId).toBe('OL45804W')
		expect(created.book.id).not.toBe('OL45804W')
		expect(created.entry.status).toBe('WANT_TO_READ')
		expect(created.book.remoteCoverUrl).toBe('https://covers.example/m.jpg')

		const loaded = await getLibraryBookByEntryId(db, created.entry.id)
		expect(loaded?.book.title).toBe('Мастер и Маргарита')

		const dup = await findLibraryDuplicates(db, {
			title: 'мастер и маргарита',
			authorText: 'михаил булгаков',
			isbn13: '9780141180144',
		})
		expect(dup.hasDuplicates).toBe(true)
	})

	it('keeps local repository usable after search failure', async () => {
		setBookSearchProvider({
			id: 'mock',
			displayName: 'Mock',
			search: async () => {
				throw new NetworkError('offline', 'offline')
			},
			lookupByIsbn: async () => null,
		})
		await expect(searchBooks('anything')).rejects.toBeInstanceOf(NetworkError)

		const db = createTestSqlExecutor()
		await applyMigrations(db)
		await createBook(db, { title: 'Offline Book', authorText: 'A' })
		expect(await countBooks(db)).toBe(1)
		expect(await listLibraryBooks(db, {})).toHaveLength(0)
	})
})

describe('migration v3', () => {
	it('upgrades v2 databases with remote_cover_url', async () => {
		const db = createTestSqlExecutor()
		for (const migration of migrations.slice(0, 2)) {
			await db.execAsync(migration.sql)
			await db.runAsync(
				'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
				[migration.version, '2026-09-06T00:00:00.000Z'],
			)
		}
		expect(await applyMigrations(db)).toBe(5)
		const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(books)`)
		expect(cols.some((col) => col.name === 'remote_cover_url')).toBe(true)
	})
})
