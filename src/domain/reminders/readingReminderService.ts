/**
 * Reading reminder domain service — schedule / reschedule / disable (Phase 12).
 *
 * Reschedule strategy:
 * 1. validate
 * 2. schedule NEW notifications
 * 3. on success → cancel OLD ids + persist settings/ids
 * 4. on failure → cancel the newly created ids only; leave prior schedules/settings
 *
 * Permission policy: enabled stays false until permission is granted.
 */

import {
	getAppSettings,
	getReminderScheduleIds,
	normalizeWeekdays,
	setReminderEnabled,
	setReminderScheduleIds,
	setReminderTime,
	setReminderWeekdays,
} from '@/db/repositories/settings'
import { SqlExecutor } from '@/db/sqlExecutor'

import {
	getNotificationsAdapter,
	type NotificationsAdapter,
} from './notificationsAdapter'
import { READING_REMINDER_CHANNEL_ID, READING_REMINDER_DATA_TYPE } from './constants'
import {
	parseReminderTime,
	validateReminderConfig,
} from './reminderValidation'
import { isoWeekdayToExpo } from './weekdayMapping'

export const READING_REMINDER_ID_PREFIX = 'reading-reminder-'

/** Monotonic suffix so rapid re-saves never reuse identifiers within the same ms. */
let reminderScheduleSeq = 0

export interface ReadingReminderContent {
	title: string
	body: string
}

/** Generic Phase 12 content (avoids stale book titles in recurring schedules). */
export const DEFAULT_REMINDER_CONTENT: ReadingReminderContent = {
	title: 'Время почитать',
	body: 'Найдётся несколько минут для чтения?',
}

export interface SaveReadingRemindersInput {
	enabled: boolean
	time: string
	weekdays: number[]
	content?: ReadingReminderContent
}

export type SaveReadingRemindersResult =
	| { ok: true; scheduledIds: string[] }
	| {
			ok: false
			reason: 'validation' | 'permission' | 'schedule'
			message: string
	  }

function nextReminderScheduleToken (): string {
	reminderScheduleSeq += 1
	return `${Date.now()}-${reminderScheduleSeq}`
}

function reminderIdentifier (expoWeekday: number, token: string): string {
	return `${READING_REMINDER_ID_PREFIX}${expoWeekday}-${token}`
}

/**
 * Persist + (re)schedule reading reminders. Idempotent for duplicate saves.
 */
