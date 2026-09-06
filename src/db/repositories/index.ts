export {
	ensureAppSettings,
	getAppSettings,
	DEFAULT_SETTINGS,
	SETTINGS_KEYS,
} from './settings'

export {
	createBook,
	updateBook,
	getBookById,
	countBooks,
	archiveBook,
	deleteBookHard,
	findSimilarBooks,
} from './books'

export {
	createLibraryEntry,
	updateLibraryEntry,
	getLibraryEntryById,
	listActiveLibraryEntries,
	listArchivedLibraryEntries,
	archiveLibraryEntry,
	restoreLibraryEntry,
	countActiveLibraryEntries,
	deleteLibraryEntryHard,
	resolveFinishedFields,
} from './libraryEntries'

export {
	createReadingSession,
	startActiveSession,
	getReadingSessionById,
	getActiveSession,
	finishActiveSession,
	cancelActiveSession,
	deleteReadingSession,
	listSessionsForEntry,
	countSessionsForEntry,
} from './readingSessions'

export {
	createProgressEvent,
	getProgressEventById,
	listProgressEventsForEntry,
} from './readingProgressEvents'

export {
	createReadingNote,
	updateReadingNote,
	deleteReadingNote,
	getReadingNoteById,
	listReadingNotes,
	countNotesForEntry,
	countNotesByTypeForEntry,
	mapReadingNote,
} from './readingNotes'

export {
	createShelf,
	renameShelf,
	archiveShelf,
	getShelfById,
	listActiveShelves,
	attachEntryToShelf,
	detachEntryFromShelf,
	setEntryShelves,
	listShelfIdsForEntry,
	listEntryIdsForShelf,
} from './shelves'
