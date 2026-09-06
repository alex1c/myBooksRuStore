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
	defaultProgressMode: 'default_progress_mode',
	theme: 'theme',
	onboardingCompleted: 'onboarding_completed',
	analyticsConsent: 'analytics_consent',
} as const

export const DEFAULT_SETTINGS: AppSettings = {
	reminderEnabled: false,
	reminderTime: '20:00',
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
