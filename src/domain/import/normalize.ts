/**
 * Import field normalization — status, format, dates, ISBN, rating, shelves.
 */

import type {
	BookFormat,
	FinishedDatePrecision,
	LibraryStatus,
	ProgressMode,
} from '@/constants/domain'
import { normalizeIsbn, normalizeText } from '@/domain/libraryValidation'
import { isDateOnly } from '@/utils/dates'

export interface NormResult<T> {
	value: T
	warning?: string
	error?: string
}

/** Strip Excel/Goodreads formula wrappers like ="123" or leading ' from export. */
export function unwrapSpreadsheetLiteral (raw: string): string {
	let value = raw.trim()
	// Our CSV formula protection prefix
	if (/^'[=+\-@]/.test(value)) {
		value = value.slice(1)
	}
	// Goodreads Excel-style ISBN: ="978..." (or parser-collapsed =978... when quotes are CSV quotes)
	const excelQuoted = value.match(/^="([^"]*)"$/)
	if (excelQuoted) {
		return excelQuoted[1]!.trim()
	}
	const excelBare = value.match(/^=([\dX]+)$/i)
	if (excelBare) {
		return excelBare[1]!.trim()
	}
	const excelSingle = value.match(/^='([^']*)'$/)
	if (excelSingle) {
		return excelSingle[1]!.trim()
	}
	return value
}

export function normalizeStatus (raw: string): NormResult<LibraryStatus> {
	const key = normalizeText(unwrapSpreadsheetLiteral(raw))
	if (!key) {
		return { value: 'WANT_TO_READ' }
	}
	const map: Record<string, LibraryStatus> = {
		читаю: 'READING',
		reading: 'READING',
		'currently-reading': 'READING',
		'currently reading': 'READING',
		'хочу прочитать': 'WANT_TO_READ',
		хочу: 'WANT_TO_READ',
		'to-read': 'WANT_TO_READ',
		'to read': 'WANT_TO_READ',
		'want-to-read': 'WANT_TO_READ',
		'want to read': 'WANT_TO_READ',
		прочитано: 'FINISHED',
		read: 'FINISHED',
		finished: 'FINISHED',
		отложено: 'PAUSED',
		paused: 'PAUSED',
		onhold: 'PAUSED',
		'on-hold': 'PAUSED',
		брошено: 'ABANDONED',
		abandoned: 'ABANDONED',
		dnf: 'ABANDONED',
	}
	if (map[key]) {
		return { value: map[key]! }
	}
	return {
		value: 'WANT_TO_READ',
		warning: 'Статус не распознан — будет «Хочу прочитать».',
	}
}

export function normalizeFormat (raw: string): NormResult<BookFormat> {
	const key = normalizeText(unwrapSpreadsheetLiteral(raw))
	if (!key) {
		return { value: 'PAPER' }
	}
	const map: Record<string, BookFormat> = {
		бумажная: 'PAPER',
		бумажные: 'PAPER',
		paper: 'PAPER',
		paperback: 'PAPER',
		hardcover: 'PAPER',
		печатная: 'PAPER',
		электронная: 'EBOOK',
		электронные: 'EBOOK',
		ebook: 'EBOOK',
		'e-book': 'EBOOK',
		kindle: 'EBOOK',
		аудиокнига: 'AUDIOBOOK',
		аудио: 'AUDIOBOOK',
		audiobook: 'AUDIOBOOK',
		audio: 'AUDIOBOOK',
	}
	if (map[key]) {
		return { value: map[key]! }
	}
	return {
		value: 'PAPER',
		warning: 'Формат не распознан — будет «Бумажная».',
	}
}

export function normalizeProgressMode (raw: string): ProgressMode | null {
	const key = normalizeText(unwrapSpreadsheetLiteral(raw))
	if (!key) {
		return null
	}
	if (key.includes('процент') || key === 'percent' || key === 'percentage') {
		return 'PERCENT'
	}
	if (key.includes('время') || key === 'time' || key.includes('audio')) {
		return 'TIME'
	}
	if (key.includes('страниц') || key === 'pages' || key === 'page') {
		return 'PAGES'
	}
	return null
}

export function normalizeRating (raw: string): NormResult<number | null> {
	const text = unwrapSpreadsheetLiteral(raw).trim()
	if (!text) {
		return { value: null }
	}
	const normalized = text.replace(',', '.')
	const num = Number(normalized)
	if (!Number.isFinite(num)) {
		return {
			value: null,
			warning: 'Оценка не распознана и будет пропущена.',
		}
	}
	if (num < 0 || num > 5) {
		return {
			value: null,
			warning: 'Оценка вне диапазона 0–5 и будет пропущена.',
		}
	}
	const stepped = Math.round(num * 2) / 2
	return { value: stepped }
}

export function normalizeIsbnField (
	raw: string,
	kind: 'isbn10' | 'isbn13',
): NormResult<string | null> {
	const text = unwrapSpreadsheetLiteral(raw)
	if (!text) {
		return { value: null }
	}
	const cleaned = normalizeIsbn(text.replace(/^ISBN[:\s]*/i, ''))
	if (kind === 'isbn13') {
		if (/^\d{13}$/.test(cleaned)) {
			return { value: cleaned }
		}
		// Sometimes ISBN13 stored with 12 digits + check issues — reject softly
		return {
			value: null,
			warning: 'ISBN-13 некорректен и будет пропущен.',
		}
	}
	if (/^\d{9}[\dX]$/.test(cleaned)) {
		return { value: cleaned }
	}
	return {
		value: null,
		warning: 'ISBN-10 некорректен и будет пропущен.',
	}
}

/**
 * Parse finished date / precision from free text.
 */
