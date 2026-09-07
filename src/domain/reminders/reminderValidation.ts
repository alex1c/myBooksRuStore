/**
 * Reading reminder validation — time HH:MM + ISO weekdays Mon=1…Sun=7.
 */

import { normalizeWeekdays } from '@/db/repositories/settings'

export interface ReminderConfigInput {
	enabled: boolean
	time: string
	weekdays: number[]
}

export interface ParsedReminderTime {
	hour: number
	minute: number
}

export function parseReminderTime (time: string): ParsedReminderTime | null {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim())
	if (!match) {
		return null
	}
	return {
		hour: Number.parseInt(match[1]!, 10),
		minute: Number.parseInt(match[2]!, 10),
	}
}

export function formatReminderTime (hour: number, minute: number): string {
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * Validate reminder config. When enabled, require valid time + ≥1 weekday.
 */
export function validateReminderConfig (
	input: ReminderConfigInput,
): string | null {
	const parsed = parseReminderTime(input.time)
	if (!parsed) {
		return 'Укажите время в формате ЧЧ:ММ.'
	}
	if (input.enabled) {
		const days = normalizeWeekdays(input.weekdays)
		if (days.length === 0) {
			return 'Выберите хотя бы один день.'
		}
	}
	return null
}