export async function saveReadingReminders (
	db: SqlExecutor,
	input: SaveReadingRemindersInput,
	adapter: NotificationsAdapter = getNotificationsAdapter(),
): Promise<SaveReadingRemindersResult> {
	const weekdays = normalizeWeekdays(input.weekdays)
	const validationError = validateReminderConfig({
		enabled: input.enabled,
		time: input.time,
		weekdays,
	})
	if (validationError) {
		return {
			ok: false,
			reason: 'validation',
			message: validationError,
		}
	}

	if (!input.enabled) {
		await cancelReadingReminders(db, adapter)
		await setReminderEnabled(db, false)
		await setReminderTime(db, input.time)
		await setReminderWeekdays(db, weekdays.length > 0 ? weekdays : [1, 2, 3, 4, 5, 6, 7])
		try {
			const { track } = await import('@/domain/analytics/analyticsService')
			const { AnalyticsEvents } = await import('@/domain/analytics/types')
			track(AnalyticsEvents.reminderDisabled)
		} catch {
			// ignore
		}
		return { ok: true, scheduledIds: [] }
	}

	const permission = await adapter.getPermissionStatus()
	if (permission !== 'granted') {
		const requested = await adapter.requestPermission()
		if (requested !== 'granted') {
			// Keep preference off until permission is actually granted.
			await setReminderEnabled(db, false)
			await setReminderTime(db, input.time)
			await setReminderWeekdays(db, weekdays)
			return {
				ok: false,
				reason: 'permission',
				message: 'Уведомления отключены для приложения.',
			}
		}
	}

	const parsed = parseReminderTime(input.time)!
	const content = input.content ?? DEFAULT_REMINDER_CONTENT
	const previousIds = await getReminderScheduleIds(db)
	const token = nextReminderScheduleToken()
	const createdIds: string[] = []

	try {
		await adapter.ensureAndroidChannel()
		for (const isoDay of weekdays) {
			const expoDay = isoWeekdayToExpo(isoDay)
			const identifier = reminderIdentifier(expoDay, token)
			const id = await adapter.scheduleNotification({
				identifier,
				title: content.title,
				body: content.body,
				data: { type: READING_REMINDER_DATA_TYPE },
				trigger: {
					type: 'weekly',
					weekday: expoDay,
					hour: parsed.hour,
					minute: parsed.minute,
					channelId: READING_REMINDER_CHANNEL_ID,
				},
			})
			createdIds.push(id)
		}

		if (previousIds.length > 0) {
			await adapter.cancelScheduledNotifications(previousIds)
		}

		await setReminderTime(db, input.time)
		await setReminderWeekdays(db, weekdays)
		await setReminderScheduleIds(db, createdIds)
		await setReminderEnabled(db, true)

		try {
			const { track } = await import('@/domain/analytics/analyticsService')
			const { AnalyticsEvents } = await import('@/domain/analytics/types')
			track(AnalyticsEvents.reminderEnabled, {
				days_count: weekdays.length,
			})
		} catch {
			// ignore
		}

		return { ok: true, scheduledIds: createdIds }
	} catch {
		if (createdIds.length > 0) {
			try {
				await adapter.cancelScheduledNotifications(createdIds)
			} catch {
				// Best-effort cleanup of partial new schedules.
			}
		}
		return {
			ok: false,
			reason: 'schedule',
			message: 'Не удалось настроить напоминания.',
		}
	}
}

export async function cancelReadingReminders (
	db: SqlExecutor,
	adapter: NotificationsAdapter = getNotificationsAdapter(),
): Promise<void> {
	const stored = await getReminderScheduleIds(db)
	if (stored.length > 0) {
		await adapter.cancelScheduledNotifications(stored)
	}
	// Also cancel any leftover ids by namespace (reinstall / partial state).
	const scheduled = await adapter.getScheduledNotifications()
	const leftovers = scheduled
		.filter(
			(n) =>
				n.identifier.startsWith(READING_REMINDER_ID_PREFIX) ||
				n.data?.type === READING_REMINDER_DATA_TYPE,
		)
		.map((n) => n.identifier)
	if (leftovers.length > 0) {
		await adapter.cancelScheduledNotifications(leftovers)
	}
	await setReminderScheduleIds(db, [])
}

/**
 * Light reconciliation: if settings say enabled but no schedules exist, rebuild.
 * Safe to call infrequently (e.g. opening reminders screen) — not every cold start.
 */
export async function reconcileReadingReminders (
	db: SqlExecutor,
	adapter: NotificationsAdapter = getNotificationsAdapter(),
): Promise<void> {
	const settings = await getAppSettings(db)
	if (!settings.reminderEnabled) {
		return
	}
	const permission = await adapter.getPermissionStatus()
	if (permission !== 'granted') {
		return
	}
	const ids = await getReminderScheduleIds(db)
	const scheduled = await adapter.getScheduledNotifications()
	const live = new Set(scheduled.map((s) => s.identifier))
	const missing = ids.filter((id) => !live.has(id))
	if (ids.length > 0 && missing.length === 0) {
		return
	}
	await saveReadingReminders(db, {
		enabled: true,
		time: settings.reminderTime,
		weekdays: settings.reminderWeekdays,
	}, adapter)
}

export function isReadingReminderNotification (data: {
	type?: unknown
}): boolean {
	return data.type === READING_REMINDER_DATA_TYPE
}
