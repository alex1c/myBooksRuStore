/**
 * Mockable OCR engine boundary for tests and unsupported runtimes.
 */

import type { OcrEngine, OcrResult } from './types'
import { OcrError } from './types'
import { normalizeOcrText } from './normalizeOcrText'

export function createMockOcrEngine (
	handler: (imageUri: string) => Promise<string> | string,
): OcrEngine {
	return {
		id: 'mock',
		async recognizeText (imageUri: string): Promise<OcrResult> {
			const raw = await handler(imageUri)
			const fullText = normalizeOcrText(raw)
			if (!fullText) {
				throw new OcrError('EMPTY', 'Текст на снимке не найден.')
			}
			return {
				fullText,
				rawText: raw,
				lines: fullText.split('\n').map((text) => ({ text })),
			}
		},
	}
}

/** Engine that always fails — useful for failure-path tests. */
export function createFailingOcrEngine (
	message = 'Не удалось распознать текст.',
): OcrEngine {
	return {
		id: 'failing',
		async recognizeText (): Promise<OcrResult> {
			throw new OcrError('FAILED', message)
		},
	}
}
