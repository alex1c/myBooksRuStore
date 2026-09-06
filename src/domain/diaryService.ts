/**
 * Diary / notes domain service — CRUD + timeline merge (no N+1 per row).
 */

import type { NoteType, ProgressMode } from '@/constants/domain'
import { getLibraryBookByEntryId } from '@/domain/libraryService'
import {
	validateNoteLocation,
	validateNoteText,
	validateNoteType,
} from '@/domain/noteValidation'
import {
	createReadingNote,
	deleteReadingNote,
	getReadingNoteById,
	listReadingNotes,
	updateReadingNote,
	countNotesByTypeForEntry,
	type NoteTypeCounts,
} from '@/db/repositories/readingNotes'
import { listSessionsForEntry } from '@/db/repositories/readingSessions'
import { getLibraryEntryById } from '@/db/repositories/libraryEntries'
import { SqlExecutor } from '@/db/sqlExecutor'
import type {
	LibraryBookItem,
	LibraryEntry,
	ReadingNote,
	ReadingSession,
} from '@/db/types'
import {
	formatDiaryDateTime,
	formatDiaryDayTitle,
	toLocalDayKey,
} from '@/utils/diaryDates'
import { formatDuration } from '@/utils/progress'
import { formatSessionDurationLabel } from '@/utils/sessionTimer'

export type DiaryFilter =
	| 'ALL'
	| 'SESSIONS'
	| 'QUOTES'
	| 'THOUGHTS'
	| 'NOTES'

export interface DiarySessionItem {
	kind: 'session'
	id: string
	libraryEntryId: string
	bookTitle: string
	/** Instant used for day grouping / sort (session start). */
	sortAt: string
	session: ReadingSession
	progressMode: ProgressMode
	summary: string
}

export interface DiaryNoteItem {
	kind: 'note'
	id: string
	libraryEntryId: string
	bookTitle: string
	sortAt: string
	note: ReadingNote
	progressMode: ProgressMode
	typeLabel: string
	locationLabel: string | null
	preview: string
}

export type DiaryItem = DiarySessionItem | DiaryNoteItem

export interface DiaryDaySection {
	dayKey: string
	title: string
	items: DiaryItem[]
}

export interface DiaryQuery {
	filter?: DiaryFilter
	libraryEntryId?: string | null
	search?: string
	limit?: number
	offset?: number
	now?: Date
}

export interface CreateNoteInput {
	libraryEntryId: string
	type: NoteType
	text: string
	readingSessionId?: string | null
	page?: number | null
	percent?: number | null
	audioPositionSeconds?: number | null
}

export interface UpdateNoteInput {
	type?: NoteType
	text?: string
	page?: number | null
	percent?: number | null
	audioPositionSeconds?: number | null
}

export interface NoteWithBook {
	note: ReadingNote
	item: LibraryBookItem
}

const TYPE_LABELS: Record<NoteType, string> = {
	QUOTE: 'Цитата',
	THOUGHT: 'Мысль',
	NOTE: 'Заметка',
}

function previewText (text: string, maxChars = 220): string {
	const normalized = text.replace(/\s+/g, ' ').trim()
	if (normalized.length <= maxChars) {
		return text.trim()
	}
	return `${normalized.slice(0, maxChars).trim()}…`
}

export function formatNoteLocationLabel (
	note: Pick<ReadingNote, 'page' | 'percent' | 'audioPositionSeconds'>,
	progressMode: ProgressMode,
): string | null {
	if (progressMode === 'PAGES' && note.page != null) {
		return `стр. ${note.page}`
	}
	if (progressMode === 'PERCENT' && note.percent != null) {
		return `${Math.round(note.percent)}%`
	}
	if (progressMode === 'TIME' && note.audioPositionSeconds != null) {
		return formatDuration(note.audioPositionSeconds)
	}
	return null
}

