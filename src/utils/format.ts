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

export function pluralRu (n: number, forms: PluralForms): string {
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

export function formatQuotesCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['цитата', 'цитаты', 'цитат'])}`
}

export function formatThoughtsCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['мысль', 'мысли', 'мыслей'])}`
}

export function formatNotesCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['заметка', 'заметки', 'заметок'])}`
}

export function formatMinutesCount (n: number): string {
	return `${formatIntegerRu(n)} ${pluralRu(n, ['минута', 'минуты', 'минут'])}`
}

/** Whole hours for Year in Books highlights: `186 часов`. */
export function formatHoursCount (totalSeconds: number): string {
	const hours = Math.floor(Math.max(0, totalSeconds) / 3600)
	return `${formatIntegerRu(hours)} ${pluralRu(hours, ['час', 'часа', 'часов'])}`
}

/**
 * Compact note-type counts line with correct Russian plurals.
 */
export function formatNoteTypeCounts (
	quotes: number,
	thoughts: number,
	notes: number,
): string {
	return `${formatQuotesCount(quotes)} · ${formatThoughtsCount(thoughts)} · ${formatNotesCount(notes)}`
}

/**
 * Hide Start reading CTAs while an active session banner owns that action.
 */
export function shouldShowStartReadingCta (hasActiveSession: boolean): boolean {
	return !hasActiveSession
}

export function startReadingCtaLabel (input: {
	isActiveBook: boolean
	startLabel: string
	continueLabel: string
}): string {
	return input.isActiveBook ? input.continueLabel : input.startLabel
}