export function normalizeFinishedDate (
	rawDate: string,
	rawPrecision: string,
	status: LibraryStatus,
): {
	precision: FinishedDatePrecision | null
	finishedOn: string | null
	finishedYear: number | null
	warning?: string
	error?: string
} {
	if (status !== 'FINISHED') {
		return { precision: null, finishedOn: null, finishedYear: null }
	}

	const precisionKey = normalizeText(unwrapSpreadsheetLiteral(rawPrecision))
	if (
		precisionKey.includes('точн') ||
		precisionKey === 'exact'
	) {
		// fall through to date parse
	} else if (
		precisionKey.includes('только год') ||
		precisionKey === 'year'
	) {
		const year = extractYear(rawDate) ?? extractYear(rawPrecision)
		if (year != null) {
			return { precision: 'YEAR', finishedOn: null, finishedYear: year }
		}
	} else if (
		precisionKey.includes('неизвест') ||
		precisionKey === 'unknown'
	) {
		return { precision: 'UNKNOWN', finishedOn: null, finishedYear: null }
	}

	const dateText = unwrapSpreadsheetLiteral(rawDate).trim()
	if (!dateText) {
		return {
			precision: 'UNKNOWN',
			finishedOn: null,
			finishedYear: null,
			warning: 'Дата прочтения не указана.',
		}
	}

	const iso = parseFlexibleDate(dateText)
	if (iso) {
		return { precision: 'EXACT', finishedOn: iso, finishedYear: null }
	}
	const yearOnly = extractYear(dateText)
	if (yearOnly != null && /^\d{4}$/.test(dateText.trim())) {
		return {
			precision: 'YEAR',
			finishedOn: null,
			finishedYear: yearOnly,
		}
	}
	return {
		precision: 'UNKNOWN',
		finishedOn: null,
		finishedYear: null,
		warning: 'Некорректная дата прочтения — будет без точной даты.',
	}
}

export function parseFlexibleDate (raw: string): string | null {
	const text = unwrapSpreadsheetLiteral(raw).trim()
	if (!text) {
		return null
	}
	if (isDateOnly(text)) {
		return text
	}
	// DD.MM.YYYY
	const dot = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
	if (dot) {
		const d = Number(dot[1])
		const m = Number(dot[2])
		const y = Number(dot[3])
		const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
		return isDateOnly(iso) ? iso : null
	}
	// YYYY/MM/DD or MM/DD/YYYY (Goodreads often YYYY/MM/DD or MM/DD/YYYY)
	const slash = text.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/)
	if (slash) {
		const a = Number(slash[1])
		const b = Number(slash[2])
		const c = Number(slash[3])
		if (a > 31) {
			const iso = `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`
			return isDateOnly(iso) ? iso : null
		}
		if (c > 31) {
			const iso = `${c}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`
			return isDateOnly(iso) ? iso : null
		}
	}
	// Goodreads: "YYYY/MM/DD" already covered; also "Mon DD, YYYY" skip for simplicity
	return null
}

function extractYear (raw: string): number | null {
	const m = unwrapSpreadsheetLiteral(raw).match(/(19|20)\d{2}/)
	if (!m) {
		return null
	}
	const year = Number(m[0])
	const max = new Date().getFullYear() + 1
	if (year < 1000 || year > max) {
		return null
	}
	return year
}

export function parseProgressFields (
	modeHint: ProgressMode | null,
	currentRaw: string,
	totalRaw: string,
	format: BookFormat,
): {
	progressMode: ProgressMode
	currentPage: number | null
	totalPages: number | null
	currentPercent: number | null
	audioPositionSeconds: number | null
	audioDurationSeconds: number | null
} {
	const current = unwrapSpreadsheetLiteral(currentRaw).trim()
	const total = unwrapSpreadsheetLiteral(totalRaw).trim()

	if (modeHint === 'PERCENT' || current.includes('%')) {
		const num = Number(current.replace('%', '').replace(',', '.'))
		return {
			progressMode: 'PERCENT',
			currentPage: null,
			totalPages: null,
			currentPercent: Number.isFinite(num)
				? Math.min(100, Math.max(0, num))
				: null,
			audioPositionSeconds: null,
			audioDurationSeconds: null,
		}
	}

	if (modeHint === 'TIME' || format === 'AUDIOBOOK') {
		return {
			progressMode: 'TIME',
			currentPage: null,
			totalPages: null,
			currentPercent: null,
			audioPositionSeconds: parseClock(current),
			audioDurationSeconds: parseClock(total),
		}
	}

	const curPage = parseIntLoose(current)
	const totPage = parseIntLoose(total)
	return {
		progressMode: 'PAGES',
		currentPage: curPage,
		totalPages: totPage,
		currentPercent: null,
		audioPositionSeconds: null,
		audioDurationSeconds: null,
	}
}

function parseIntLoose (raw: string): number | null {
	if (!raw) {
		return null
	}
	const n = Number(raw.replace(/\s/g, '').replace(',', '.'))
	if (!Number.isFinite(n) || n < 0) {
		return null
	}
	return Math.trunc(n)
}

function parseClock (raw: string): number | null {
	if (!raw) {
		return null
	}
	const parts = raw.split(':').map((p) => Number(p))
	if (parts.some((p) => !Number.isFinite(p))) {
		return null
	}
	if (parts.length === 3) {
		return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
	}
	if (parts.length === 2) {
		return parts[0]! * 60 + parts[1]!
	}
	return null
}

export function splitShelves (raw: string): string[] {
	const text = unwrapSpreadsheetLiteral(raw).trim()
	if (!text) {
		return []
	}
	return text
		.split(/[,;]/)
		.map((s) => s.trim())
		.filter(Boolean)
}

export function shelfKey (name: string): string {
	return normalizeText(name)
}

export { normalizeText }