export function formatSessionDiarySummary (
	session: ReadingSession,
	mode: ProgressMode,
): string {
	const duration =
		session.durationSeconds != null
			? formatSessionDurationLabel(session.durationSeconds)
			: '—'

	if (mode === 'PAGES') {
		if (session.startPage != null && session.endPage != null) {
			if (session.startPage === session.endPage) {
				return `${duration} чтения`
			}
			return `${duration} · стр. ${session.startPage} → ${session.endPage}`
		}
		return `${duration} чтения`
	}
	if (mode === 'PERCENT') {
		if (session.startPercent != null && session.endPercent != null) {
			const a = Math.round(session.startPercent)
			const b = Math.round(session.endPercent)
			if (a === b) {
				return `${duration} чтения`
			}
			return `${duration} · ${a}% → ${b}%`
		}
		return `${duration} чтения`
	}
	if (
		session.startAudioSeconds != null &&
		session.endAudioSeconds != null
	) {
		if (session.startAudioSeconds === session.endAudioSeconds) {
			return `${duration} чтения`
		}
		return `${duration} · ${formatDuration(session.startAudioSeconds)} → ${formatDuration(session.endAudioSeconds)}`
	}
	return `${duration} чтения`
}

async function assertNotePayload (
	entry: LibraryEntry,
	input: {
		type: string
		text: string
		page?: number | null
		percent?: number | null
		audioPositionSeconds?: number | null
	},
): Promise<void> {
	const typeError = validateNoteType(input.type)
	if (typeError) {
		throw new Error(`INVALID_NOTE:${typeError}`)
	}
	const textError = validateNoteText(input.text)
	if (textError) {
		throw new Error(`INVALID_NOTE:${textError}`)
	}
	const locationError = validateNoteLocation({
		progressMode: entry.progressMode,
		page: input.page,
		percent: input.percent,
		audioPositionSeconds: input.audioPositionSeconds,
		totalPages: entry.totalPages,
		audioDurationSeconds: entry.audioDurationSeconds,
	})
	if (locationError) {
		throw new Error(`INVALID_NOTE:${locationError}`)
	}
}

