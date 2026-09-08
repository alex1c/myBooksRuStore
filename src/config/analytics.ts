/**
 * Central AppMetrica configuration.
 * Production API key is not a signing secret — keep it centralized, not scattered.
 */

/** Production AppMetrica API key (mobile SDK). */
export const APPMETRICA_API_KEY =
	'977b210e-00ab-4cc5-bbce-ed4357b18f38'

/**
 * Enable SDK / wrapper debug logs in development only.
 * Production builds must stay quiet.
 */
export const APPMETRICA_LOGS_ENABLED = typeof __DEV__ !== 'undefined'
	? __DEV__
	: false

/**
 * Reject forbidden private parameter keys in development and tests.
 * Helps catch privacy regressions early.
 */
export const ANALYTICS_PRIVACY_GUARD_ENABLED =
	typeof __DEV__ !== 'undefined' ? __DEV__ : true
