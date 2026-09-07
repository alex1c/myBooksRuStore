/**
 * Build ImportBookCandidate list from mapped CSV rows.
 */

import { createId } from '@/utils/id'
import { rowToRecord } from './csvParser'
import type { HeaderMapping, ImportBookCandidate, ParsedCsvTable } from './types'
import {
	normalizeFormat,
	normalizeIsbnField,
	normalizeProgressMode,
	normalizeRating,
	normalizeStatus,
	normalizeFinishedDate,
	parseFlexibleDate,
	parseProgressFields,
	splitShelves,
	unwrapSpreadsheetLiteral,
} from './normalize'

function get (
	record: Record<string, string>,
	mapping: HeaderMapping,
	field: keyof HeaderMapping,
): string {
	const header = mapping[field]
	if (!header) {
		return ''
	}
	return record[header] ?? ''
}

/**
 * Convert parsed CSV + mapping into candidates (before duplicate analysis).
 */
export function buildCandidatesFromCsv (
	table: ParsedCsvTable,
	mapping: HeaderMapping,
): ImportBookCandidate[] {
	const candidates: ImportBookCandidate[] = []

	for (let i = 0; i < table.rows.length; i += 1) {
		const cells = table.rows[i]!
		const record = rowToRecord(table.headers, cells)
		const sourceRow = i + 2 // 1-based including header
		const warnings: string[] = []
		const errors: string[] = []

		const title = unwrapSpreadsheetLiteral(get(record, mapping, 'title')).trim()
		if (!title) {
			errors.push('Не указано название')
		}

		const authorText = unwrapSpreadsheetLiteral(
			get(record, mapping, 'author'),
		).trim()

		const statusRes = normalizeStatus(get(record, mapping, 'status'))
		if (statusRes.warning) {
			warnings.push(statusRes.warning)
		}

		const formatRes = normalizeFormat(get(record, mapping, 'format'))
		if (formatRes.warning) {
			warnings.push(formatRes.warning)
		}

		const modeHint = normalizeProgressMode(
			get(record, mapping, 'progressMode'),
		)
		const progress = parseProgressFields(
			modeHint,
			get(record, mapping, 'currentProgress'),
			get(record, mapping, 'totalVolume'),
			formatRes.value,
		)

		const ratingRes = normalizeRating(get(record, mapping, 'rating'))
		if (ratingRes.warning) {
			warnings.push(ratingRes.warning)
		}

		const isbn10Res = normalizeIsbnField(
			get(record, mapping, 'isbn10'),
			'isbn10',
		)
		if (isbn10Res.warning) {
			warnings.push(isbn10Res.warning)
		}
		const isbn13Res = normalizeIsbnField(
			get(record, mapping, 'isbn13'),
			'isbn13',
		)
		if (isbn13Res.warning) {
			warnings.push(isbn13Res.warning)
		}
		// If only ISBN column mapped to isbn10 but value is 13 digits, promote
		let isbn10 = isbn10Res.value
		let isbn13 = isbn13Res.value
		if (!isbn13 && isbn10 && /^\d{13}$/.test(isbn10)) {
			isbn13 = isbn10
			isbn10 = null
		}

		const finished = normalizeFinishedDate(
			get(record, mapping, 'finishedDate'),
			get(record, mapping, 'finishedPrecision'),
			statusRes.value,
		)
		if (finished.warning) {
			warnings.push(finished.warning)
		}
		if (finished.error) {
			errors.push(finished.error)
		}

		const yearRaw = unwrapSpreadsheetLiteral(
			get(record, mapping, 'publishedYear'),
		).trim()
		let publishedYear: number | null = null
		if (yearRaw) {
			const y = Number(yearRaw.replace(/\D/g, '').slice(0, 4))
			if (Number.isFinite(y) && y >= 1000) {
				publishedYear = y
			} else {
				warnings.push('Год издания не распознан.')
			}
		}

		const startedRaw = unwrapSpreadsheetLiteral(
			get(record, mapping, 'startedAt'),
		).trim()
		let startedAt: string | null = null
		if (startedRaw) {
			startedAt = parseFlexibleDate(startedRaw)
		}

		let shelves = splitShelves(get(record, mapping, 'shelves'))
		// Goodreads exclusive shelf names are statuses, not custom shelves.
		shelves = shelves.filter((name) => {
			const key = name.trim().toLocaleLowerCase('en-US')
			return (
				key !== 'read' &&
				key !== 'currently-reading' &&
				key !== 'to-read'
			)
		})
		const reviewText =
			unwrapSpreadsheetLiteral(get(record, mapping, 'review')).trim() ||
			null
		const publisher =
			unwrapSpreadsheetLiteral(get(record, mapping, 'publisher')).trim() ||
			null

		const valid = errors.length === 0 && Boolean(title)

		candidates.push({
			id: createId('import'),
			sourceRow,
			title,
			authorText,
			status: statusRes.value,
			format: formatRes.value,
			progressMode: progress.progressMode,
			currentPage: progress.currentPage,
			totalPages: progress.totalPages,
			currentPercent: progress.currentPercent,
			audioPositionSeconds: progress.audioPositionSeconds,
			audioDurationSeconds: progress.audioDurationSeconds,
			startedAt,
			finishedDatePrecision: finished.precision,
			finishedOn: finished.finishedOn,
			finishedYear: finished.finishedYear,
			rating: ratingRes.value,
			reviewText,
			isbn10,
			isbn13,
			publisher,
			publishedYear,
			shelves,
			warnings,
			errors,
			valid,
			duplicateKind: null,
			existingEntryId: null,
			existingBookId: null,
			existingTitle: null,
			withinFilePrimaryId: null,
			selected: valid,
			policy: 'SKIP',
		})
	}

	return candidates
}
