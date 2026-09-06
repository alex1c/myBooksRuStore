/**
 * Local calendar day helpers for diary timeline grouping / labels.
 * DB stores ISO timestamps; presentation converts to local day buckets.
 */

import { toDateOnlyLocal } from '@/utils/dates'

/** YYYY-MM-DD for an ISO instant in the device local timezone. */
export function toLocalDayKey (iso: string): string {
	const date = new Date(iso)
	if (!Number.isFinite(date.getTime())) {
		return iso.slice(0, 10)
	}
	return toDateOnlyLocal(date)
}

/**
 * Human section title: «Сегодня», «Вчера», or «6 сентября».
 */
export function formatDiaryDayTitle (
	dayKey: string,
	now: Date = new Date(),
): string {
	const today = toDateOnlyLocal(now)
	const yesterdayDate = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate() - 1,
	)
	const yesterday = toDateOnlyLocal(yesterdayDate)

	if (dayKey === today) {
		return 'Сегодня'
	}
	if (dayKey === yesterday) {
		return 'Вчера'
	}

	const [year, month, day] = dayKey.split('-').map(Number)
	if (!year || !month || !day) {
		return dayKey
	}
	const probe = new Date(year, month - 1, day)
	const sameYear = probe.getFullYear() === now.getFullYear()
	return probe.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		...(sameYear ? {} : { year: 'numeric' }),
	})
}

/** Compact timestamp like `6 сентября · 21:14`. */
export function formatDiaryDateTime (iso: string): string {
	const date = new Date(iso)
	if (!Number.isFinite(date.getTime())) {
		return iso
	}
	const day = date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
	})
	const time = date.toLocaleTimeString('ru-RU', {
		hour: '2-digit',
		minute: '2-digit',
	})
	return `${day} · ${time}`
}
