/**
 * Centralized validation for library forms and repository writes.
 * Returns Russian error messages for UI; null means valid.
 */

import {
	isBookFormat,
	isFinishedDatePrecision,
	isLibraryStatus,
	isProgressMode,
	type BookFormat,
	type FinishedDatePrecision,
	type LibraryStatus,
	type ProgressMode,
} from '@/constants/domain'
import { validationCopy } from '@/constants/copy'
import { isDateOnly } from '@/utils/dates'

export interface ProgressInput {
	progressMode: ProgressMode
	currentPage?: number | null
	totalPages?: number | null
	currentPercent?: number | null
	audioPositionSeconds?: number | null
	audioDurationSeconds?: number | null
}

export interface FinishedDateInput {
	precision: FinishedDatePrecision | null
	finishedOn?: string | null
	finishedYear?: number | null
}

/** Collapse whitespace and lowercase for duplicate detection. */
export function normalizeText (value: string): string {
	return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru-RU')
}

/** Strip ISBN punctuation/spaces for comparison and storage. */
export function normalizeIsbn (value: string): string {
	return value.replace(/[\s-]/g, '').toUpperCase()
}

export function validateTitle (title: string): string | null {
	if (!title.trim()) {
		return validationCopy.titleRequired
	}
	return null
}

export function validatePublishedYear (year: number | null | undefined): string | null {
	if (year === null || year === undefined) {
		return null
	}
	const max = new Date().getFullYear() + 1
	if (!Number.isInteger(year) || year < 1000 || year > max) {
		return validationCopy.invalidYear
	}
	return null
}

export function validateIsbn10 (raw: string | null | undefined): string | null {
	if (!raw || !raw.trim()) {
		return null
	}
	const value = normalizeIsbn(raw)
	if (!/^\d{9}[\dX]$/.test(value)) {
		return validationCopy.invalidIsbn10
	}
	return null
}

export function validateIsbn13 (raw: string | null | undefined): string | null {
	if (!raw || !raw.trim()) {
		return null
	}
	const value = normalizeIsbn(raw)
	if (!/^\d{13}$/.test(value)) {
		return validationCopy.invalidIsbn13
	}
	return null
}

export function validateStatus (status: string): string | null {
	return isLibraryStatus(status) ? null : validationCopy.invalidStatus
}

export function validateFormat (format: string): string | null {
	return isBookFormat(format) ? null : validationCopy.invalidFormat
}

export function validateProgressMode (mode: string): string | null {
	return isProgressMode(mode) ? null : validationCopy.invalidProgressMode
}

export function validateProgress (input: ProgressInput): string | null {
	const modeError = validateProgressMode(input.progressMode)
	if (modeError) {
		return modeError
	}

	if (input.progressMode === 'PAGES') {
		if (input.currentPage != null) {
			if (!Number.isInteger(input.currentPage) || input.currentPage < 0) {
				return validationCopy.invalidPage
			}
		}
		if (input.totalPages != null) {
			if (!Number.isInteger(input.totalPages) || input.totalPages <= 0) {
				return validationCopy.invalidTotalPages
			}
			if (
				input.currentPage != null &&
				input.currentPage > input.totalPages
			) {
				return validationCopy.pageExceedsTotal
			}
		}
	}

	if (input.progressMode === 'PERCENT') {
		if (input.currentPercent != null) {
			if (
				!Number.isFinite(input.currentPercent) ||
				input.currentPercent < 0 ||
				input.currentPercent > 100
			) {
				return validationCopy.invalidPercent
			}
		}
	}

	if (input.progressMode === 'TIME') {
		if (
			input.audioPositionSeconds != null &&
			(!Number.isFinite(input.audioPositionSeconds) ||
				input.audioPositionSeconds < 0)
		) {
			return validationCopy.invalidAudio
		}
		if (
			input.audioDurationSeconds != null &&
			(!Number.isFinite(input.audioDurationSeconds) ||
				input.audioDurationSeconds < 0)
		) {
			return validationCopy.invalidAudio
		}
		if (
			input.audioPositionSeconds != null &&
			input.audioDurationSeconds != null &&
			input.audioPositionSeconds > input.audioDurationSeconds
		) {
			return validationCopy.audioPositionExceeds
		}
	}

	return null
}

/**
 * Rating must be null or 0–5 in 0.5 steps.
 */
export function validateRating (rating: number | null | undefined): string | null {
	if (rating === null || rating === undefined) {
		return null
	}
	if (!Number.isFinite(rating) || rating < 0 || rating > 5) {
		return validationCopy.invalidRating
	}
	if (Math.round(rating * 2) !== rating * 2) {
		return validationCopy.invalidRating
	}
	return null
}

export function validateFinishedDate (
	status: LibraryStatus,
	input: FinishedDateInput,
): string | null {
	if (status !== 'FINISHED') {
		return null
	}
	if (!input.precision || !isFinishedDatePrecision(input.precision)) {
		return validationCopy.invalidFinishedDate
	}
	if (input.precision === 'EXACT') {
		if (!input.finishedOn || !isDateOnly(input.finishedOn)) {
			return validationCopy.invalidFinishedDate
		}
	}
	if (input.precision === 'YEAR') {
		const year = input.finishedYear
		const max = new Date().getFullYear()
		if (
			year == null ||
			!Number.isInteger(year) ||
			year < 1000 ||
			year > max
		) {
			return validationCopy.invalidFinishedYear
		}
	}
	return null
}

export function validateShelfName (name: string): string | null {
	if (!name.trim()) {
		return validationCopy.shelfNameRequired
	}
	return null
}

export function assertValidStatus (status: string): asserts status is LibraryStatus {
	if (!isLibraryStatus(status)) {
		throw new Error('INVALID_LIBRARY_STATUS')
	}
}

export function assertValidFormat (format: string): asserts format is BookFormat {
	if (!isBookFormat(format)) {
		throw new Error('INVALID_BOOK_FORMAT')
	}
}

export function assertValidProgressMode (
	mode: string,
): asserts mode is ProgressMode {
	if (!isProgressMode(mode)) {
		throw new Error('INVALID_PROGRESS_MODE')
	}
}
