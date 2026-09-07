/**
 * Onboarding + micro-hint helpers over centralized app settings.
 */

import {
	getAppSettings,
	setOnboardingCompleted,
} from '@/db/repositories/settings'
import { SqlExecutor } from '@/db/sqlExecutor'
import {
	getMetaHintFlag,
	setMetaHintFlag,
	HINT_KEYS,
	type HintKey,
} from '@/db/repositories/helpHints'

export async function shouldShowOnboarding (
	db: SqlExecutor,
): Promise<boolean> {
	const settings = await getAppSettings(db)
	return !settings.onboardingCompleted
}

/**
 * Mark onboarding finished (completed or skipped — same durable flag).
 * Does not create books or other demo data.
 */
export async function finishOnboarding (db: SqlExecutor): Promise<void> {
	await setOnboardingCompleted(db, true)
}

export async function isOnboardingCompleted (
	db: SqlExecutor,
): Promise<boolean> {
	const settings = await getAppSettings(db)
	return settings.onboardingCompleted
}

export async function shouldShowHint (
	db: SqlExecutor,
	key: HintKey,
): Promise<boolean> {
	return !(await getMetaHintFlag(db, key))
}

export async function dismissHint (
	db: SqlExecutor,
	key: HintKey,
): Promise<void> {
	await setMetaHintFlag(db, key, true)
}

export { HINT_KEYS }
export type { HintKey }
