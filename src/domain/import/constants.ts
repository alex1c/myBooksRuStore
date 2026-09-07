/**
 * Mass import limits and shared constants (Phase 10).
 */

/** Max CSV file size (bytes) — enough for large libraries, not gigabytes. */
export const IMPORT_MAX_FILE_BYTES = 25 * 1024 * 1024

/** Max data rows (excluding header). */
export const IMPORT_MAX_ROWS = 20_000

/** Phase 9 export headers — used for format detection & our CSV mapping. */
export const MYBOOKS_CSV_HEADERS = [
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
] as const

/** Goodreads export signature headers (subset). */
export const GOODREADS_SIGNATURE_HEADERS = [
	'Title',
	'Author',
	'Exclusive Shelf',
	'ISBN',
	'ISBN13',
] as const
