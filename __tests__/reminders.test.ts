/**
 * Phase 12 — local reading reminders (settings, mapping, schedule, permission).
 */

import { applyMigrations } from '@/db/migrations/applyMigrations'
import {
	DEFAULT_SETTINGS,
	ensureAppSettings,
	getAppSettings,
	getReminderScheduleIds,
	setReminderEnabled,
	setReminderScheduleIds,
	setReminderTime,
	setReminderWeekdays,
} from '@/db/repositories/settings'
import { READING_REMINDER_CHANNEL_ID, READING_REMINDER_DATA_TYPE } from '@/domain/reminders/constants'
import { createMockNotificationsAdapter } from '@/domain/reminders/mockNotificationsAdapter'
import { setNotificationsAdapter } from '@/domain/reminders/notificationsAdapter'
import {
	isReadingReminderNotification,
	reconcileReadingReminders,
	saveReadingReminders,
} from '@/domain/reminders/readingReminderService'
import {
	parseReminderTime,
	validateReminderConfig,
} from '@/domain/reminders/reminderValidation'
import {
	ALL_ISO_WEEKDAYS,
	expoWeekdayToIso,
	isoWeekdayToExpo,
} from '@/domain/reminders/weekdayMapping'
import { createTestSqlExecutor } from './helpers/testDatabase'

async function emptyDb () {
	const db = createTestSqlExecutor()
	await applyMigrations(db)
	await ensureAppSettings(db)
	return db
}

describe('reminder settings defaults', () => {
	it('defaults to disabled, 21:00, all weekdays', async () => {
		const db = await emptyDb()
		const settings = await getAppSettings(db)
		expect(settings.reminderEnabled).toBe(false)
		expect(settings.reminderTime).toBe('21:00')
		expect(settings.reminderWeekdays).toEqual([1, 2, 3, 4, 5, 6, 7])
		expect(DEFAULT_SETTINGS.reminderEnabled).toBe(false)
	})

	it('persists time and weekdays', async () => {
		const db = await emptyDb()
		await setReminderTime(db, '08:30')
		await setReminderWeekdays(db, [1, 3, 5])
		await setReminderEnabled(db, false)
		const settings = await getAppSettings(db)
		expect(settings.reminderTime).toBe('08:30')
		expect(settings.reminderWeekdays).toEqual([1, 3, 5])
		expect(settings.reminderEnabled).toBe(false)
	})
})

describe('reminder validation', () => {
	it('accepts boundary times', () => {
		expect(parseReminderTime('21:00')).toEqual({ hour: 21, minute: 0 })
		expect(parseReminderTime('00:00')).toEqual({ hour: 0, minute: 0 })
		expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 })
		expect(validateReminderConfig({
			enabled: true,
			time: '21:00',
			weekdays: [1],
		})).toBeNull()
	})

	it('rejects invalid hour/minute', () => {
		expect(parseReminderTime('24:00')).toBeNull()
		expect(parseReminderTime('12:60')).toBeNull()
		expect(parseReminderTime('9:00')).toBeNull()
		expect(validateReminderConfig({
			enabled: false,
			time: '99:99',
			weekdays: [],
		})).toMatch(/ЧЧ:ММ/)
	})

	it('requires at least one weekday when enabled', () => {
		expect(validateReminderConfig({
			enabled: true,
			time: '21:00',
			weekdays: [],
		})).toBe('Выберите хотя бы один день.')
		expect(validateReminderConfig({
			enabled: false,
			time: '21:00',
			weekdays: [],
		})).toBeNull()
	})
})

describe('weekday mapping', () => {
	it('maps Monday and Sunday without off-by-one', () => {
		// ISO Mon=1 → Expo Mon=2; ISO Sun=7 → Expo Sun=1
		expect(isoWeekdayToExpo(1)).toBe(2)
		expect(isoWeekdayToExpo(7)).toBe(1)
		expect(expoWeekdayToIso(2)).toBe(1)
		expect(expoWeekdayToIso(1)).toBe(7)
	})

	it('round-trips all seven weekdays', () => {
		for (const iso of ALL_ISO_WEEKDAYS) {
			expect(expoWeekdayToIso(isoWeekdayToExpo(iso))).toBe(iso)
		}
	})
})

