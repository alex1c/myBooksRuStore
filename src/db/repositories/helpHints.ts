/**
 * One-time micro-hint flags in app_meta (centralized, not AsyncStorage).
 */

import { SqlExecutor } from '@/db/sqlExecutor'

export const HINT_KEYS = {
	todayProgress: 'hint_today_progress_seen',
	activeSession: 'hint_active_session_seen',
} as const

export type HintKey = (typeof HINT_KEYS)[keyof typeof HINT_KEYS]

export async function ensureHelpHintDefaults (db: SqlExecutor): Promise<void> {
	for (const key of Object.values(HINT_KEYS)) {
		await db.runAsync(
			`INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)`,
			[key, '0'],
		)
	}
}

export async function getMetaHintFlag (
	db: SqlExecutor,
	key: HintKey,
): Promise<boolean> {
	const row = await db.getFirstAsync<{ value: string }>(
		`SELECT value FROM app_meta WHERE key = ?`,
		[key],
	)
	if (!row) {
		return false
	}
	return row.value === '1' || row.value === 'true'
}

export async function setMetaHintFlag (
	db: SqlExecutor,
	key: HintKey,
	seen: boolean,
): Promise<void> {
	await db.runAsync(
		`INSERT INTO app_meta (key, value) VALUES (?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
		[key, seen ? '1' : '0'],
	)
}
