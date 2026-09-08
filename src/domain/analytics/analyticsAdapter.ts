/**
 * Analytics adapter interface — production AppMetrica vs in-memory test double.
 */

import type { AnalyticsEventName, AnalyticsParams } from './types'

export interface AnalyticsAdapter {
	/** Best-effort SDK activation. Must never throw to callers of analyticsService. */
	initialize (): Promise<void> | void
	/** Best-effort event report. */
	track (event: AnalyticsEventName, params?: AnalyticsParams): void
}

/**
 * In-memory adapter for Jest and environments without native modules.
 */
export function createMemoryAnalyticsAdapter (): AnalyticsAdapter & {
	events: { event: AnalyticsEventName; params?: AnalyticsParams }[]
	reset (): void
} {
	const events: { event: AnalyticsEventName; params?: AnalyticsParams }[] =
		[]

	return {
		events,
		reset () {
			events.length = 0
		},
		initialize () {
			// No-op for tests.
		},
		track (event, params) {
			events.push({ event, params })
		},
	}
}
