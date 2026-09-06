/**
 * Domain / persistence types for the reading diary.
 *
 * Critical rule: Book catalog data is separate from library_entries
 * (user state). Soft-archive keeps reading history intact.
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

export interface Book {
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
	coverUri: string | null
	/** Original remote cover URL from a catalogue provider (optional). */
	remoteCoverUrl: string | null
	source: string | null
	sourceExternalId: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface LibraryEntry {
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
	/** EXACT | YEAR | UNKNOWN — null when not finished. */
	finishedDatePrecision: FinishedDatePrecision | null
	finishedYear: number | null
	/** Local calendar date YYYY-MM-DD when precision is EXACT. */
	finishedOn: string | null
	rating: number | null
	reviewText: string | null
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

/** Joined view used by library list / details / today. */
export interface LibraryBookItem {
	entry: LibraryEntry
	book: Book
	shelfIds: string[]
}

export interface ReadingSession {
	id: string
	libraryEntryId: string
	startedAt: string
	endedAt: string
	durationSeconds: number
	startPage: number | null
	endPage: number | null
	startPercent: number | null
	endPercent: number | null
	startAudioSeconds: number | null
	endAudioSeconds: number | null
	createdAt: string
	updatedAt: string
}

export interface ReadingNote {
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

export interface Shelf {
	id: string
	name: string
	createdAt: string
	updatedAt: string
	archivedAt: string | null
}

export interface LibraryEntryShelf {
	libraryEntryId: string
	shelfId: string
	createdAt: string
}

export interface ReadingGoal {
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

export interface AppSettings {
	reminderEnabled: boolean
	reminderTime: string
	defaultProgressMode: ProgressMode
	theme: ThemePreference
	onboardingCompleted: boolean
	analyticsConsent: boolean | null
}

export interface AppMeta {
	key: string
	value: string
}

export interface LibraryStatusCounts {
	all: number
	WANT_TO_READ: number
	READING: number
	FINISHED: number
	PAUSED: number
	ABANDONED: number
}
