/**
 * Typed backup payload (formatVersion 1).
 */

import type {
	BookFormat,
	FinishedDatePrecision,
	GoalPeriod,
	GoalType,
	LibraryStatus,
	NoteType,
	ProgressMode,
	ThemePreference,
} from '@/constants/domain'
import type { ProgressEventType } from '@/db/types'
import type { BACKUP_FORMAT_ID } from './constants'

export interface BackupManifest {
	format: typeof BACKUP_FORMAT_ID | string
	formatVersion: number
	schemaVersion: number
	appVersion: string
	createdAt: string
	counts: BackupCounts
	/** SHA-256 hex of canonical data.json UTF-8 bytes. */
	dataSha256: string
	skippedCoverCount: number
}

export interface BackupCounts {
	books: number
	libraryEntries: number
	shelves: number
	libraryEntryShelves: number
	readingSessions: number
	readingProgressEvents: number
	readingNotes: number
	readingGoals: number
	settings: number
	covers: number
}

export interface BackupBook {
	id: string
	title: string
	subtitle: string | null
	authorText: string
	description: string | null
	isbn10: string | null
	isbn13: string | null
	publisher: string | null
	publishedYear: number | null
	language: string | null
	pageCount: number | null
	/** Relative asset path inside ZIP, e.g. covers/book_x.jpg */
	coverAsset: string | null
	remoteCoverUrl: string | null
	source: string | null
	sourceExternalId: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface BackupLibraryEntry {
	id: string
	bookId: string
	status: LibraryStatus
	format: BookFormat
	progressMode: ProgressMode
	currentPage: number | null
	totalPages: number | null
	currentPercent: number | null
	audioPositionSeconds: number | null
	audioDurationSeconds: number | null
	startedAt: string | null
	finishedAt: string | null
	finishedDatePrecision: FinishedDatePrecision | null
	finishedYear: number | null
	finishedOn: string | null
	rating: number | null
	reviewText: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface BackupShelf {
	id: string
	name: string
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface BackupLibraryEntryShelf {
	libraryEntryId: string
	shelfId: string
	createdAt: string
}

export interface BackupSession {
	id: string
	libraryEntryId: string
	startedAt: string
	endedAt: string | null
	durationSeconds: number | null
	startPage: number | null
	endPage: number | null
	startPercent: number | null
	endPercent: number | null
	startAudioSeconds: number | null
	endAudioSeconds: number | null
	createdAt: string
	updatedAt: string
}

export interface BackupProgressEvent {
	id: string
	libraryEntryId: string
	readingSessionId: string | null
	type: ProgressEventType
	previousPage: number | null
	newPage: number | null
	previousPercent: number | null
	newPercent: number | null
	previousAudioSeconds: number | null
	newAudioSeconds: number | null
	createdAt: string
}

export interface BackupNote {
	id: string
	libraryEntryId: string
	readingSessionId: string | null
	type: NoteType
	text: string
	page: number | null
	percent: number | null
	audioPositionSeconds: number | null
	createdAt: string
	updatedAt: string
}

export interface BackupGoal {
	id: string
	type: GoalType
	period: GoalPeriod
	targetValue: number
	startsOn: string
	endsOn: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface BackupSettings {
	reminderEnabled: boolean
	reminderTime: string
	/** ISO weekdays Mon=1 … Sun=7 (optional for older backups). */
	reminderWeekdays?: number[]
	defaultProgressMode: ProgressMode
	theme: ThemePreference
	onboardingCompleted: boolean
	analyticsConsent: boolean | null
}

export interface BackupData {
	books: BackupBook[]
	libraryEntries: BackupLibraryEntry[]
	shelves: BackupShelf[]
	libraryEntryShelves: BackupLibraryEntryShelf[]
	readingSessions: BackupSession[]
	readingProgressEvents: BackupProgressEvent[]
	readingNotes: BackupNote[]
	readingGoals: BackupGoal[]
	settings: BackupSettings
}

/** In-memory archive before/after ZIP bytes. */
export interface BackupArchive {
	manifest: BackupManifest
	data: BackupData
	/** Relative path → raw bytes (Uint8Array) */
	covers: Record<string, Uint8Array>
}

export type BackupValidationErrorCode =
	| 'INVALID_FORMAT'
	| 'UNSUPPORTED_FUTURE_VERSION'
	| 'UNSUPPORTED_OLD_VERSION'
	| 'MALFORMED_DATA'
	| 'DUPLICATE_ID'
	| 'BROKEN_FK'
	| 'CHECKSUM_MISMATCH'
	| 'COUNT_MISMATCH'

export class BackupValidationError extends Error {
	constructor (
		public readonly code: BackupValidationErrorCode,
		message: string,
	) {
		super(message)
		this.name = 'BackupValidationError'
	}
}
