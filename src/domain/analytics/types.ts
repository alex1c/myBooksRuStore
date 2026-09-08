/**
 * Analytics event names and whitelisted parameter shapes.
 * Only technical / aggregated values — never private library content.
 */

export type AnalyticsPrimitive = string | number | boolean

export type AnalyticsParams = Readonly<Record<string, AnalyticsPrimitive>>

/** Canonical product event names for Phase 14. */
export const AnalyticsEvents = {
	onboardingStarted: 'onboarding_started',
	onboardingCompleted: 'onboarding_completed',
	bookAdded: 'book_added',
	bookStatusChanged: 'book_status_changed',
	readingSessionStarted: 'reading_session_started',
	readingSessionFinished: 'reading_session_finished',
	readingSessionCancelled: 'reading_session_cancelled',
	quickProgressUsed: 'quick_progress_used',
	readingNoteAdded: 'reading_note_added',
	ocrStarted: 'ocr_started',
	ocrCompleted: 'ocr_completed',
	readingGoalCreated: 'reading_goal_created',
	backupCreated: 'backup_created',
	restoreCompleted: 'restore_completed',
	restoreFailed: 'restore_failed',
	importStarted: 'import_started',
	importCompleted: 'import_completed',
	yearInBooksOpened: 'year_in_books_opened',
	yearInBooksShared: 'year_in_books_shared',
	reminderEnabled: 'reminder_enabled',
	reminderDisabled: 'reminder_disabled',
	helpOpened: 'help_opened',
	interstitialShown: 'interstitial_shown',
} as const

export type AnalyticsEventName =
	(typeof AnalyticsEvents)[keyof typeof AnalyticsEvents]

export type OnboardingMethod = 'completed' | 'skipped'

export type BookAddSource = 'manual' | 'search' | 'isbn' | 'import'

export type BookFormatParam = 'paper' | 'ebook' | 'audiobook'

export type ProgressModeParam = 'pages' | 'percent' | 'time'

export type DurationBucket =
	| '<5m'
	| '5-15m'
	| '15-30m'
	| '30-60m'
	| '60m+'

export type NoteTypeParam = 'quote' | 'thought' | 'note'

export type OcrResultParam =
	| 'success'
	| 'empty'
	| 'failed'
	| 'model_download_failed'

export type GoalTypeParam = 'books' | 'pages' | 'minutes'

export type GoalPeriodParam = 'day' | 'week' | 'month' | 'year'

export type RestoreFailReason =
	| 'invalid_format'
	| 'checksum'
	| 'unsupported_version'
	| 'restore_error'

export type ImportFormatParam = 'mybooks' | 'goodreads' | 'generic'

export type ImportSizeBucket =
	| '1-10'
	| '11-50'
	| '51-200'
	| '201-1000'
	| '1000+'

export type YearShareType = 'image' | 'text_fallback'

export type HelpSectionParam =
	| 'quick_start'
	| 'library'
	| 'reading'
	| 'timer'
	| 'notes'
	| 'diary'
	| 'goals'
	| 'statistics'
	| 'year'
	| 'backup'
	| 'import'
	| 'ocr'
	| 'reminders'

export type QuickProgressModeParam = 'pages' | 'percent' | 'time'
