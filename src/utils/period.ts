/**
 * Local calendar period helpers for streaks, calendar, and goals.
 * Week starts Monday (ru-RU). All day keys are YYYY-MM-DD in local TZ.
 */

import type { GoalPeriod } from '@/constants/domain'
import { toDateOnlyLocal } from '@/utils/dates'
import { toLocalDayKey } from '@/utils/diaryDates'

export { toLocalDayKey }

/** Parse YYYY-MM-DD into a local Date at midnight. */
export function parseLocalDayKey (dayKey: string): Date {
	const [year, month, day] = dayKey.split('-').map(Number)
	return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0)
}

/** Add whole days to a day key. */
export function addLocalDays (dayKey: string, deltaDays: number): string {
	const date = parseLocalDayKey(dayKey)
	date.setDate(date.getDate() + deltaDays)
	return toDateOnlyLocal(date)
}

export function compareDayKeys (a: string, b: string): number {
	return a.localeCompare(b)
}

/** Inclusive list of day keys from start through end. */
export function eachLocalDay (startKey: string, endKey: string): string[] {
	const out: string[] = []
	let cursor = startKey
	while (compareDayKeys(cursor, endKey) <= 0) {
		out.push(cursor)
		cursor = addLocalDays(cursor, 1)
		// Safety for runaway ranges (≈3 years).
		if (out.length > 1200) {
			break
		}
	}
	return out
}

/**
 * Monday of the week containing dayKey (ISO week, Monday-first).
 * getDay(): 0=Sun … 6=Sat → offset to Monday.
 */
export function startOfWeekMonday (dayKey: string): string {
	const date = parseLocalDayKey(dayKey)
	const day = date.getDay()
	const offset = day === 0 ? -6 : 1 - day
	date.setDate(date.getDate() + offset)
	return toDateOnlyLocal(date)
}

export function endOfWeekSunday (dayKey: string): string {
	return addLocalDays(startOfWeekMonday(dayKey), 6)
}

export function startOfMonth (dayKey: string): string {
	const date = parseLocalDayKey(dayKey)
	return toDateOnlyLocal(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function endOfMonth (dayKey: string): string {
	const date = parseLocalDayKey(dayKey)
	return toDateOnlyLocal(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

export function startOfYear (dayKey: string): string {
	const date = parseLocalDayKey(dayKey)
	return toDateOnlyLocal(new Date(date.getFullYear(), 0, 1))
}

export function endOfYear (dayKey: string): string {
	const date = parseLocalDayKey(dayKey)
	return toDateOnlyLocal(new Date(date.getFullYear(), 11, 31))
}

export interface PeriodRange {
	startKey: string
	endKey: string
}

/**
 * Calendar period containing `anchorDay` (usually today).
 * Goals use the current period bounds, not «since goal creation».
 */
export function periodRangeFor (
	period: GoalPeriod,
	anchorDay: string,
): PeriodRange {
	if (period === 'DAY') {
		return { startKey: anchorDay, endKey: anchorDay }
	}
	if (period === 'WEEK') {
		return {
			startKey: startOfWeekMonday(anchorDay),
			endKey: endOfWeekSunday(anchorDay),
		}
	}
	if (period === 'MONTH') {
		return {
			startKey: startOfMonth(anchorDay),
			endKey: endOfMonth(anchorDay),
		}
	}
	return {
		startKey: startOfYear(anchorDay),
		endKey: endOfYear(anchorDay),
	}
}

/**
 * Approximate UTC ISO bounds covering local days [startKey, endKey] inclusive.
 * Adds ±14h slack so edge-of-timezone events are not dropped before local bucketing.
 */
export function isoRangeCoveringLocalDays (
	startKey: string,
	endKey: string,
): { fromIso: string; toIso: string } {
	const start = parseLocalDayKey(startKey)
	start.setHours(start.getHours() - 14)
	const end = parseLocalDayKey(endKey)
	end.setDate(end.getDate() + 1)
	end.setHours(end.getHours() + 14)
	return {
		fromIso: start.toISOString(),
		toIso: end.toISOString(),
	}
}

export function formatMonthTitle (year: number, monthIndex: number): string {
	const date = new Date(year, monthIndex, 1)
	return date.toLocaleDateString('ru-RU', {
		month: 'long',
		year: 'numeric',
	})
}

/** Shift calendar month; monthIndex is 0–11. */
export function shiftMonth (
	year: number,
	monthIndex: number,
	delta: number,
): { year: number; monthIndex: number } {
	const date = new Date(year, monthIndex + delta, 1)
	return { year: date.getFullYear(), monthIndex: date.getMonth() }
}
