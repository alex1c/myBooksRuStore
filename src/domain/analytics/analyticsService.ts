/**
 * Central analytics service — UI/domain call this, never AppMetrica directly.
 * Best-effort: never blocks user operations; privacy-guarded params.
 */

import {
	ANALYTICS_PRIVACY_GUARD_ENABLED,
	APPMETRICA_LOGS_ENABLED,
} from '@/config/analytics'
import { logger } from '@/services/logging'
import type { AnalyticsAdapter } from './analyticsAdapter'
import { createAppMetricaAdapter } from './appMetricaAdapter'
import { createMemoryAnalyticsAdapter } from './analyticsAdapter'
import {
	assertAnalyticsParamsSafe,
	assertAnalyticsParamsSerializable,
} from './privacy'
import type { AnalyticsEventName, AnalyticsParams } from './types'

let adapter: AnalyticsAdapter | null = null
let initialized = false

function isJestRuntime (): boolean {
	return typeof process !== 'undefined' && !!process.env.JEST_WORKER_ID
}

function getAdapter (): AnalyticsAdapter {
	if (!adapter) {
		adapter = isJestRuntime()
			? createMemoryAnalyticsAdapter()
			: createAppMetricaAdapter()
	}
	return adapter
}

/**
 * Replace the analytics adapter (tests / offline simulation).
 */
export function setAnalyticsAdapter (next: AnalyticsAdapter | null): void {
	adapter = next
	initialized = false
}

/**
 * Initialize analytics once after local bootstrap — fire-and-forget.
 * Never awaits in the critical startup path.
 */
export function initializeAnalytics (): void {
	if (initialized) {
		return
	}
	initialized = true
	try {
		const result = getAdapter().initialize()
		if (result && typeof (result as Promise<void>).then === 'function') {
			void (result as Promise<void>).catch((error) => {
				logger.warn('Analytics initialize rejected', { error })
			})
		}
	} catch (error) {
		logger.warn('Analytics initialize failed', { error })
	}
}

/**
 * Track a product event. Never throws to callers.
 * In development/tests, forbidden keys are rejected (logged) and not sent.
 */
export function track (
	event: AnalyticsEventName,
	params?: AnalyticsParams,
): void {
	try {
		assertAnalyticsParamsSerializable(params)
		if (ANALYTICS_PRIVACY_GUARD_ENABLED) {
			assertAnalyticsParamsSafe(params)
		}
		getAdapter().track(event, params)
	} catch (error) {
		if (APPMETRICA_LOGS_ENABLED || isJestRuntime()) {
			logger.warn('Analytics track skipped', {
				event,
				error: error instanceof Error ? error.message : String(error),
			})
		}
		// Swallow — analytics must never break UX.
	}
}

/**
 * Track helper that rethrows privacy errors (for unit tests of the guard).
 */
export function trackStrict (
	event: AnalyticsEventName,
	params?: AnalyticsParams,
): void {
	assertAnalyticsParamsSerializable(params)
	assertAnalyticsParamsSafe(params)
	getAdapter().track(event, params)
}

export { createMemoryAnalyticsAdapter }
