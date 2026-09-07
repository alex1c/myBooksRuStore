/**
 * Date / time helpers for the reading diary.
 *
 * - Instant timestamps: ISO-8601 UTC strings (…Z)
 * - Calendar dates for future stats/streaks: YYYY-MM-DD (local calendar day)
 * Never mix localized display strings into persisted business data.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Returns current instant as ISO-8601 UTC string. */
export function nowIso (): string {
	return new Date().toISOString()
}

/**
 * Validates a calendar date string (YYYY-MM-DD).
 * Avoids UTC midnight conversion to prevent timezone day shifts.
 */
export function isDateOnly (value: string): boolean {
	if (!DATE_ONLY_RE.test(value)) {
		return false
	}

	const [year, month, day] = value.split('-').map(Number)
	const probe = new Date(year, month - 1, day)
	return (
		probe.getFullYear() === year &&
		probe.getMonth() === month - 1 &&
		probe.getDate() === day
	)
}

/**
 * Formats a Date into a local calendar date YYYY-MM-DD without UTC conversion.
 * Future statistics and streaks should bucket by this local day.
 */
export function toDateOnlyLocal (date: Date = new Date()): string {
	const year = date.getFullYear()
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${year}-${month}-${day}`
}

/**
 * User-facing Russian date from YYYY-MM-DD (e.g. `7 сентября 2026`).
 * Returns the original string if parsing fails.
 */
export function formatDateRu (dateOnly: string): string {
	if (!isDateOnly(dateOnly)) {
		return dateOnly
	}
	const [year, month, day] = dateOnly.split('-').map(Number)
	const date = new Date(year!, month! - 1, day!)
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

/**
 * Compact form helper label: `07.09.2026` for picker fields.
 */
export function formatDateShortRu (dateOnly: string): string {
	if (!isDateOnly(dateOnly)) {
		return dateOnly
	}
	const [year, month, day] = dateOnly.split('-')
	return `${day}.${month}.${year}`
}
