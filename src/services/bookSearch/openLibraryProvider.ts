/**
 * Open Library search + ISBN lookup provider (no API key).
 * https://openlibrary.org/dev/docs/api/search
 */

import { httpGetJson } from '@/services/network/httpClient'
import { normalizeIsbnDigits, parseIsbn } from '@/utils/isbn'
import { dedupeSearchResults } from './dedupeResults'
import {
	normalizeOpenLibraryBooksApi,
	normalizeOpenLibraryDoc,
	type OpenLibraryBooksApiRecord,
	type RawSearchDoc,
} from './normalize'
import type {
	BookSearchProvider,
	BookSearchQuery,
	NormalizedBookCandidate,
} from './types'

interface SearchResponse {
	numFound?: number
	docs?: RawSearchDoc[]
}

function containsCyrillic (value: string): boolean {
	return /[А-Яа-яЁё]/.test(value)
}

function buildSearchUrl (query: string): string {
	const fields = [
		'key',
		'title',
		'subtitle',
		'author_name',
		'first_publish_year',
		'cover_i',
		'isbn',
		'number_of_pages_median',
		'publisher',
		'language',
		'edition_count',
	].join(',')
	const params = new URLSearchParams({
		q: query,
		limit: '25',
		fields,
	})
	return `https://openlibrary.org/search.json?${params.toString()}`
}

export function createOpenLibraryProvider (): BookSearchProvider {
	return {
		id: 'openlibrary',
		displayName: 'Open Library',

		async search (input: BookSearchQuery): Promise<NormalizedBookCandidate[]> {
			const query = input.query.trim()
			if (query.length < 2) {
				return []
			}

			const preferRussian = containsCyrillic(query)
			const data = await httpGetJson<SearchResponse>(buildSearchUrl(query), {
				signal: input.signal,
				timeoutMs: 10_000,
			})

			const normalized = (data.docs ?? [])
				.map((doc) => normalizeOpenLibraryDoc(doc, {
					preferRussian,
					query,
				}))
				.filter((item): item is NormalizedBookCandidate => item != null)

			// Soft preference: for Cyrillic queries, boost Russian-language docs
			// already handled in qualityScore; dedupe keeps best edition.
			return dedupeSearchResults(normalized, 20)
		},

		async lookupByIsbn (
			isbn: string,
			signal?: AbortSignal,
		): Promise<NormalizedBookCandidate | null> {
			const parsed = parseIsbn(isbn)
			const normalized = parsed?.normalized ?? normalizeIsbnDigits(isbn)
			if (!normalized) {
				return null
			}

			const bibKey = `ISBN:${normalized}`
			const url =
				`https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(bibKey)}` +
				'&format=json&jscmd=data'

			const data = await httpGetJson<Record<string, OpenLibraryBooksApiRecord>>(
				url,
				{ signal, timeoutMs: 10_000 },
			)
			const record = data[bibKey]
			if (!record) {
				return null
			}
			return normalizeOpenLibraryBooksApi(record, normalized)
		},
	}
}
