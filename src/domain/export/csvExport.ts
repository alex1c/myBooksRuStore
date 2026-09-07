/**
 * Library CSV export (UTF-8 BOM, semicolon, proper escaping).
 */

import {
	formatLabels,
	finishedPrecisionLabels,
	progressModeLabels,
	statusLabels,
} from '@/constants/labels'
import { SqlExecutor } from '@/db/sqlExecutor'
import { toDateOnlyLocal } from '@/utils/dates'

const BOM = '\uFEFF'
const DELIM = ';'

const HEADERS = [
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

function escapeCsvCell (value: string): string {
	if (/[;"\n\r]/.test(value)) {
		return `"${value.replace(/"/g, '""')}"`
	}
	return value
}

function cell (value: string | number | null | undefined): string {
	if (value == null) {
		return ''
	}
	return escapeCsvCell(String(value))
}

function formatAudio (seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	const s = Math.floor(seconds % 60)
	const pad = (n: number) => String(n).padStart(2, '0')
	if (h > 0) {
		return `${pad(h)}:${pad(m)}:${pad(s)}`
	}
	return `${pad(m)}:${pad(s)}`
}

interface CsvRow {
	title: string
	author_text: string
	status: string
	format: string
	progress_mode: string
	current_page: number | null
	total_pages: number | null
	current_percent: number | null
	audio_position_seconds: number | null
	audio_duration_seconds: number | null
	started_at: string | null
	finished_on: string | null
	finished_year: number | null
	finished_date_precision: string | null
	rating: number | null
	shelves: string | null
	isbn10: string | null
	isbn13: string | null
	publisher: string | null
	published_year: number | null
	review_text: string | null
}

/**
 * Build CSV string for the full library (active + archived entries).
 */
export async function buildLibraryCsv (db: SqlExecutor): Promise<string> {
	const rows = await db.getAllAsync<CsvRow>(
		`SELECT
			b.title,
			b.author_text,
			e.status,
			e.format,
			e.progress_mode,
			e.current_page,
			e.total_pages,
			e.current_percent,
			e.audio_position_seconds,
			e.audio_duration_seconds,
			e.started_at,
			e.finished_on,
			e.finished_year,
			e.finished_date_precision,
			e.rating,
			(
				SELECT GROUP_CONCAT(s.name, ', ')
				FROM library_entry_shelves jes
				JOIN shelves s ON s.id = jes.shelf_id
				WHERE jes.library_entry_id = e.id
			) AS shelves,
			b.isbn10,
			b.isbn13,
			b.publisher,
			b.published_year,
			e.review_text
		 FROM library_entries e
		 JOIN books b ON b.id = e.book_id
		 ORDER BY b.title COLLATE NOCASE ASC`,
	)

	const lines = [HEADERS.join(DELIM)]
	for (const row of rows) {
		const statusLabel =
			statusLabels[row.status as keyof typeof statusLabels] ?? row.status
		const formatLabel =
			formatLabels[row.format as keyof typeof formatLabels] ?? row.format
		const modeLabel =
			progressModeLabels[
				row.progress_mode as keyof typeof progressModeLabels
			] ?? row.progress_mode

		let currentProgress = ''
		let totalVolume = ''
		if (row.progress_mode === 'PAGES') {
			currentProgress =
				row.current_page != null ? String(row.current_page) : ''
			totalVolume = row.total_pages != null ? String(row.total_pages) : ''
		} else if (row.progress_mode === 'PERCENT') {
			currentProgress =
				row.current_percent != null
					? `${Math.round(row.current_percent)}%`
					: ''
		} else if (row.progress_mode === 'TIME') {
			currentProgress =
				row.audio_position_seconds != null
					? formatAudio(row.audio_position_seconds)
					: ''
			totalVolume =
				row.audio_duration_seconds != null
					? formatAudio(row.audio_duration_seconds)
					: ''
		}

		let finishedDate = ''
		if (row.finished_date_precision === 'EXACT' && row.finished_on) {
			finishedDate = row.finished_on
		} else if (
			row.finished_date_precision === 'YEAR' &&
			row.finished_year != null
		) {
			finishedDate = String(row.finished_year)
		}

		const precisionLabel = row.finished_date_precision
			? finishedPrecisionLabels[
					row.finished_date_precision as keyof typeof finishedPrecisionLabels
				] ?? row.finished_date_precision
			: ''

		const started =
			row.started_at != null ? toDateOnlyLocal(new Date(row.started_at)) : ''

		const rating =
			row.rating != null
				? String(row.rating).replace('.', ',')
				: ''

		lines.push(
			[
				cell(row.title),
				cell(row.author_text),
				cell(statusLabel),
				cell(formatLabel),
				cell(modeLabel),
				cell(currentProgress),
				cell(totalVolume),
				cell(started),
				cell(finishedDate),
				cell(precisionLabel),
				cell(rating),
				cell(row.shelves),
				cell(row.isbn10),
				cell(row.isbn13),
				cell(row.publisher),
				cell(row.published_year),
				cell(row.review_text),
			].join(DELIM),
		)
	}

	return BOM + lines.join('\r\n') + '\r\n'
}

export function libraryCsvFileName (now: Date = new Date()): string {
	return `reading-diary-library-${toDateOnlyLocal(now)}.csv`
}

/** Test helper — escape only. */
export { escapeCsvCell }
