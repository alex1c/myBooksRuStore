/**
 * AppMetrica native adapter.
 * Lazy-loads the SDK so Jest / Expo Go import failures stay isolated.
 */

import {
	APPMETRICA_API_KEY,
	APPMETRICA_LOGS_ENABLED,
} from '@/config/analytics'
import { logger } from '@/services/logging'
import type { AnalyticsAdapter } from './analyticsAdapter'
import type { AnalyticsEventName, AnalyticsParams } from './types'

type AppMetricaModule = {
	activate: (config: {
		apiKey: string
		logs?: boolean
		locationTracking?: boolean
		sessionTimeout?: number
	}) => void
	reportEvent: (
		eventName: string,
		attributes?: Record<string, unknown>,
	) => void
}

function tryLoadAppMetrica (): AppMetricaModule | null {
	try {
		// Dynamic require keeps Jest from needing the native binary at import time
		// when moduleNameMapper points at a mock (or when the package is absent).
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('@appmetrica/react-native-analytics')
		const AppMetrica = (mod?.default ?? mod) as AppMetricaModule | undefined
		if (!AppMetrica?.activate || !AppMetrica?.reportEvent) {
			return null
		}
		return AppMetrica
	} catch (error) {
		if (APPMETRICA_LOGS_ENABLED) {
			logger.warn('AppMetrica module unavailable', { error })
		}
		return null
	}
}

/**
 * Creates a production AppMetrica adapter.
 * Missing native module → silent no-op (app continues).
 */
export function createAppMetricaAdapter (): AnalyticsAdapter {
	let sdk: AppMetricaModule | null = null
	let activated = false

	return {
		initialize () {
			sdk = tryLoadAppMetrica()
			if (!sdk) {
				return
			}
			try {
				sdk.activate({
					apiKey: APPMETRICA_API_KEY,
					logs: APPMETRICA_LOGS_ENABLED,
					// Location is not required for product events.
					locationTracking: false,
				})
				activated = true
				if (APPMETRICA_LOGS_ENABLED) {
					logger.info('AppMetrica activated')
				}
			} catch (error) {
				activated = false
				logger.warn('AppMetrica activate failed', { error })
			}
		},
		track (event: AnalyticsEventName, params?: AnalyticsParams) {
			if (!activated || !sdk) {
				if (APPMETRICA_LOGS_ENABLED) {
					logger.info('AppMetrica track (inactive)', { event, params })
				}
				return
			}
			try {
				sdk.reportEvent(
					event,
					params ? { ...params } : undefined,
				)
				if (APPMETRICA_LOGS_ENABLED) {
					logger.info('AppMetrica event', { event, params })
				}
			} catch (error) {
				logger.warn('AppMetrica reportEvent failed', { error })
			}
		},
	}
}
