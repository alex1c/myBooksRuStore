/**
 * Normalize messy external catalogue records into NormalizedBookCandidate.
 */

import { pickIsbnFields } from '@/utils/isbn'
import type { NormalizedBookCandidate } from './types'

export interface RawSearchDoc {
	key?: string
	title?: string
	subtitle?: string
	author_name?: string[]
	first_publish_year?: number
	cover_i?: number
	isbn?: string[]
	number_of_pages_median?: number
	publisher?: string[]
	language?: string[]
	edition_count?: number
}

function cleanText (value: unknown): string | null {
	if (typeof value !== 'string') {
		return null
	}
	const trimmed = value.replace(/\s+/g, ' ').trim()
	return trimmed.length > 0 ? trimmed : null
}

function containsCyrillic (value: string): boolean {
	return /[А-Яа-яЁё]/.test(value)
}

function titleMatchScore (title: string, query: string | undefined): number {
	if (!query) {
		return 0
	}
	const normalizedTitle = title.toLocaleLowerCase('ru-RU').trim()
	const normalizedQuery = query.toLocaleLowerCase('ru-RU').trim()
	if (!normalizedQuery) {
		return 0
	}
	if (normalizedTitle === normalizedQuery) {
		return 24
	}
	if (normalizedTitle.startsWith(normalizedQuery)) {
		return 12
	}
	if (normalizedTitle.includes(normalizedQuery)) {
		return 6
	}
	return 0
}

function joinAuthors (authors: unknown): string {
	if (!Array.isArray(authors)) {
		return ''
	}
	const names = authors
		.map((item) => cleanText(item))
		.filter((item): item is string => Boolean(item))
	// Prefer unique names while preserving order (RU + EN duplicates are common).
	const unique: string[] = []
	const seen = new Set<string>()
	for (const name of names) {
		const key = name.toLocaleLowerCase('ru-RU')
		if (seen.has(key)) {
			continue
		}
		seen.add(key)
		unique.push(name)
	}
	return unique.join(', ')
}

function coverUrlFromId (coverId: number | undefined): string | null {
	if (coverId == null || !Number.isFinite(coverId)) {
		return null
	}
	return `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
}

function coverUrlFromIsbn (isbn13: string | null, isbn10: string | null): string | null {
	const value = isbn13 ?? isbn10
	if (!value) {
		return null
	}
	return `https://covers.openlibrary.org/b/isbn/${value}-M.jpg?default=false`
}

/**
 * Score richer records higher so dedupe can keep the best edition.
 */
export function computeQualityScore (input: {
	title: string
	authorText: string
	isbn10: string | null
	isbn13: string | null
	coverUrl: string | null
	pageCount: number | null
	publisher: string | null
	publishedYear: number | null
	language: string | null
	preferRussian?: boolean
	query?: string
}): number {
	let score = titleMatchScore(input.title, input.query)
	if (input.title) score += 10
	if (input.authorText) score += 8
	if (input.isbn13 || input.isbn10) score += 6
	if (input.coverUrl) score += 5
	if (input.pageCount != null && input.pageCount > 0) score += 3
	if (input.publisher) score += 2
	if (input.publishedYear != null) score += 1
	if (input.preferRussian && input.language === 'rus') score += 4
	if (input.preferRussian && containsCyrillic(input.title)) score += 6
	return score
}

export function normalizeOpenLibraryDoc (
	doc: RawSearchDoc,
	options: { preferRussian?: boolean; query?: string } = {},
): NormalizedBookCandidate | null {
	const title = cleanText(doc.title)
	if (!title) {
		return null
	}

	const authorText = joinAuthors(doc.author_name)
	const { isbn10, isbn13 } = pickIsbnFields(
		Array.isArray(doc.isbn) ? doc.isbn.map(String) : [],
	)
	const publisher = Array.isArray(doc.publisher)
		? cleanText(doc.publisher[0])
		: null
	const language = Array.isArray(doc.language)
		? cleanText(doc.language[0])
		: null
	const pageCount =
		typeof doc.number_of_pages_median === 'number' &&
		doc.number_of_pages_median > 0
			? Math.round(doc.number_of_pages_median)
			: null
	const publishedYear =
		typeof doc.first_publish_year === 'number' &&
		doc.first_publish_year >= 1000
			? doc.first_publish_year
			: null

	const coverUrl =
		coverUrlFromId(doc.cover_i) ?? coverUrlFromIsbn(isbn13, isbn10)

	const sourceExternalId =
		cleanText(doc.key)?.replace(/^\/works\//, '') ??
		isbn13 ??
		isbn10 ??
		`${title}:${authorText}`.slice(0, 80)

	const qualityScore = computeQualityScore({
		title,
		authorText,
		isbn10,
		isbn13,
		coverUrl,
		pageCount,
		publisher,
		publishedYear,
		language,
		preferRussian: options.preferRussian,
		query: options.query,
	})

	return {
		resultId: `ol:${sourceExternalId}`,
		title,
		subtitle: cleanText(doc.subtitle),
		authorText,
		description: null,
		isbn10,
		isbn13,
		publisher,
		publishedYear,
		pageCount,
		language,
		coverUrl,
		source: 'openlibrary',
		sourceExternalId,
		qualityScore,
	}
}

export interface OpenLibraryBooksApiRecord {
	title?: string
	subtitle?: string
	authors?: { name?: string }[]
	publishers?: { name?: string }[]
	publish_date?: string
	number_of_pages?: number
	cover?: { small?: string; medium?: string; large?: string }
	identifiers?: {
		isbn_10?: string[]
		isbn_13?: string[]
	}
	key?: string
	url?: string
}

export function normalizeOpenLibraryBooksApi (
	record: OpenLibraryBooksApiRecord,
	fallbackIsbn: string,
): NormalizedBookCandidate | null {
	const title = cleanText(record.title)
	if (!title) {
		return null
	}
	const authorText = joinAuthors(
		(record.authors ?? []).map((author) => author.name),
	)
	const isbnList = [
		...(record.identifiers?.isbn_13 ?? []),
		...(record.identifiers?.isbn_10 ?? []),
		fallbackIsbn,
	]
	const { isbn10, isbn13 } = pickIsbnFields(isbnList)
	const publisher = cleanText(record.publishers?.[0]?.name)
	const pageCount =
		typeof record.number_of_pages === 'number' && record.number_of_pages > 0
			? record.number_of_pages
			: null
	const yearMatch = record.publish_date?.match(/(1[0-9]{3}|20[0-9]{2})/)
	const publishedYear = yearMatch ? Number(yearMatch[1]) : null
	const coverUrl =
		cleanText(record.cover?.medium) ??
		cleanText(record.cover?.large) ??
		coverUrlFromIsbn(isbn13, isbn10)

	const sourceExternalId =
		cleanText(record.key)?.replace(/^\/books\//, '') ??
		isbn13 ??
		isbn10 ??
		fallbackIsbn

	const qualityScore = computeQualityScore({
		title,
		authorText,
		isbn10,
		isbn13,
		coverUrl,
		pageCount,
		publisher,
		publishedYear,
		language: null,
	})

	return {
		resultId: `ol:${sourceExternalId}`,
		title,
		subtitle: cleanText(record.subtitle),
		authorText,
		description: null,
		isbn10,
		isbn13,
		publisher,
		publishedYear,
		pageCount,
		language: null,
		coverUrl,
		source: 'openlibrary',
		sourceExternalId,
		qualityScore,
	}
}
