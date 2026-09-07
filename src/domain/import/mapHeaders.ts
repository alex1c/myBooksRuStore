/**
 * Auto / manual CSV header → field mapping.
 */

import type { FieldKey, HeaderMapping } from './types'

const ALIASES: Record<FieldKey, string[]> = {
	title: ['название', 'title', 'book title', 'book', 'имя'],
	author: ['автор', 'author', 'authors', 'author text'],
	status: ['статус', 'status', 'exclusive shelf', 'exclusive_shelf'],
	format: ['формат', 'format', 'binding'],
	progressMode: ['режим прогресса', 'progress mode', 'progress_mode'],
	currentProgress: [
		'текущий прогресс',
		'current progress',
		'progress',
		'pages read',
		'current page',
	],
	totalVolume: [
		'общий объём',
		'общий объем',
		'total',
		'number of pages',
		'page count',
		'pages',
		'страницы',
		'всего страниц',
	],
	startedAt: ['дата начала', 'date added', 'started', 'date started'],
	finishedDate: [
		'дата прочтения',
		'date read',
		'finished',
		'finished date',
		'read date',
	],
	finishedPrecision: ['точность даты', 'date precision', 'finished precision'],
	rating: ['оценка', 'rating', 'my rating', 'my_rating'],
	shelves: ['полки', 'shelves', 'bookshelves', 'bookshelf'],
	isbn10: ['isbn-10', 'isbn10', 'isbn'],
	isbn13: ['isbn-13', 'isbn13'],
	publisher: ['издательство', 'publisher'],
	publishedYear: [
		'год издания',
		'year published',
		'published year',
		'original publication year',
	],
	review: ['отзыв', 'review', 'my review', 'my_review', 'notes'],
}

function norm (h: string): string {
	return h.trim().toLocaleLowerCase('ru-RU')
}

/**
 * Auto-map CSV headers to import fields (case-insensitive).
 */
export function autoMapHeaders (headers: string[]): HeaderMapping {
	const mapping: HeaderMapping = {}
	const used = new Set<string>()
	const normalized = headers.map((h) => ({ raw: h, key: norm(h) }))

	for (const [field, aliases] of Object.entries(ALIASES) as [
		FieldKey,
		string[],
	][]) {
		for (const alias of aliases) {
			const hit = normalized.find(
				(h) => h.key === alias && !used.has(h.raw),
			)
			if (hit) {
				mapping[field] = hit.raw
				used.add(hit.raw)
				break
			}
		}
	}

	// Prefer ISBN13 column for isbn13; if only ISBN and looks 13 — still map isbn10 alias
	return mapping
}

export function mappingHasTitle (mapping: HeaderMapping): boolean {
	return Boolean(mapping.title)
}

export const FIELD_LABELS_RU: Record<FieldKey, string> = {
	title: 'Название',
	author: 'Автор',
	status: 'Статус',
	format: 'Формат',
	progressMode: 'Режим прогресса',
	currentProgress: 'Текущий прогресс',
	totalVolume: 'Общий объём',
	startedAt: 'Дата начала',
	finishedDate: 'Дата прочтения',
	finishedPrecision: 'Точность даты',
	rating: 'Оценка',
	shelves: 'Полки',
	isbn10: 'ISBN-10',
	isbn13: 'ISBN-13',
	publisher: 'Издательство',
	publishedYear: 'Год издания',
	review: 'Отзыв',
}
