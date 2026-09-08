/**
 * Restricted ad context enum — never pass arbitrary route strings into policy.
 */

export const AdContexts = {
	HOME: 'HOME',
	LIBRARY: 'LIBRARY',
	DIARY: 'DIARY',
	STATISTICS: 'STATISTICS',
	MORE: 'MORE',
	BOOK_DETAILS: 'BOOK_DETAILS',
	READING_SESSION: 'READING_SESSION',
	NOTE_EDITOR: 'NOTE_EDITOR',
	OCR: 'OCR',
	BACKUP: 'BACKUP',
	RESTORE: 'RESTORE',
	IMPORT: 'IMPORT',
	EXPORT: 'EXPORT',
	YEAR_IN_BOOKS: 'YEAR_IN_BOOKS',
	ONBOARDING: 'ONBOARDING',
	HELP: 'HELP',
	REMINDERS: 'REMINDERS',
	BOOK_FORM: 'BOOK_FORM',
	BOOK_COMPLETION: 'BOOK_COMPLETION',
	UNKNOWN: 'UNKNOWN',
} as const

export type AdContext = (typeof AdContexts)[keyof typeof AdContexts]
