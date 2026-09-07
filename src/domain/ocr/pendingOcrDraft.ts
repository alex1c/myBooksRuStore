/**
 * In-memory OCR draft bridge between quote editor ↔ camera ↔ review.
 * Intentionally not persisted to SQLite.
 */

import type { PendingOcrDraft } from './types'

let pending: PendingOcrDraft | null = null

export function setPendingOcrDraft (draft: PendingOcrDraft): void {
	pending = draft
}

export function peekPendingOcrDraft (): PendingOcrDraft | null {
	return pending
}

export function takePendingOcrDraft (): PendingOcrDraft | null {
	const value = pending
	pending = null
	return value
}

export function updatePendingOcrDraft (
	patch: Partial<PendingOcrDraft>,
): PendingOcrDraft | null {
	if (!pending) {
		return null
	}
	pending = { ...pending, ...patch }
	return pending
}

export function clearPendingOcrDraft (): void {
	pending = null
}
