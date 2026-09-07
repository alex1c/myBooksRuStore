/**
 * Russian number / plural / stats time formatting.
 */

/** Space-grouped integers: `1 284`. */
export function formatIntegerRu (value: number): string {
	const safe = Math.trunc(Math.abs(value))
	const sign = value < 0 ? '-' : ''
	return sign + String(safe).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Rating like `4,3` (ru locale). */
export function formatRatingRu (value: number): string {
	return value.toLocaleString('ru-RU', {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	})
}

/**
 * Stats reading time: under 1h → `42 мин`; else `18 ч 42 мин` or `126 ч`.
 */
export function formatStatsDuration (totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds))
	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)
	if (hours <= 0) {
		return `${minutes} мин`
	}
	if (minutes <= 0) {
		return `${hours} ч`
	}
	if (hours >= 100) {
		return `${hours} ч`
	}
	return `${hours} ч ${minutes} мин`
}

type PluralForms = [one: string, few: string, many: string]

function pluralRu (n: number, forms: PluralForms): string {
	const abs = Math.abs(Math.trunc(n)) % 100
	const last = abs % 10
	if (abs > 10 && abs < 20) {
		return forms[2]
	}
	if (last === 1) {
		return forms[0]
	}
	if (last >= 2 && last <= 4) {
		return forms[1]
	}
	return forms[2]
}

export function formatBooksCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['книга', 'книги', 'книг'])}`
}

export function formatPagesCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['страница', 'страницы', 'страниц'])}`
}

export function formatDaysCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['день', 'дня', 'дней'])}`
}

export function formatSessionsCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['сессия', 'сессии', 'сессий'])}`
}
