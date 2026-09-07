/**
 * Backup format constants (Phase 9).
 */

export const BACKUP_FORMAT_ID = 'mybooks-backup' as const
export const BACKUP_FORMAT_VERSION = 1 as const
export const APP_VERSION = '1.0.0' as const

export const BACKUP_MANIFEST_NAME = 'manifest.json'
export const BACKUP_DATA_NAME = 'data.json'
export const BACKUP_COVERS_DIR = 'covers'

/** Settings keys included in backup (user preferences only). */
export const BACKUP_SETTINGS_KEYS = [
	'reminder_enabled',
	'reminder_time',
	'default_progress_mode',
	'theme',
	'onboarding_completed',
	'analytics_consent',
] as const
