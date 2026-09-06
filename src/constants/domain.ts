/**
 * Domain enums for reading diary entities.
 * Stored as TEXT in SQLite; validated in repositories/domain layer.
 */

export const LIBRARY_STATUSES = [
	'WANT_TO_READ',
	'READING',
	'FINISHED',
	'PAUSED',
	'ABANDONED',
] as const

export type LibraryStatus = (typeof LIBRARY_STATUSES)[number]

export const BOOK_FORMATS = ['PAPER', 'EBOOK', 'AUDIOBOOK'] as const

export type BookFormat = (typeof BOOK_FORMATS)[number]

export const PROGRESS_MODES = ['PAGES', 'PERCENT', 'TIME'] as const

export type ProgressMode = (typeof PROGRESS_MODES)[number]

export const NOTE_TYPES = ['QUOTE', 'THOUGHT', 'NOTE'] as const

export type NoteType = (typeof NOTE_TYPES)[number]

export const GOAL_TYPES = ['BOOKS', 'PAGES', 'MINUTES'] as const

export type GoalType = (typeof GOAL_TYPES)[number]

export const GOAL_PERIODS = ['DAY', 'WEEK', 'MONTH', 'YEAR'] as const

export type GoalPeriod = (typeof GOAL_PERIODS)[number]

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

/**
 * Type guard helpers used by repositories and tests.
 */
export function isLibraryStatus (value: string): value is LibraryStatus {
	return (LIBRARY_STATUSES as readonly string[]).includes(value)
}

export function isBookFormat (value: string): value is BookFormat {
	return (BOOK_FORMATS as readonly string[]).includes(value)
}

export function isProgressMode (value: string): value is ProgressMode {
	return (PROGRESS_MODES as readonly string[]).includes(value)
}

export function isNoteType (value: string): value is NoteType {
	return (NOTE_TYPES as readonly string[]).includes(value)
}

export function isGoalType (value: string): value is GoalType {
	return (GOAL_TYPES as readonly string[]).includes(value)
}

export function isGoalPeriod (value: string): value is GoalPeriod {
	return (GOAL_PERIODS as readonly string[]).includes(value)
}

export function isThemePreference (value: string): value is ThemePreference {
	return (THEME_PREFERENCES as readonly string[]).includes(value)
}
