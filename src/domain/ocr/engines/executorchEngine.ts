/**
 * ExecuTorch / CRAFT+CRNN OCR engine (on-device, Cyrillic + Latin glyphs).
 *
 * Package: react-native-executorch@0.9.3
 * Why: Google ML Kit on-device OCR has no Cyrillic model (MUST for RuStore).
 * Russian support: OCR_RUSSIAN uses RECOGNIZER_CYRILLIC_CRNN (includes Latin letters/digits).
 * Privacy: inference is local; first launch may download model binaries from Hugging Face
 * (not photos / not quote text).
 * Requires: custom native / EAS / prebuild (not Expo Go).
 */

import { Platform } from 'react-native'

import type { OcrEngine, OcrResult } from '../types'
import { OcrError } from '../types'
import {
	composeTextFromLines,
	normalizeOcrText,
} from '../normalizeOcrText'

let modulePromise: Promise<OcrEngineModule | null> | null = null

interface OcrEngineModule {
	forward (imageUri: string): Promise<
		{ text: string; score: number; bbox?: { y1: number } }[]
	>
	delete (): void
}

async function ensureExecutorchInitialized (): Promise<boolean> {
	if (Platform.OS === 'web') {
		return false
	}
	try {
		const { initExecutorch, isAvailable } = await import(
			'react-native-executorch'
		)
		if (!isAvailable) {
			return false
		}
		const { ExpoResourceFetcher } = await import(
			'react-native-executorch-expo-resource-fetcher'
		)
		initExecutorch({ resourceFetcher: ExpoResourceFetcher })
		return true
	} catch {
		return false
	}
}

async function loadRussianOcrModule (): Promise<OcrEngineModule | null> {
	if (modulePromise) {
		return modulePromise
	}
	modulePromise = (async () => {
		const ok = await ensureExecutorchInitialized()
		if (!ok) {
			return null
		}
		const { OCRModule, OCR_RUSSIAN } = await import(
			'react-native-executorch'
		)
		return OCRModule.fromModelName(OCR_RUSSIAN)
	})()
	try {
		return await modulePromise
	} catch (error) {
		modulePromise = null
		throw error
	}
}

export function createExecutorchOcrEngine (): OcrEngine {
	return {
		id: 'executorch-ocr-ru',
		async recognizeText (imageUri: string): Promise<OcrResult> {
			let mod: OcrEngineModule | null
			try {
				mod = await loadRussianOcrModule()
			} catch {
				throw new OcrError(
					'FAILED',
					'Не удалось распознать текст.',
				)
			}
			if (!mod) {
				throw new OcrError(
					'UNSUPPORTED',
					'Распознавание текста недоступно на этом устройстве.',
				)
			}

			let detections: {
				text: string
				score: number
				bbox?: { y1: number }
			}[]
			try {
				detections = await mod.forward(imageUri)
			} catch {
				throw new OcrError('FAILED', 'Не удалось распознать текст.')
			}

			const lines = detections
				.filter((d) => d.text?.trim())
				.map((d) => ({
					text: d.text.trim(),
					score: d.score,
					y: d.bbox?.y1,
				}))

			const rawText = lines.map((l) => l.text).join('\n')
			const fullText = lines.length
				? composeTextFromLines(lines)
				: normalizeOcrText(rawText)

			if (!fullText) {
				throw new OcrError('EMPTY', 'Текст на снимке не найден.')
			}

			return {
				fullText,
				rawText,
				lines: lines.map((l) => ({ text: l.text, score: l.score })),
			}
		},
	}
}

/** Reset cached native module (tests / low-memory recovery). */
export function resetExecutorchOcrModuleCache (): void {
	modulePromise = null
}
