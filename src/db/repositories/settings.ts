import {
	isProgressMode,
	isThemePreference,
	PROGRESS_MODES,
	type ProgressMode,
	type ThemePreference,
} from '@/constants/domain'
import { AppSettings } from '@/db/types'
import { SqlExecutor } from '@/db/sqlExecutor'

export const SETTINGS_KEYS = {
	reminderEnabled: 'reminder_enabled',
	reminderTime: 'reminder_time',
	reminderWeekdays: 'reminder_weekdays',
	reminderScheduleIds: 'reminder_schedule_ids',
	defaultProgressMode: 'default_progress_mode',
	theme: 'theme',
	onboardingCompleted: 'onboarding_completed',
	analyticsConsent: 'analytics_consent',
} as const

/** ISO weekdays Mon=1 … Sun=7 — default when reminders are first configured. */
export const DEFAULT_REMINDER_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export const DEFAULT_SETTINGS: AppSettings = {
	reminderEnabled: false,
	reminderTime: '21:00',
	reminderWeekdays: [...DEFAULT_REMINDER_WEEKDAYS],
	defaultProgressMode: 'PAGES',
	theme: 'system',
	onboardingCompleted: false,
	analyticsConsent: null,
}

/**
 * Ensures settings defaults exist in app_meta (idempotent).
 * Centralized — do not scatter AsyncStorage keys across the app.
 */
