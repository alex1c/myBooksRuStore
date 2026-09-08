/**
 * Mapping helpers from domain enums → analytics-safe lowercase params.
 */

import type { BookFormat, GoalPeriod, GoalType, NoteType, ProgressMode } from '@/constants/domain'
import type { ImportFormat } from '@/domain/import/types'
import type {
	BookFormatParam,
	DurationBucket,
	GoalPeriodParam,
	GoalTypeParam,
	ImportFormatParam,
	ImportSizeBucket,
	NoteTypeParam,
	ProgressModeParam,
} from './types'

export function mapBookFormat (format: BookFormat): BookFormatParam {
	switch (format) {
		case 'EBOOK':
			return 'ebook'
		case 'AUDIOBOOK':
			return 'audiobook'
		default:
			return 'paper'
	}
}

export function mapProgressMode (mode: ProgressMode): ProgressModeParam {
	switch (mode) {
		case 'PERCENT':
			return 'percent'
		case 'TIME':
			return 'time'
		default:
			return 'pages'
	}
}

export function mapNoteType (type: NoteType): NoteTypeParam {
	switch (type) {
		case 'QUOTE':
			return 'quote'
		case 'THOUGHT':
			return 'thought'
		default:
			return 'note'
	}
}

export function mapGoalType (type: GoalType): GoalTypeParam {
	switch (type) {
		case 'PAGES':
			return 'pages'
		case 'MINUTES':
			return 'minutes'
		default:
			return 'books'
	}
}

export function mapGoalPeriod (period: GoalPeriod): GoalPeriodParam {
	switch (period) {
		case 'DAY':
			return 'day'
		case 'WEEK':
			return 'week'
		case 'MONTH':
			return 'month'
		default:
			return 'year'
	}
}

export function mapImportFormat (format: ImportFormat): ImportFormatParam {
	switch (format) {
		case 'MYBOOKS_CSV':
			return 'mybooks'
		case 'GOODREADS_CSV':
			return 'goodreads'
		default:
			return 'generic'
	}
}

/**
 * Bucket session duration so we never send exact seconds unless needed.
 */
export function durationBucket (durationSeconds: number): DurationBucket {
	const safe = Number.isFinite(durationSeconds)
		? Math.max(0, durationSeconds)
		: 0
	if (safe < 5 * 60) {
		return '<5m'
	}
	if (safe < 15 * 60) {
		return '5-15m'
	}
	if (safe < 30 * 60) {
		return '15-30m'
	}
	if (safe < 60 * 60) {
		return '30-60m'
	}
	return '60m+'
}

/**
 * Bucket imported row counts for analytics (no titles / filenames).
 */
export function importSizeBucket (count: number): ImportSizeBucket {
	const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
	if (safe <= 10) {
		return '1-10'
	}
	if (safe <= 50) {
		return '11-50'
	}
	if (safe <= 200) {
		return '51-200'
	}
	if (safe <= 1000) {
		return '201-1000'
	}
	return '1000+'
}