export async function createNote (
	db: SqlExecutor,
	input: CreateNoteInput,
): Promise<NoteWithBook> {
	const entry = await getLibraryEntryById(db, input.libraryEntryId)
	if (!entry) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	await assertNotePayload(entry, input)

	const note = await createReadingNote(db, {
		libraryEntryId: input.libraryEntryId,
		type: input.type,
		text: input.text,
		readingSessionId: input.readingSessionId,
		page: input.page ?? null,
		percent: input.percent ?? null,
		audioPositionSeconds: input.audioPositionSeconds ?? null,
	})
	const item = await getLibraryBookByEntryId(db, input.libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	return { note, item }
}

export async function getNoteWithBook (
	db: SqlExecutor,
	noteId: string,
): Promise<NoteWithBook | null> {
	const note = await getReadingNoteById(db, noteId)
	if (!note) {
		return null
	}
	const item = await getLibraryBookByEntryId(db, note.libraryEntryId)
	if (!item) {
		return null
	}
	return { note, item }
}

export async function updateNote (
	db: SqlExecutor,
	noteId: string,
	input: UpdateNoteInput,
): Promise<NoteWithBook> {
	const existing = await getReadingNoteById(db, noteId)
	if (!existing) {
		throw new Error('NOTE_NOT_FOUND')
	}
	const entry = await getLibraryEntryById(db, existing.libraryEntryId)
	if (!entry) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	await assertNotePayload(entry, {
		type: input.type ?? existing.type,
		text: input.text ?? existing.text,
		page: input.page !== undefined ? input.page : existing.page,
		percent: input.percent !== undefined ? input.percent : existing.percent,
		audioPositionSeconds:
			input.audioPositionSeconds !== undefined
				? input.audioPositionSeconds
				: existing.audioPositionSeconds,
	})

	const note = await updateReadingNote(db, noteId, input)
	const item = await getLibraryBookByEntryId(db, note.libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	return { note, item }
}

export async function deleteNote (
	db: SqlExecutor,
	noteId: string,
): Promise<void> {
	await deleteReadingNote(db, noteId)
}

export async function listNotesForBook (
	db: SqlExecutor,
	libraryEntryId: string,
	options: { types?: NoteType[]; search?: string; limit?: number } = {},
): Promise<ReadingNote[]> {
	const notes = await listReadingNotes(db, {
		libraryEntryId,
		types: options.types,
		limit: options.limit ?? 500,
	})
	const q = options.search?.trim()
	if (!q) {
		return notes
	}
	const needle = q.toLocaleLowerCase('ru-RU')
	return notes.filter((note) =>
		note.text.toLocaleLowerCase('ru-RU').includes(needle),
	)
}

export async function getNoteCountsForBook (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<NoteTypeCounts> {
	return countNotesByTypeForEntry(db, libraryEntryId)
}

/**
 * Builds diary timeline: completed sessions + notes, merged in memory.
 * Progress events are intentionally excluded (too noisy for the diary).
 */
export async function getDiaryTimeline (
	db: SqlExecutor,
	query: DiaryQuery = {},
): Promise<{
	sections: DiaryDaySection[]
	items: DiaryItem[]
	hasMore: boolean
}> {
	const filter = query.filter ?? 'ALL'
	const limit = query.limit ?? 80
	const offset = query.offset ?? 0
	const now = query.now ?? new Date()
	const search = query.search?.trim() ?? ''
	const entryId = query.libraryEntryId ?? null

	const includeSessions =
		!search && (filter === 'ALL' || filter === 'SESSIONS')
	const includeNotes = filter !== 'SESSIONS'

	const noteTypes: NoteType[] | undefined =
		filter === 'QUOTES'
			? ['QUOTE']
			: filter === 'THOUGHTS'
				? ['THOUGHT']
				: filter === 'NOTES'
					? ['NOTE']
					: undefined

	// Over-fetch then merge/sort/slice so day grouping stays correct across pages.
	const fetchCap = Math.min(1000, Math.max(limit + offset + 50, 200))

	const [noteRows, sessionRows, bookRows] = await Promise.all([
		includeNotes
			? listReadingNotes(db, {
				libraryEntryId: entryId ?? undefined,
				types: noteTypes,
				limit: fetchCap,
			})
			: Promise.resolve([] as ReadingNote[]),
		includeSessions
			? loadCompletedSessions(db, entryId, fetchCap)
			: Promise.resolve(
				[] as {
					session: ReadingSession
					bookTitle: string
					progressMode: ProgressMode
				}[],
			),
		loadBookTitles(db),
	])

	const titleByEntry = bookRows

	let notes = noteRows
	if (search) {
		const needle = search.toLocaleLowerCase('ru-RU')
		notes = notes.filter((note) =>
			note.text.toLocaleLowerCase('ru-RU').includes(needle),
		)
	}

	const items: DiaryItem[] = []

	for (const note of notes) {
		const meta = titleByEntry.get(note.libraryEntryId)
		items.push({
			kind: 'note',
			id: note.id,
			libraryEntryId: note.libraryEntryId,
			bookTitle: meta?.title ?? 'Книга',
			sortAt: note.createdAt,
			note,
			progressMode: meta?.progressMode ?? 'PAGES',
			typeLabel: TYPE_LABELS[note.type],
			locationLabel: formatNoteLocationLabel(
				note,
				meta?.progressMode ?? 'PAGES',
			),
			preview: previewText(note.text),
		})
	}

	for (const row of sessionRows) {
		items.push({
			kind: 'session',
			id: row.session.id,
			libraryEntryId: row.session.libraryEntryId,
			bookTitle: row.bookTitle,
			sortAt: row.session.startedAt,
			session: row.session,
			progressMode: row.progressMode,
			summary: formatSessionDiarySummary(row.session, row.progressMode),
		})
	}

	items.sort((a, b) => {
		const cmp = b.sortAt.localeCompare(a.sortAt)
		if (cmp !== 0) {
			return cmp
		}
		return b.id.localeCompare(a.id)
	})

	const page = items.slice(offset, offset + limit)
	const hasMore = offset + limit < items.length

	const sectionMap = new Map<string, DiaryItem[]>()
	for (const item of page) {
		const key = toLocalDayKey(item.sortAt)
		const list = sectionMap.get(key) ?? []
		list.push(item)
		sectionMap.set(key, list)
	}

	const sections: DiaryDaySection[] = [...sectionMap.entries()].map(
		([dayKey, sectionItems]) => ({
			dayKey,
			title: formatDiaryDayTitle(dayKey, now),
			items: sectionItems,
		}),
	)

	return { sections, items: page, hasMore }
}

async function loadBookTitles (
	db: SqlExecutor,
): Promise<Map<string, { title: string; progressMode: ProgressMode }>> {
	const rows = await db.getAllAsync<{
		entry_id: string
		title: string
		progress_mode: string
	}>(
		`SELECT le.id AS entry_id, b.title AS title, le.progress_mode AS progress_mode
		 FROM library_entries le
		 INNER JOIN books b ON b.id = le.book_id`,
	)
	const map = new Map<string, { title: string; progressMode: ProgressMode }>()
	for (const row of rows) {
		map.set(row.entry_id, {
			title: row.title,
			progressMode: row.progress_mode as ProgressMode,
		})
	}
	return map
}

async function loadCompletedSessions (
	db: SqlExecutor,
	libraryEntryId: string | null,
	limit: number,
): Promise<
	{
		session: ReadingSession
		bookTitle: string
		progressMode: ProgressMode
	}[]
> {
	if (libraryEntryId) {
		const sessions = await listSessionsForEntry(db, libraryEntryId)
		const completed = sessions
			.filter((s) => s.endedAt != null)
			.slice(0, limit)
		const item = await getLibraryBookByEntryId(db, libraryEntryId)
		return completed.map((session) => ({
			session,
			bookTitle: item?.book.title ?? 'Книга',
			progressMode: item?.entry.progressMode ?? 'PAGES',
		}))
	}

	const rows = await db.getAllAsync<{
		id: string
		library_entry_id: string
		started_at: string
		ended_at: string | null
		duration_seconds: number | null
		start_page: number | null
		end_page: number | null
		start_percent: number | null
		end_percent: number | null
		start_audio_seconds: number | null
		end_audio_seconds: number | null
		created_at: string
		updated_at: string
		title: string
		progress_mode: string
	}>(
		`SELECT rs.*, b.title AS title, le.progress_mode AS progress_mode
		 FROM reading_sessions rs
		 INNER JOIN library_entries le ON le.id = rs.library_entry_id
		 INNER JOIN books b ON b.id = le.book_id
		 WHERE rs.ended_at IS NOT NULL
		 ORDER BY rs.started_at DESC
		 LIMIT ?`,
		[limit],
	)

	return rows.map((row) => ({
		session: {
			id: row.id,
			libraryEntryId: row.library_entry_id,
			startedAt: row.started_at,
			endedAt: row.ended_at,
			durationSeconds: row.duration_seconds,
			startPage: row.start_page,
			endPage: row.end_page,
			startPercent: row.start_percent,
			endPercent: row.end_percent,
			startAudioSeconds: row.start_audio_seconds,
			endAudioSeconds: row.end_audio_seconds,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		},
		bookTitle: row.title,
		progressMode: row.progress_mode as ProgressMode,
	}))
}

export function notePlaceholder (type: NoteType): string {
	if (type === 'QUOTE') {
		return 'Введите текст цитаты'
	}
	if (type === 'THOUGHT') {
		return 'Запишите свою мысль'
	}
	return 'Добавьте заметку'
}

export { formatDiaryDateTime, TYPE_LABELS }
