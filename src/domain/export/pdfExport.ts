/**
 * Library PDF report via HTML (expo-print).
 */

import {
	formatLabels,
	finishedPrecisionLabels,
	statusLabels,
} from '@/constants/labels'
import type { LibraryStatus } from '@/constants/domain'
import { SqlExecutor } from '@/db/sqlExecutor'
import { toDateOnlyLocal } from '@/utils/dates'
import { formatIntegerRu, formatRatingRu } from '@/utils/format'

export type PdfLibraryFilter =
	| 'ALL'
	| 'FINISHED'
	| 'READING'
	| 'WANT_TO_READ'

function escapeHtml (value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

interface PdfBookRow {
	title: string
	author_text: string
	status: string
	format: string
	progress_mode: string
	current_page: number | null
	total_pages: number | null
	current_percent: number | null
	rating: number | null
	finished_on: string | null
	finished_year: number | null
	finished_date_precision: string | null
	review_text: string | null
	shelves: string | null
}

function progressLine (row: PdfBookRow): string {
	if (row.progress_mode === 'PAGES') {
		const cur = row.current_page ?? 0
		const total = row.total_pages
		return total != null
			? `${formatIntegerRu(cur)} / ${formatIntegerRu(total)} стр.`
			: `${formatIntegerRu(cur)} стр.`
	}
	if (row.progress_mode === 'PERCENT') {
		return row.current_percent != null
			? `${Math.round(row.current_percent)}%`
			: '—'
	}
	return '—'
}

function finishedLine (row: PdfBookRow): string {
	if (row.finished_date_precision === 'EXACT' && row.finished_on) {
		return row.finished_on
	}
	if (row.finished_date_precision === 'YEAR' && row.finished_year != null) {
		return String(row.finished_year)
	}
	if (row.finished_date_precision === 'UNKNOWN') {
		return finishedPrecisionLabels.UNKNOWN
	}
	return ''
}

/**
 * Build printable HTML for a library report (Russian labels, escaped content).
 */
export async function buildLibraryPdfHtml (
	db: SqlExecutor,
	filter: PdfLibraryFilter = 'ALL',
	now: Date = new Date(),
): Promise<string> {
	const params: string[] = []
	let where = 'WHERE e.archived_at IS NULL'
	if (filter !== 'ALL') {
		where += ' AND e.status = ?'
		params.push(filter)
	}

	const rows = await db.getAllAsync<PdfBookRow>(
		`SELECT
			b.title, b.author_text, e.status, e.format, e.progress_mode,
			e.current_page, e.total_pages, e.current_percent, e.rating,
			e.finished_on, e.finished_year, e.finished_date_precision,
			e.review_text,
			(
				SELECT GROUP_CONCAT(s.name, ', ')
				FROM library_entry_shelves jes
				JOIN shelves s ON s.id = jes.shelf_id
				WHERE jes.library_entry_id = e.id
			) AS shelves
		 FROM library_entries e
		 JOIN books b ON b.id = e.book_id
		 ${where}
		 ORDER BY b.title COLLATE NOCASE ASC`,
		params,
	)

	const counts = {
		all: 0,
		READING: 0,
		FINISHED: 0,
		WANT_TO_READ: 0,
	}
	const countRows = await db.getAllAsync<{ status: string; c: number }>(
		`SELECT status, COUNT(*) AS c FROM library_entries
		 WHERE archived_at IS NULL GROUP BY status`,
	)
	for (const r of countRows) {
		counts.all += r.c
		if (r.status in counts) {
			counts[r.status as keyof typeof counts] = r.c
		}
	}

	const filterTitle =
		filter === 'ALL'
			? 'Вся библиотека'
			: statusLabels[filter as LibraryStatus] ?? filter

	const cards = rows
		.map((row) => {
			const status =
				statusLabels[row.status as keyof typeof statusLabels] ?? row.status
			const format =
				formatLabels[row.format as keyof typeof formatLabels] ?? row.format
			const rating =
				row.rating != null ? formatRatingRu(row.rating) : null
			const finished = finishedLine(row)
			const review = row.review_text?.trim()
			return `
			<section class="book">
				<h2>${escapeHtml(row.title)}</h2>
				<p class="author">${escapeHtml(row.author_text || '—')}</p>
				<p>${escapeHtml(status)} · ${escapeHtml(format)}</p>
				<p>Прогресс: ${escapeHtml(progressLine(row))}</p>
				${rating ? `<p>Оценка: ${escapeHtml(rating)}</p>` : ''}
				${finished ? `<p>Прочитано: ${escapeHtml(finished)}</p>` : ''}
				${row.shelves ? `<p>Полки: ${escapeHtml(row.shelves)}</p>` : ''}
				${review ? `<p class="review">${escapeHtml(review)}</p>` : ''}
			</section>`
		})
		.join('\n')

	return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Моя библиотека</title>
<style>
  body { font-family: -apple-system, Roboto, "Noto Sans", sans-serif; color: #1C2430; padding: 24px; }
  h1 { font-size: 28px; margin: 0 0 8px; }
  .meta { color: #5C6670; margin-bottom: 24px; }
  .summary { margin-bottom: 28px; line-height: 1.6; }
  .book { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #D9E0DC; page-break-inside: avoid; }
  .book h2 { font-size: 18px; margin: 0 0 4px; word-wrap: break-word; }
  .author { color: #5C6670; margin: 0 0 8px; }
  .review { font-style: italic; word-wrap: break-word; }
</style>
</head>
<body>
  <h1>Моя библиотека</h1>
  <p class="meta">Дата формирования: ${escapeHtml(toDateOnlyLocal(now))} · ${escapeHtml(filterTitle)}</p>
  <div class="summary">
    <div>Всего книг: ${formatIntegerRu(counts.all)}</div>
    <div>Читаю: ${formatIntegerRu(counts.READING)}</div>
    <div>Прочитано: ${formatIntegerRu(counts.FINISHED)}</div>
    <div>Хочу прочитать: ${formatIntegerRu(counts.WANT_TO_READ)}</div>
  </div>
  ${cards || '<p>Нет книг для выбранного фильтра.</p>'}
</body>
</html>`
}

export function libraryPdfFileName (now: Date = new Date()): string {
	return `reading-diary-library-${toDateOnlyLocal(now)}.pdf`
}

export { escapeHtml }