describe('reading reminder scheduling', () => {
	afterEach(() => {
		setNotificationsAdapter(null)
	})

	it('schedules expected weekly notifications with channel/data', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})
		setNotificationsAdapter(adapter)

		const result = await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 3, 5],
		}, adapter)

		expect(result.ok).toBe(true)
		expect(state.scheduled).toHaveLength(3)
		const weekdays = state.scheduled.map((s) => s.weekday).sort()
		// Mon/Wed/Fri → Expo 2/4/6
		expect(weekdays).toEqual([2, 4, 6])
		for (const item of state.scheduled) {
			expect(item.hour).toBe(21)
			expect(item.minute).toBe(0)
			expect(item.channelId).toBe(READING_REMINDER_CHANNEL_ID)
			expect(item.data?.type).toBe(READING_REMINDER_DATA_TYPE)
		}
		expect(READING_REMINDER_CHANNEL_ID).toBe('reading-reminders')
		const settings = await getAppSettings(db)
		expect(settings.reminderEnabled).toBe(true)
		expect(await getReminderScheduleIds(db)).toHaveLength(3)
	})

	it('reschedule replaces old identifiers (no duplicates)', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})

		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 3, 5],
		}, adapter)
		const firstIds = [...state.scheduled.map((s) => s.identifier)]

		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 3, 5],
		}, adapter)
		expect(state.scheduled).toHaveLength(3)
		const secondIds = state.scheduled.map((s) => s.identifier)
		expect(secondIds.every((id) => !firstIds.includes(id))).toBe(true)

		await saveReadingReminders(db, {
			enabled: true,
			time: '20:30',
			weekdays: [2, 4],
		}, adapter)
		expect(state.scheduled).toHaveLength(2)
		expect(state.scheduled.map((s) => s.weekday).sort()).toEqual([3, 5])
		expect(state.scheduled.every((s) => s.hour === 20 && s.minute === 30)).toBe(
			true,
		)
	})

	it('integration: enable → duplicate save → change → disable', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})

		expect((await getAppSettings(db)).reminderEnabled).toBe(false)

		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 3, 5],
		}, adapter)
		expect(state.scheduled).toHaveLength(3)

		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 3, 5],
		}, adapter)
		expect(state.scheduled).toHaveLength(3)

		await saveReadingReminders(db, {
			enabled: true,
			time: '20:30',
			weekdays: [2, 4],
		}, adapter)
		expect(state.scheduled).toHaveLength(2)

		await saveReadingReminders(db, {
			enabled: false,
			time: '20:30',
			weekdays: [2, 4],
		}, adapter)
		expect(state.scheduled).toHaveLength(0)
		expect((await getAppSettings(db)).reminderEnabled).toBe(false)
		expect(await getReminderScheduleIds(db)).toEqual([])
	})

	it('disable cancels all reading reminders', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})
		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: ALL_ISO_WEEKDAYS,
		}, adapter)
		expect(state.scheduled).toHaveLength(7)

		await saveReadingReminders(db, {
			enabled: false,
			time: '21:00',
			weekdays: ALL_ISO_WEEKDAYS,
		}, adapter)
		expect(state.scheduled).toHaveLength(0)
	})

	it('permission denied does not schedule and keeps enabled false', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'denied',
		})

		const result = await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 2, 3],
		}, adapter)

		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.reason).toBe('permission')
		}
		expect(state.scheduled).toHaveLength(0)
		const settings = await getAppSettings(db)
		expect(settings.reminderEnabled).toBe(false)
		expect(settings.reminderTime).toBe('21:00')
		expect(settings.reminderWeekdays).toEqual([1, 2, 3])
	})

	it('permission granted path requests when undetermined', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'undetermined',
		})
		const result = await saveReadingReminders(db, {
			enabled: true,
			time: '09:15',
			weekdays: [7],
		}, adapter)
		expect(result.ok).toBe(true)
		expect(state.permission).toBe('granted')
		expect(state.scheduled).toHaveLength(1)
		expect(state.scheduled[0]?.weekday).toBe(1) // Sunday
	})

	it('schedule failure does not persist success state', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
			scheduleFailOnce: true,
		})

		const result = await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1],
		}, adapter)

		expect(result.ok).toBe(false)
		if (!result.ok) {
			expect(result.reason).toBe('schedule')
		}
		expect(state.scheduled).toHaveLength(0)
		expect((await getAppSettings(db)).reminderEnabled).toBe(false)
		expect(await getReminderScheduleIds(db)).toEqual([])
	})

	it('schedule failure keeps previous schedules when rescheduling', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})
		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 3],
		}, adapter)
		expect(state.scheduled).toHaveLength(2)
		const previousIds = state.scheduled.map((s) => s.identifier)

		state.scheduleFailOnce = true
		const result = await saveReadingReminders(db, {
			enabled: true,
			time: '22:00',
			weekdays: [2],
		}, adapter)
		expect(result.ok).toBe(false)
		expect(state.scheduled.map((s) => s.identifier)).toEqual(previousIds)
		const settings = await getAppSettings(db)
		expect(settings.reminderEnabled).toBe(true)
		expect(settings.reminderTime).toBe('21:00')
		expect(settings.reminderWeekdays).toEqual([1, 3])
	})

	it('restart: settings persist; re-init does not duplicate schedules', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})
		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 5],
		}, adapter)
		expect(state.scheduled).toHaveLength(2)

		await ensureAppSettings(db)
		const settings = await getAppSettings(db)
		expect(settings.reminderEnabled).toBe(true)
		expect(settings.reminderWeekdays).toEqual([1, 5])
		expect(state.scheduled).toHaveLength(2)

		await reconcileReadingReminders(db, adapter)
		expect(state.scheduled).toHaveLength(2)
	})

	it('reconcile rebuilds missing schedules', async () => {
		const db = await emptyDb()
		const { adapter, state } = createMockNotificationsAdapter({
			permission: 'granted',
		})
		await saveReadingReminders(db, {
			enabled: true,
			time: '21:00',
			weekdays: [1, 2, 3],
		}, adapter)
		state.scheduled = []
		await setReminderScheduleIds(db, ['stale-id'])

		await reconcileReadingReminders(db, adapter)
		expect(state.scheduled).toHaveLength(3)
		expect((await getAppSettings(db)).reminderEnabled).toBe(true)
	})
})

describe('notification tap routing intent', () => {
	it('recognizes reading_reminder data', () => {
		expect(isReadingReminderNotification({ type: 'reading_reminder' })).toBe(
			true,
		)
	})

	it('ignores unrelated notification types', () => {
		expect(isReadingReminderNotification({ type: 'promo' })).toBe(false)
		expect(isReadingReminderNotification({})).toBe(false)
		expect(isReadingReminderNotification({ type: 1 })).toBe(false)
	})
})
