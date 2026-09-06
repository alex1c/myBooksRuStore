/**
 * ISBN normalization, validation, and Bookland EAN helpers.
 */

export type IsbnKind = 'ISBN10' | 'ISBN13'

/** Strip spaces/hyphens and uppercase X. */
export function normalizeIsbnDigits (raw: string): string {
	return raw.replace(/[\s-]/g, '').toUpperCase()
}

export function looksLikeIsbnQuery (raw: string): boolean {
	const value = normalizeIsbnDigits(raw)
	return /^\d{9}[\dX]$/.test(value) || /^\d{13}$/.test(value)
}

export function detectIsbnKind (normalized: string): IsbnKind | null {
	if (/^\d{9}[\dX]$/.test(normalized)) {
		return 'ISBN10'
	}
	if (/^\d{13}$/.test(normalized)) {
		return 'ISBN13'
	}
	return null
}

/** ISBN-10 checksum (mod 11, X = 10). */
export function isValidIsbn10Checksum (normalized: string): boolean {
	if (!/^\d{9}[\dX]$/.test(normalized)) {
		return false
	}
	let sum = 0
	for (let i = 0; i < 9; i += 1) {
		sum += Number(normalized[i]) * (10 - i)
	}
	const check = normalized[9] === 'X' ? 10 : Number(normalized[9])
	sum += check
	return sum % 11 === 0
}

/** ISBN-13 checksum (mod 10). */
export function isValidIsbn13Checksum (normalized: string): boolean {
	if (!/^\d{13}$/.test(normalized)) {
		return false
	}
	let sum = 0
	for (let i = 0; i < 12; i += 1) {
		const digit = Number(normalized[i])
		sum += i % 2 === 0 ? digit : digit * 3
	}
	const check = (10 - (sum % 10)) % 10
	return check === Number(normalized[12])
}

/**
 * Bookland EAN-13 starts with 978 or 979 and is a valid ISBN-13.
 * Non-book EAN-13 barcodes must be rejected by the scanner.
 */
export function isBooklandEan13 (raw: string): boolean {
	const value = normalizeIsbnDigits(raw)
	if (!/^\d{13}$/.test(value)) {
		return false
	}
	if (!(value.startsWith('978') || value.startsWith('979'))) {
		return false
	}
	return isValidIsbn13Checksum(value)
}

export interface ParsedIsbn {
	normalized: string
	kind: IsbnKind
	checksumValid: boolean
}

/**
 * Parse user/scanner input into ISBN-10/13.
 * Checksum validity is reported but callers may still search as free text.
 */
export function parseIsbn (raw: string): ParsedIsbn | null {
	const normalized = normalizeIsbnDigits(raw)
	const kind = detectIsbnKind(normalized)
	if (!kind) {
		return null
	}
	const checksumValid =
		kind === 'ISBN10'
			? isValidIsbn10Checksum(normalized)
			: isValidIsbn13Checksum(normalized)
	return { normalized, kind, checksumValid }
}

/** Prefer ISBN-13 when both present; store normalized digits only. */
export function pickIsbnFields (isbns: string[]): {
	isbn10: string | null
	isbn13: string | null
} {
	let isbn10: string | null = null
	let isbn13: string | null = null
	for (const raw of isbns) {
		const parsed = parseIsbn(raw)
		if (!parsed) {
			continue
		}
		if (parsed.kind === 'ISBN13' && !isbn13) {
			isbn13 = parsed.normalized
		}
		if (parsed.kind === 'ISBN10' && !isbn10) {
			isbn10 = parsed.normalized
		}
	}
	return { isbn10, isbn13 }
}