export async function ensureAppSettings (db: SqlExecutor): Promise<AppSettings> {
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[
			SETTINGS_KEYS.reminderEnabled,
			DEFAULT_SETTINGS.reminderEnabled ? '1' : '0',
		],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[SETTINGS_KEYS.reminderTime, DEFAULT_SETTINGS.reminderTime],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[
			SETTINGS_KEYS.reminderWeekdays,
			serializeWeekdays(DEFAULT_SETTINGS.reminderWeekdays),
		],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[SETTINGS_KEYS.reminderScheduleIds, '[]'],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[SETTINGS_KEYS.defaultProgressMode, DEFAULT_SETTINGS.defaultProgressMode],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[SETTINGS_KEYS.theme, DEFAULT_SETTINGS.theme],
	)
	await db.runAsync(
		`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
		[
			SETTINGS_KEYS.onboardingCompleted,
			DEFAULT_SETTINGS.onboardingCompleted ? '1' : '0',
		],
	)
	// analytics_consent stays unset until the user decides later.
	return getAppSettings(db)
}

export async function getAppSettings (db: SqlExecutor): Promise<AppSettings> {
	const reminderEnabled = await getMetaFlag(
		db,
		SETTINGS_KEYS.reminderEnabled,
		DEFAULT_SETTINGS.reminderEnabled,
	)
	const reminderTime =
		(await getMetaString(db, SETTINGS_KEYS.reminderTime)) ??
		DEFAULT_SETTINGS.reminderTime
	const weekdaysRaw = await getMetaString(db, SETTINGS_KEYS.reminderWeekdays)
	const reminderWeekdays = parseWeekdays(weekdaysRaw) ?? [
		...DEFAULT_SETTINGS.reminderWeekdays,
	]
	const progressRaw =
		(await getMetaString(db, SETTINGS_KEYS.defaultProgressMode)) ??
		DEFAULT_SETTINGS.defaultProgressMode
	const themeRaw =
		(await getMetaString(db, SETTINGS_KEYS.theme)) ?? DEFAULT_SETTINGS.theme
	const onboardingCompleted = await getMetaFlag(
		db,
		SETTINGS_KEYS.onboardingCompleted,
		DEFAULT_SETTINGS.onboardingCompleted,
	)
	const consentRaw = await getMetaString(db, SETTINGS_KEYS.analyticsConsent)

	return {
		reminderEnabled,
		reminderTime,
		reminderWeekdays,
		defaultProgressMode: isProgressMode(progressRaw)
			? progressRaw
			: DEFAULT_SETTINGS.defaultProgressMode,
		theme: isThemePreference(themeRaw) ? themeRaw : DEFAULT_SETTINGS.theme,
		onboardingCompleted,
		analyticsConsent:
			consentRaw === null
				? null
				: consentRaw === '1' || consentRaw === 'true',
	}
}

export async function setReminderEnabled (
	db: SqlExecutor,
	enabled: boolean,
): Promise<void> {
	await upsertMeta(db, SETTINGS_KEYS.reminderEnabled, enabled ? '1' : '0')
}

export async function setReminderTime (
	db: SqlExecutor,
	time: string,
): Promise<void> {
	if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
		throw new Error('INVALID_REMINDER_TIME')
	}
	await upsertMeta(db, SETTINGS_KEYS.reminderTime, time)
}

export async function setReminderWeekdays (
	db: SqlExecutor,
	weekdays: number[],
): Promise<void> {
	const normalized = normalizeWeekdays(weekdays)
	if (normalized.length === 0) {
		throw new Error('INVALID_REMINDER_WEEKDAYS')
	}
	await upsertMeta(
		db,
		SETTINGS_KEYS.reminderWeekdays,
		serializeWeekdays(normalized),
	)
}

/** Persist scheduled notification identifiers for reading reminders. */
export async function setReminderScheduleIds (
	db: SqlExecutor,
	ids: string[],
): Promise<void> {
	await upsertMeta(
		db,
		SETTINGS_KEYS.reminderScheduleIds,
		JSON.stringify(ids),
	)
}

export async function getReminderScheduleIds (
	db: SqlExecutor,
): Promise<string[]> {
	const raw = await getMetaString(db, SETTINGS_KEYS.reminderScheduleIds)
	if (!raw) {
		return []
	}
	try {
		const parsed = JSON.parse(raw) as unknown
		if (!Array.isArray(parsed)) {
			return []
		}
		return parsed.filter((v): v is string => typeof v === 'string')
	} catch {
		return []
	}
}

export async function setDefaultProgressMode (
	db: SqlExecutor,
	mode: ProgressMode,
): Promise<void> {
	if (!(PROGRESS_MODES as readonly string[]).includes(mode)) {
		throw new Error('INVALID_PROGRESS_MODE')
	}
	await upsertMeta(db, SETTINGS_KEYS.defaultProgressMode, mode)
}

export async function setThemePreference (
	db: SqlExecutor,
	theme: ThemePreference,
): Promise<void> {
	if (!isThemePreference(theme)) {
		throw new Error('INVALID_THEME')
	}
	await upsertMeta(db, SETTINGS_KEYS.theme, theme)
}

export async function setOnboardingCompleted (
	db: SqlExecutor,
	completed: boolean,
): Promise<void> {
	await upsertMeta(
		db,
		SETTINGS_KEYS.onboardingCompleted,
		completed ? '1' : '0',
	)
}

export async function setAnalyticsConsent (
	db: SqlExecutor,
	consent: boolean,
): Promise<void> {
	await upsertMeta(db, SETTINGS_KEYS.analyticsConsent, consent ? '1' : '0')
}

/** ISO Mon=1 … Sun=7, unique sorted. */
export function normalizeWeekdays (weekdays: number[]): number[] {
	const set = new Set<number>()
	for (const day of weekdays) {
		if (Number.isInteger(day) && day >= 1 && day <= 7) {
			set.add(day)
		}
	}
	return [...set].sort((a, b) => a - b)
}

export function serializeWeekdays (weekdays: number[]): string {
	return normalizeWeekdays(weekdays).join(',')
}

export function parseWeekdays (raw: string | null): number[] | null {
	if (!raw || !raw.trim()) {
		return null
	}
	const parts = raw.split(/[,\s]+/).map((p) => Number.parseInt(p, 10))
	const normalized = normalizeWeekdays(parts)
	return normalized.length > 0 ? normalized : null
}

async function getMetaString (
	db: SqlExecutor,
	key: string,
): Promise<string | null> {
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[key],
	)
	return row?.value ?? null
}

async function getMetaFlag (
	db: SqlExecutor,
	key: string,
	fallback: boolean,
): Promise<boolean> {
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[key],
	)
	if (!row) {
		return fallback
	}
	return row.value === '1' || row.value === 'true'
}

async function upsertMeta (
	db: SqlExecutor,
	key: string,
	value: string,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO app_meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		[key, value],
	)
}
