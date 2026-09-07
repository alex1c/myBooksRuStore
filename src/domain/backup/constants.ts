/**
 * Backup format constants (Phase 9).
 */

export const BACKUP_FORMAT_ID = 'mybooks-backup' as const
export const BACKUP_FORMAT_VERSION = 1 as const
export const APP_VERSION = '1.0.0' as const

export const BACKUP_MANIFEST_NAME = 'manifest.json'
export const BACKUP_DATA_NAME = 'data.json'
export const BACKUP_COVERS_DIR = 'covers'

/** Defensive limits for user-selected ZIPs (large enough for a real library). */
export const MAX_BACKUP_MANIFEST_BYTES = 1 * 1024 * 1024
export const MAX_BACKUP_DATA_BYTES = 64 * 1024 * 1024
export const MAX_BACKUP_COVER_FILES = 10_000
export const MAX_BACKUP_COVER_BYTES = 16 * 1024 * 1024
export const MAX_BACKUP_TOTAL_COVER_BYTES = 256 * 1024 * 1024

/** Settings keys included in backup (user preferences only). */
export const BACKUP_SETTINGS_KEYS = [
	'reminder_enabled',
	'reminder_time',
	'reminder_weekdays',
	'default_progress_mode',
	'theme',
	'onboarding_completed',
	'analytics_consent',
] as const
