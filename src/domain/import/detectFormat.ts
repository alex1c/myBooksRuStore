/**
 * Detect import CSV format from headers (not filename).
 */

import {
	GOODREADS_SIGNATURE_HEADERS,
	MYBOOKS_CSV_HEADERS,
} from './constants'
import type { ImportFormat } from './types'

function normHeader (h: string): string {
	return h.trim().toLocaleLowerCase('ru-RU')
}

/**
 * Identify known CSV presets by header signatures.
 */
export function detectImportFormat (headers: string[]): ImportFormat {
	const set = new Set(headers.map(normHeader))

	const myBooksHits = MYBOOKS_CSV_HEADERS.filter((h) =>
		set.has(normHeader(h)),
	).length
	if (
		set.has(normHeader('Название')) &&
		set.has(normHeader('Статус')) &&
		set.has(normHeader('Точность даты')) &&
		myBooksHits >= 10
	) {
		return 'MYBOOKS_CSV'
	}

	const goodreadsHits = GOODREADS_SIGNATURE_HEADERS.filter((h) =>
		set.has(normHeader(h)),
	).length
	if (
		set.has('title') &&
		set.has('exclusive shelf') &&
		goodreadsHits >= 4
	) {
		return 'GOODREADS_CSV'
	}

	// Generic if we can at least find a title-like column
	const titleLike = [...set].some(
		(h) =>
			h === 'title' ||
			h === 'book title' ||
			h === 'название' ||
			h === 'book' ||
			h.includes('title') ||
			h.includes('назван'),
	)
	if (titleLike) {
		return 'GENERIC_CSV'
	}
	return 'UNKNOWN'
}

export function formatLabel (format: ImportFormat): string {
	switch (format) {
		case 'MYBOOKS_CSV':
			return 'Распознан экспорт «Дневника чтения»'
		case 'GOODREADS_CSV':
			return 'Распознан экспорт Goodreads'
		case 'GENERIC_CSV':
			return 'Универсальный CSV'
		default:
			return 'Неизвестный формат'
	}
}
