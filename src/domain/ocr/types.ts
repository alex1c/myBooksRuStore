/**
 * OCR domain types — engine-agnostic (Phase 11).
 */

export interface OcrLine {
	text: string
	score?: number
}

export interface OcrResult {
	/** Normalized full text ready for the quote editor. */
	fullText: string
	/** Raw engine text before light normalization. */
	rawText: string
	lines?: OcrLine[]
}

export type OcrFailureKind = 'EMPTY' | 'FAILED' | 'UNSUPPORTED' | 'MODEL_DOWNLOAD'

export class OcrError extends Error {
	readonly kind: OcrFailureKind

	constructor (kind: OcrFailureKind, message: string) {
		super(message)
		this.name = 'OcrError'
		this.kind = kind
	}
}

export interface OcrEngine {
	readonly id: string
	recognizeText (imageUri: string): Promise<OcrResult>
}

export interface PendingOcrDraft {
	entryId: string
	sessionId: string | null
	returnTo: 'session' | 'book' | 'editor'
	pageHint: string | null
	/** Existing draft text from the quote editor (may be empty). */
	existingDraft: string
	/** Confirmed OCR text after review (set by review screen). */
	confirmedText?: string
	/** How to apply confirmed text when returning to the editor. */
	applyMode?: 'replace' | 'append'
}
