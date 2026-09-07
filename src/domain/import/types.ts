/**
 * Typed import pipeline models (Phase 10).
 */

import type {
	BookFormat,
	FinishedDatePrecision,
	LibraryStatus,
	ProgressMode,
} from '@/constants/domain'

export type ImportFormat =
	| 'MYBOOKS_CSV'
	| 'GOODREADS_CSV'
	| 'GENERIC_CSV'
	| 'UNKNOWN'

export type DuplicatePolicy = 'SKIP' | 'ADD_EDITION'

export type DuplicateKind = 'EXISTING_LIBRARY' | 'WITHIN_FILE' | null

export interface ImportBookCandidate {
	id: string
	sourceRow: number
	title: string
	authorText: string
	status: LibraryStatus
	format: BookFormat
	progressMode: ProgressMode
	currentPage: number | null
	totalPages: number | null
	currentPercent: number | null
	audioPositionSeconds: number | null
	audioDurationSeconds: number | null
	startedAt: string | null
	finishedDatePrecision: FinishedDatePrecision | null
	finishedOn: string | null
	finishedYear: number | null
	rating: number | null
	reviewText: string | null
	isbn10: string | null
	isbn13: string | null
	publisher: string | null
	publishedYear: number | null
	shelves: string[]
	warnings: string[]
	errors: string[]
	/** True when row can be committed. */
	valid: boolean
	duplicateKind: DuplicateKind
	/** Existing library entry id when matching library. */
	existingEntryId: string | null
	existingBookId: string | null
	existingTitle: string | null
	/** First-seen candidate id when within-file duplicate. */
	withinFilePrimaryId: string | null
	selected: boolean
	policy: DuplicatePolicy
}

export interface ParsedCsvTable {
	headers: string[]
	rows: string[][]
	delimiter: ',' | ';' | '\t'
}

export type FieldKey =
	| 'title'
	| 'author'
	| 'status'
	| 'format'
	| 'progressMode'
	| 'currentProgress'
	| 'totalVolume'
	| 'startedAt'
	| 'finishedDate'
	| 'finishedPrecision'
	| 'rating'
	| 'shelves'
	| 'isbn10'
	| 'isbn13'
	| 'publisher'
	| 'publishedYear'
	| 'review'

export type HeaderMapping = Partial<Record<FieldKey, string>>

export interface ImportPreviewSummary {
	format: ImportFormat
	formatLabel: string
	totalRows: number
	validCount: number
	duplicateCount: number
	errorCount: number
	selectedCount: number
}

export interface ImportCommitReport {
	added: number
	skippedDuplicates: number
	errorRows: number
	shelvesCreated: number
}
