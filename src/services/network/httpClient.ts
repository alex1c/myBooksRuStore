/**
 * Shared HTTP helper with timeout, abort, and typed network errors.
 * Keep raw fetch() out of React screens.
 */

export type NetworkErrorKind =
	| 'timeout'
	| 'offline'
	| 'http'
	| 'abort'
	| 'parse'
	| 'unknown'

export class NetworkError extends Error {
	readonly kind: NetworkErrorKind
	readonly status?: number

	constructor (kind: NetworkErrorKind, message: string, status?: number) {
		super(message)
		this.name = 'NetworkError'
		this.kind = kind
		this.status = status
	}
}

export interface HttpGetOptions {
	timeoutMs?: number
	signal?: AbortSignal
	headers?: Record<string, string>
}

const DEFAULT_TIMEOUT_MS = 10_000

/**
 * GET JSON with timeout. Pass an AbortSignal to cancel when the query changes.
 */
export async function httpGetJson<T> (
	url: string,
	options: HttpGetOptions = {},
): Promise<T> {
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
	const controller = new AbortController()
	const external = options.signal

	const onExternalAbort = () => {
		controller.abort()
	}
	if (external) {
		if (external.aborted) {
			throw new NetworkError('abort', 'Request aborted')
		}
		external.addEventListener('abort', onExternalAbort)
	}

	const timer = setTimeout(() => {
		controller.abort()
	}, timeoutMs)

	try {
		const response = await fetch(url, {
			method: 'GET',
			signal: controller.signal,
			headers: {
				Accept: 'application/json',
				'User-Agent':
					'MyBooksReadingDiary/1.0 (https://github.com/alex1c/myBooksRuStore; offline-first reading diary)',
				...options.headers,
			},
		})

		if (!response.ok) {
			throw new NetworkError(
				'http',
				`HTTP ${response.status}`,
				response.status,
			)
		}

		try {
			return (await response.json()) as T
		} catch {
			throw new NetworkError('parse', 'Malformed JSON response')
		}
	} catch (error) {
		if (error instanceof NetworkError) {
			throw error
		}
		if (error instanceof Error && error.name === 'AbortError') {
			if (external?.aborted) {
				throw new NetworkError('abort', 'Request aborted')
			}
			throw new NetworkError('timeout', 'Request timed out')
		}
		// React Native often surfaces network failures as TypeError("Network request failed")
		const message = error instanceof Error ? error.message : 'Network error'
		if (/network|offline|failed to fetch|internet/i.test(message)) {
			throw new NetworkError('offline', message)
		}
		throw new NetworkError('unknown', message)
	} finally {
		clearTimeout(timer)
		if (external) {
			external.removeEventListener('abort', onExternalAbort)
		}
	}
}

export function isNetworkError (error: unknown): error is NetworkError {
	return error instanceof NetworkError
}
