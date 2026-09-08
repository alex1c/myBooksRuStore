/**
 * Privacy guards for analytics payloads.
 * Blocks accidental leakage of library / note / file content into AppMetrica.
 */

import type { AnalyticsParams } from './types'

/** Keys that must never appear in analytics event parameters. */
export const FORBIDDEN_ANALYTICS_KEYS = [
	'title',
	'author',
	'authorText',
	'isbn',
	'isbn10',
	'isbn13',
	'text',
	'quote',
	'note',
	'review',
	'filename',
	'fileName',
	'query',
	'search',
	'image',
	'imageUri',
	'shelf',
	'shelfName',
	'description',
	'subtitle',
] as const

export type ForbiddenAnalyticsKey = (typeof FORBIDDEN_ANALYTICS_KEYS)[number]

const FORBIDDEN_SET = new Set<string>(
	FORBIDDEN_ANALYTICS_KEYS.map((key) => key.toLowerCase()),
)

export class AnalyticsPrivacyError extends Error {
	readonly forbiddenKeys: string[]

	constructor (forbiddenKeys: string[]) {
		super(
			`Analytics privacy violation: forbidden keys ${forbiddenKeys.join(', ')}`,
		)
		this.name = 'AnalyticsPrivacyError'
		this.forbiddenKeys = forbiddenKeys
	}
}

/**
 * Returns forbidden keys found in a params object (case-insensitive).
 */
export function findForbiddenAnalyticsKeys (
	params: AnalyticsParams | null | undefined,
): string[] {
	if (!params) {
		return []
	}
	const found: string[] = []
	for (const key of Object.keys(params)) {
		if (FORBIDDEN_SET.has(key.toLowerCase())) {
			found.push(key)
		}
	}
	return found
}

/**
 * Asserts params do not contain private keys.
 * Throws AnalyticsPrivacyError when a forbidden key is present.
 */
export function assertAnalyticsParamsSafe (
	params: AnalyticsParams | null | undefined,
): void {
	const forbidden = findForbiddenAnalyticsKeys(params)
	if (forbidden.length > 0) {
		throw new AnalyticsPrivacyError(forbidden)
	}
}

/**
 * Ensures values are simple serializable primitives only.
 */
export function assertAnalyticsParamsSerializable (
	params: AnalyticsParams | null | undefined,
): void {
	if (!params) {
		return
	}
	for (const [key, value] of Object.entries(params)) {
		const kind = typeof value
		if (kind !== 'string' && kind !== 'number' && kind !== 'boolean') {
			throw new Error(
				`Analytics params must be primitives; got ${kind} for "${key}"`,
			)
		}
		if (kind === 'number' && !Number.isFinite(value as number)) {
			throw new Error(`Analytics param "${key}" must be a finite number`)
		}
	}
}
