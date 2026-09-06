/**
 * Book search facade: provider injection, session cache, ISBN routing,
 * stale-request protection via AbortSignal.
 */

import { NetworkError } from '@/services/network/httpClient'
import { looksLikeIsbnQuery, parseIsbn } from '@/utils/isbn'
import { createOpenLibraryProvider } from './openLibraryProvider'
import type {
	BookSearchProvider,
	NormalizedBookCandidate,
} from './types'

export type { NormalizedBookCandidate, BookSearchProvider } from './types'

const searchCache = new Map<string, NormalizedBookCandidate[]>()
const isbnCache = new Map<string, NormalizedBookCandidate | null>()

let activeProvider: BookSearchProvider = createOpenLibraryProvider()

/** Test helper — swap provider without touching UI. */
export function setBookSearchProvider (provider: BookSearchProvider): void {
	activeProvider = provider
	searchCache.clear()
	isbnCache.clear()
}

export function getBookSearchProvider (): BookSearchProvider {
	return activeProvider
}

export function clearBookSearchCache (): void {
	searchCache.clear()
	isbnCache.clear()
}

function cacheKey (query: string): string {
	return query.trim().toLocaleLowerCase('ru-RU')
}

function assertNotAborted (signal?: AbortSignal): void {
	if (signal?.aborted) {
		throw new NetworkError('abort', 'Request aborted')
	}
}

/**
 * Search by free text or ISBN. ISBN-looking queries use lookupByIsbn first.
 */
export async function searchBooks (
	query: string,
	signal?: AbortSignal,
): Promise<NormalizedBookCandidate[]> {
	const trimmed = query.trim()
	if (trimmed.length < 2) {
		return []
	}

	assertNotAborted(signal)

	if (looksLikeIsbnQuery(trimmed)) {
		const parsed = parseIsbn(trimmed)
		const isbn = parsed?.normalized ?? trimmed
		const found = await lookupBookByIsbn(isbn, signal)
		return found ? [found] : []
	}

	const key = cacheKey(trimmed)
	const cached = searchCache.get(key)
	if (cached) {
		return cached
	}

	try {
		const results = await activeProvider.search({ query: trimmed, signal })
		assertNotAborted(signal)
		searchCache.set(key, results)
		return results
	} catch (error) {
		assertNotAborted(signal)
		throw error
	}
}

export async function lookupBookByIsbn (
	isbn: string,
	signal?: AbortSignal,
): Promise<NormalizedBookCandidate | null> {
	const parsed = parseIsbn(isbn)
	const normalized = parsed?.normalized ?? isbn.trim()
	if (!normalized) {
		return null
	}

	assertNotAborted(signal)

	if (isbnCache.has(normalized)) {
		return isbnCache.get(normalized) ?? null
	}

	const result = await activeProvider.lookupByIsbn(normalized, signal)
	assertNotAborted(signal)
	isbnCache.set(normalized, result)
	return result
}
