/**
 * Light OCR text normalization — trim / spaces / line endings only.
 * Does not auto-join hyphenated line breaks (Russian hyphens are ambiguous).
 */

/**
 * Normalize OCR output for the quote editor without rewriting literary text.
 */
export function normalizeOcrText (raw: string): string {
	if (!raw) {
		return ''
	}
	return raw
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		// Collapse runs of spaces/tabs inside each line (keep newlines).
		.split('\n')
		.map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

/**
 * Optional helper: join soft line breaks into spaces (user-triggered).
 * Preserves blank-line paragraph breaks. Does not remove hyphens.
 */
export function joinOcrLines (text: string): string {
	const normalized = normalizeOcrText(text)
	if (!normalized) {
		return ''
	}
	return normalized
		.split(/\n{2,}/)
		.map((paragraph) =>
			paragraph
				.split('\n')
				.map((l) => l.trim())
				.filter(Boolean)
				.join(' '),
		)
		.join('\n\n')
}

/**
 * Build fullText from detection lines ordered top-to-bottom when bbox present.
 */
export function composeTextFromLines (
	lines: { text: string; y?: number }[],
): string {
	const ordered = [...lines].sort((a, b) => (a.y ?? 0) - (b.y ?? 0))
	return normalizeOcrText(ordered.map((l) => l.text).join('\n'))
}

/**
 * Decide how confirmed OCR text should merge with an existing draft.
 */
export function resolveOcrEditorText (
	existingDraft: string,
	ocrText: string,
	mode: 'replace' | 'append' = 'replace',
): string {
	const ocr = normalizeOcrText(ocrText)
	const existing = existingDraft.trim()
	if (!existing) {
		return ocr
	}
	if (mode === 'append') {
		return normalizeOcrText(`${existing}\n\n${ocr}`)
	}
	return ocr
}
