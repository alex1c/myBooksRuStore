/**
 * Robust CSV parser — quotes, escaped quotes, multiline, delimiter detection.
 */

import { IMPORT_MAX_ROWS } from './constants'
import type { ParsedCsvTable } from './types'

export class ImportParseError extends Error {
	constructor (message: string) {
		super(message)
		this.name = 'ImportParseError'
	}
}

/**
 * Strip UTF-8 BOM and normalize newlines before parsing.
 */
export function prepareCsvText (raw: string): string {
	let text = raw
	if (text.charCodeAt(0) === 0xfeff) {
		text = text.slice(1)
	}
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * Detect delimiter from the first non-empty line (outside quotes).
 */
export function detectDelimiter (text: string): ',' | ';' | '\t' {
	const sample = text.split('\n').find((l) => l.trim().length > 0) ?? ''
	let inQuotes = false
	const counts = { ',': 0, ';': 0, '\t': 0 }
	for (let i = 0; i < sample.length; i += 1) {
		const ch = sample[i]!
		if (ch === '"') {
			if (inQuotes && sample[i + 1] === '"') {
				i += 1
				continue
			}
			inQuotes = !inQuotes
			continue
		}
		if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) {
			counts[ch] += 1
		}
	}
	if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) {
		return ';'
	}
	if (counts['\t'] > counts[','] && counts['\t'] > 0) {
		return '\t'
	}
	if (counts[','] > 0) {
		return ','
	}
	// Default for our Phase 9 export
	return ';'
}

/**
 * Parse CSV text into headers + rows. Throws ImportParseError on hard failures.
 */
export function parseCsv (raw: string, delimiter?: ',' | ';' | '\t'): ParsedCsvTable {
	const text = prepareCsvText(raw)
	if (!text.trim()) {
		throw new ImportParseError('Файл пуст.')
	}
	const delim = delimiter ?? detectDelimiter(text)
	const rows = parseCsvRows(text, delim)
	if (rows.length === 0) {
		throw new ImportParseError('Не удалось прочитать CSV.')
	}
	const headers = rows[0]!.map((h) => h.trim())
	const dataRows = rows.slice(1)
	if (dataRows.length > IMPORT_MAX_ROWS) {
		throw new ImportParseError(
			`Слишком много строк (${dataRows.length}). Максимум ${IMPORT_MAX_ROWS}.`,
		)
	}
	return { headers, rows: dataRows, delimiter: delim }
}

function parseCsvRows (text: string, delim: string): string[][] {
	const rows: string[][] = []
	let row: string[] = []
	let field = ''
	let inQuotes = false
	let i = 0

	const pushField = () => {
		row.push(field)
		field = ''
	}
	const pushRow = () => {
		// Ignore completely empty trailing line
		if (row.length === 1 && row[0] === '' && rows.length > 0) {
			row = []
			return
		}
		rows.push(row)
		row = []
	}

	while (i < text.length) {
		const ch = text[i]!
		if (inQuotes) {
			if (ch === '"') {
				if (text[i + 1] === '"') {
					field += '"'
					i += 2
					continue
				}
				inQuotes = false
				i += 1
				continue
			}
			field += ch
			i += 1
			continue
		}
		if (ch === '"') {
			inQuotes = true
			i += 1
			continue
		}
		if (ch === delim) {
			pushField()
			i += 1
			continue
		}
		if (ch === '\n') {
			pushField()
			pushRow()
			i += 1
			continue
		}
		field += ch
		i += 1
	}
	// Last field / row
	pushField()
	if (row.length > 1 || (row.length === 1 && row[0] !== '') || rows.length === 0) {
		pushRow()
	}

	if (inQuotes) {
		throw new ImportParseError('Незакрытая кавычка в CSV.')
	}
	return rows
}

/** Map a data row to a header→value record (missing cells → ''). */
export function rowToRecord (
	headers: string[],
	cells: string[],
): Record<string, string> {
	const out: Record<string, string> = {}
	for (let i = 0; i < headers.length; i += 1) {
		out[headers[i]!] = (cells[i] ?? '').trim()
	}
	return out
}
