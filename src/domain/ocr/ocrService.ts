/**
 * Public OCR service — mockable engine boundary (Phase 11).
 */

import * as FileSystem from 'expo-file-system/legacy'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

import { createExecutorchOcrEngine } from './engines/executorchEngine'
import type { OcrEngine, OcrResult } from './types'
import { OcrError } from './types'

/** Max long-edge pixels before OCR (readable print, bounded memory). */
export const OCR_MAX_IMAGE_EDGE = 1600

/** JPEG quality for OCR prep. */
export const OCR_JPEG_QUALITY = 0.75

let engine: OcrEngine | null = null
let recognizing = false

export function setOcrEngine (next: OcrEngine | null): void {
	engine = next
}

export function getOcrEngine (): OcrEngine {
	if (!engine) {
		engine = createExecutorchOcrEngine()
	}
	return engine
}

export function isOcrBusy (): boolean {
	return recognizing
}

/**
 * Downscale / recompress a camera capture for OCR and return a cache URI.
 */
export async function prepareImageForOcr (imageUri: string): Promise<string> {
	const result = await manipulateAsync(
		imageUri,
		[{ resize: { width: OCR_MAX_IMAGE_EDGE } }],
		{
			compress: OCR_JPEG_QUALITY,
			format: SaveFormat.JPEG,
		},
	)
	return result.uri
}

/**
 * Best-effort delete of a temp OCR image (never throws to callers).
 */
export async function cleanupOcrTempImage (uri: string | null | undefined): Promise<void> {
	if (!uri) {
		return
	}
	try {
		const info = await FileSystem.getInfoAsync(uri)
		if (info.exists) {
			await FileSystem.deleteAsync(uri, { idempotent: true })
		}
	} catch {
		// Ignore cleanup failures — cache eviction will reclaim eventually.
	}
}

/**
 * Run OCR on a local image URI. Throws OcrError on empty / failure.
 * Serializes concurrent calls (capture lock).
 */
export async function recognizeText (imageUri: string): Promise<OcrResult> {
	if (recognizing) {
		throw new OcrError('FAILED', 'Распознавание уже выполняется.')
	}
	recognizing = true
	let prepared: string | null = null
	try {
		try {
			prepared = await prepareImageForOcr(imageUri)
		} catch {
			// Jest / unsupported manipulator — fall back to the original URI.
			prepared = imageUri
		}
		const result = await getOcrEngine().recognizeText(prepared)
		return result
		} catch (error) {
			if (error instanceof OcrError) {
				throw error
			}
			throw new OcrError('FAILED', 'Не удалось распознать текст.')
		} finally {
		recognizing = false
		if (prepared && prepared !== imageUri) {
			await cleanupOcrTempImage(prepared)
		}
	}
}

export {
	normalizeOcrText,
	joinOcrLines,
	resolveOcrEditorText,
} from './normalizeOcrText'
export {
	setPendingOcrDraft,
	peekPendingOcrDraft,
	takePendingOcrDraft,
	updatePendingOcrDraft,
	clearPendingOcrDraft,
} from './pendingOcrDraft'
export { createMockOcrEngine, createFailingOcrEngine } from './mockOcrEngine'
export type { OcrEngine, OcrResult, PendingOcrDraft } from './types'
export { OcrError } from './types'
