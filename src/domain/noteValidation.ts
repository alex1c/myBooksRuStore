/**
 * Validation helpers for reading notes (text + optional book location).
 */

import type { NoteType, ProgressMode } from '@/constants/domain'
import { isNoteType } from '@/constants/domain'
import { diaryCopy } from '@/constants/copy'

/** Safety cap — large enough for long quotes, small enough to protect SQLite rows. */
export const NOTE_TEXT_MAX_LENGTH = 50_000

export interface NoteLocationInput {
	progressMode: ProgressMode
	page?: number | null
	percent?: number | null
	audioPositionSeconds?: number | null
	totalPages?: number | null
	audioDurationSeconds?: number | null
}

export function validateNoteType (type: string): string | null {
	return isNoteType(type) ? null : diaryCopy.invalidType
}

/**
 * Reject empty / whitespace-only text. Outer trim only —
 * internal newlines and spacing are preserved by the caller after trim.
 */
export function validateNoteText (text: string): string | null {
	const trimmed = text.trim()
	if (!trimmed) {
		return diaryCopy.textRequired
	}
	if (trimmed.length > NOTE_TEXT_MAX_LENGTH) {
		return diaryCopy.textTooLong
	}
	return null
}

/** Optional location validation — empty location is always OK. */
export function validateNoteLocation (input: NoteLocationInput): string | null {
	if (input.progressMode === 'PAGES') {
		if (input.page == null) {
			return null
		}
		if (!Number.isInteger(input.page) || input.page < 0) {
			return diaryCopy.invalidPage
		}
		if (
			input.totalPages != null &&
			input.totalPages > 0 &&
			input.page > input.totalPages
		) {
			return diaryCopy.pageExceedsTotal
		}
		return null
	}

	if (input.progressMode === 'PERCENT') {
		if (input.percent == null) {
			return null
		}
		if (
			!Number.isFinite(input.percent) ||
			input.percent < 0 ||
			input.percent > 100
		) {
			return diaryCopy.invalidPercent
		}
		return null
	}

	if (input.audioPositionSeconds == null) {
		return null
	}
	if (
		!Number.isFinite(input.audioPositionSeconds) ||
		input.audioPositionSeconds < 0
	) {
		return diaryCopy.invalidAudio
	}
	if (
		input.audioDurationSeconds != null &&
		input.audioDurationSeconds > 0 &&
		input.audioPositionSeconds > input.audioDurationSeconds
	) {
		return diaryCopy.audioExceeds
	}
	return null
}

export function assertNoteType (type: string): NoteType {
	if (!isNoteType(type)) {
		throw new Error('INVALID_NOTE_TYPE')
	}
	return type
}
