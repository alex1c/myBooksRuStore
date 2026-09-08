/**
 * Reading tracker service — quick progress, sessions, finish book.
 * UI must not write SQL; all multi-step writes go through transactions here.
 */

import type { ProgressMode } from '@/constants/domain'
import {
	getLibraryBookByEntryId,
	finishedTodayPayload,
	suggestFinishedProgress,
	updateLibraryBook,
} from '@/domain/libraryService'
import { validateProgress } from '@/domain/libraryValidation'
import {
	cancelActiveSession,
	deleteReadingSession,
	finishActiveSession,
	getActiveSession,
	getReadingSessionById,
	listSessionsForEntry,
	startActiveSession,
} from '@/db/repositories/readingSessions'
import {
	createProgressEvent,
	getProgressEventById,
} from '@/db/repositories/readingProgressEvents'
import {
	getLibraryEntryById,
	updateLibraryEntry,
} from '@/db/repositories/libraryEntries'
import { SqlExecutor } from '@/db/sqlExecutor'
import type {
	LibraryBookItem,
	LibraryEntry,
	ReadingProgressEvent,
	ReadingSession,
} from '@/db/types'
import { nowIso } from '@/utils/dates'
import { formatDuration } from '@/utils/progress'
import {
	durationSecondsBetween,
	elapsedSecondsFromStart,
} from '@/utils/sessionTimer'

export class ActiveSessionConflictError extends Error {
	readonly code = 'ACTIVE_SESSION_EXISTS' as const
	readonly activeSession: ReadingSession
	readonly bookTitle: string | null

	constructor (activeSession: ReadingSession, bookTitle: string | null) {
		super('ACTIVE_SESSION_EXISTS')
		this.name = 'ActiveSessionConflictError'
		this.activeSession = activeSession
		this.bookTitle = bookTitle
	}
}

export interface ActiveSessionBundle {
	session: ReadingSession
	item: LibraryBookItem
	elapsedSeconds: number
}

export interface QuickProgressResult {
	entry: LibraryEntry
	item: LibraryBookItem
	event: ReadingProgressEvent
	feedbackLabel: string
	completionReached: boolean
}

export interface FinishSessionInput {
	sessionId: string
	endPage?: number | null
	endPercent?: number | null
	endAudioSeconds?: number | null
	/** Wall-clock end; defaults to now. */
	endedAt?: string
	discard?: boolean
}

export interface FinishSessionResult {
	session: ReadingSession
	item: LibraryBookItem
	completionReached: boolean
	deltaLabel: string
}

async function runInTransaction<T> (
	db: SqlExecutor,
	task: () => Promise<T>,
): Promise<T> {
	if (db.withTransactionAsync) {
		return db.withTransactionAsync(task)
	}
	return task()
}

/**
 * True when progress has reached the known end of the book
 * (does not mutate status — caller must ask the user).
 */
export function isCompletionReached (entry: LibraryEntry): boolean {
	if (entry.progressMode === 'PAGES') {
		return (
			entry.totalPages != null &&
			entry.totalPages > 0 &&
			entry.currentPage != null &&
			entry.currentPage >= entry.totalPages
		)
	}
	if (entry.progressMode === 'PERCENT') {
		return entry.currentPercent != null && entry.currentPercent >= 100
	}
	if (entry.progressMode === 'TIME') {
		return (
			entry.audioDurationSeconds != null &&
			entry.audioDurationSeconds > 0 &&
			entry.audioPositionSeconds != null &&
			entry.audioPositionSeconds >= entry.audioDurationSeconds
		)
	}
	return false
}

function clampPages (
	current: number,
	total: number | null | undefined,
): number {
	const safe = Math.max(0, Math.floor(current))
	if (total != null && total > 0) {
		return Math.min(safe, total)
	}
	return safe
}

function clampPercent (value: number): number {
	return Math.min(100, Math.max(0, value))
}

function clampAudio (
	position: number,
	duration: number | null | undefined,
): number {
	const safe = Math.max(0, Math.floor(position))
	if (duration != null && duration > 0) {
		return Math.min(safe, duration)
	}
	return safe
}

function progressDeltaLabel (
	mode: ProgressMode,
	previous: LibraryEntry,
	next: LibraryEntry,
): string {
	if (mode === 'PAGES') {
		const before = previous.currentPage ?? 0
		const after = next.currentPage ?? 0
		const delta = after - before
		if (delta === 0) {
			return '0 страниц'
		}
		return delta > 0 ? `+${delta} страниц` : `${delta} страниц`
	}
	if (mode === 'PERCENT') {
		const before = previous.currentPercent ?? 0
		const after = next.currentPercent ?? 0
		const delta = Math.round(after - before)
		if (delta === 0) {
			return '0%'
		}
		return delta > 0 ? `+${delta}%` : `${delta}%`
	}
	const before = previous.audioPositionSeconds ?? 0
	const after = next.audioPositionSeconds ?? 0
	const delta = after - before
	if (delta === 0) {
		return '0 мин'
	}
	const sign = delta > 0 ? '+' : ''
	return `${sign}${formatDuration(Math.abs(delta))}`
}

function feedbackForEntry (entry: LibraryEntry): string {
	if (entry.progressMode === 'PAGES') {
		if (entry.currentPage == null) {
			return 'Прогресс обновлён'
		}
		if (entry.totalPages != null) {
			return `Стр. ${entry.currentPage}`
		}
		return `Стр. ${entry.currentPage}`
	}
	if (entry.progressMode === 'PERCENT') {
		return `${Math.round(entry.currentPercent ?? 0)}%`
	}
	return formatDuration(entry.audioPositionSeconds ?? 0)
}

export async function getActiveSessionBundle (
	db: SqlExecutor,
	nowMs: number = Date.now(),
): Promise<ActiveSessionBundle | null> {
	const session = await getActiveSession(db)
	if (!session) {
		return null
	}
	const item = await getLibraryBookByEntryId(db, session.libraryEntryId)
	if (!item) {
		return null
	}
	return {
		session,
		item,
		elapsedSeconds: elapsedSecondsFromStart(session.startedAt, nowMs),
	}
}

/**
 * Starts a reading session for the entry. Only one active session is allowed.
 * WANT_TO_READ → READING automatically (natural start action).
 */
export async function startReadingSession (
	db: SqlExecutor,
	libraryEntryId: string,
	startedAt?: string,
): Promise<ActiveSessionBundle> {
	const existing = await getActiveSession(db)
	if (existing) {
		const other = await getLibraryBookByEntryId(db, existing.libraryEntryId)
		throw new ActiveSessionConflictError(
			existing,
			other?.book.title ?? null,
		)
	}

	const item = await getLibraryBookByEntryId(db, libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	if (item.entry.archivedAt) {
		throw new Error('ENTRY_ARCHIVED')
	}

	const started = startedAt ?? nowIso()
	const previousStatus = item.entry.status

	const session = await runInTransaction(db, async () => {
		if (item.entry.status === 'WANT_TO_READ' || item.entry.status === 'PAUSED') {
			await updateLibraryEntry(db, libraryEntryId, {
				status: 'READING',
				startedAt: item.entry.startedAt ?? started,
			})
		} else if (item.entry.status === 'ABANDONED') {
			await updateLibraryEntry(db, libraryEntryId, { status: 'READING' })
		} else if (item.entry.status === 'FINISHED') {
			throw new Error('BOOK_FINISHED')
		}

		const entry = await getLibraryEntryById(db, libraryEntryId)
		if (!entry) {
			throw new Error('LIBRARY_ENTRY_NOT_FOUND')
		}

		return startActiveSession(db, {
			libraryEntryId,
			startedAt: started,
			startPage: entry.currentPage,
			startPercent: entry.currentPercent,
			startAudioSeconds: entry.audioPositionSeconds,
		})
	})

	const refreshed = await getLibraryBookByEntryId(db, libraryEntryId)
	if (!refreshed) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	// Best-effort analytics after successful start (never blocks the session).
	try {
		const { track } = await import('@/domain/analytics/analyticsService')
		const { AnalyticsEvents } = await import('@/domain/analytics/types')
		const { mapProgressMode } = await import('@/domain/analytics/mappers')
		track(AnalyticsEvents.readingSessionStarted, {
			progress_mode: mapProgressMode(refreshed.entry.progressMode),
		})
		if (previousStatus !== 'READING' && refreshed.entry.status === 'READING') {
			track(AnalyticsEvents.bookStatusChanged, {
				from: previousStatus,
				to: 'READING',
			})
		}
	} catch {
		// Analytics must never affect reading.
	}

	return {
		session,
		item: refreshed,
		elapsedSeconds: elapsedSecondsFromStart(session.startedAt),
	}
}

/**
 * Finishes the active session and atomically updates library progress.
 */
export async function finishReadingSession (
	db: SqlExecutor,
	input: FinishSessionInput,
): Promise<FinishSessionResult> {
	const session = await getReadingSessionById(db, input.sessionId)
	if (!session) {
		throw new Error('SESSION_NOT_FOUND')
	}
	if (session.endedAt != null) {
		throw new Error('SESSION_ALREADY_ENDED')
	}

	if (input.discard) {
		await cancelActiveSession(db, input.sessionId)
		const item = await getLibraryBookByEntryId(db, session.libraryEntryId)
		if (!item) {
			throw new Error('LIBRARY_ENTRY_NOT_FOUND')
		}
		try {
			const { track } = await import('@/domain/analytics/analyticsService')
			const { AnalyticsEvents } = await import('@/domain/analytics/types')
			track(AnalyticsEvents.readingSessionCancelled)
		} catch {
			// ignore
		}
		return {
			session: { ...session, endedAt: null, durationSeconds: null },
			item,
			completionReached: false,
			deltaLabel: 'Сессия удалена',
		}
	}

	const endedAt = input.endedAt ?? nowIso()
	const durationSeconds = durationSecondsBetween(session.startedAt, endedAt)
	const previous = await getLibraryEntryById(db, session.libraryEntryId)
	if (!previous) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	const nextPage =
		previous.progressMode === 'PAGES'
			? clampPages(
				Number.isFinite(input.endPage as number)
					? (input.endPage as number)
					: (previous.currentPage ?? 0),
				previous.totalPages,
			)
			: previous.currentPage
	const nextPercent =
		previous.progressMode === 'PERCENT'
			? clampPercent(
				Number.isFinite(input.endPercent as number)
					? (input.endPercent as number)
					: (previous.currentPercent ?? 0),
			)
			: previous.currentPercent
	const nextAudio =
		previous.progressMode === 'TIME'
			? clampAudio(
				Number.isFinite(input.endAudioSeconds as number)
					? (input.endAudioSeconds as number)
					: (previous.audioPositionSeconds ?? 0),
				previous.audioDurationSeconds,
			)
			: previous.audioPositionSeconds

	const progressError = validateProgress({
		progressMode: previous.progressMode,
		currentPage: nextPage,
		totalPages: previous.totalPages,
		currentPercent: nextPercent,
		audioPositionSeconds: nextAudio,
		audioDurationSeconds: previous.audioDurationSeconds,
	})
	if (progressError) {
		throw new Error(`INVALID_PROGRESS:${progressError}`)
	}

	const finished = await runInTransaction(db, async () => {
		const updatedSession = await finishActiveSession(db, input.sessionId, {
			endedAt,
			durationSeconds,
			endPage: previous.progressMode === 'PAGES' ? nextPage : session.startPage,
			endPercent:
				previous.progressMode === 'PERCENT' ? nextPercent : session.startPercent,
			endAudioSeconds:
				previous.progressMode === 'TIME'
					? nextAudio
					: session.startAudioSeconds,
		})

		const entry = await updateLibraryEntry(db, session.libraryEntryId, {
			currentPage: nextPage,
			currentPercent: nextPercent,
			audioPositionSeconds: nextAudio,
		})

		await createProgressEvent(db, {
			libraryEntryId: session.libraryEntryId,
			readingSessionId: updatedSession.id,
			type: 'SESSION_END',
			previousPage: previous.currentPage,
			newPage: entry.currentPage,
			previousPercent: previous.currentPercent,
			newPercent: entry.currentPercent,
			previousAudioSeconds: previous.audioPositionSeconds,
			newAudioSeconds: entry.audioPositionSeconds,
		})

		return { updatedSession, entry, previous }
	})

	const item = await getLibraryBookByEntryId(db, session.libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	try {
		const { track } = await import('@/domain/analytics/analyticsService')
		const { AnalyticsEvents } = await import('@/domain/analytics/types')
		const {
			durationBucket,
			mapProgressMode,
		} = await import('@/domain/analytics/mappers')
		track(AnalyticsEvents.readingSessionFinished, {
			progress_mode: mapProgressMode(finished.previous.progressMode),
			duration_bucket: durationBucket(durationSeconds),
		})
	} catch {
		// ignore
	}

	return {
		session: finished.updatedSession,
		item,
		completionReached: isCompletionReached(finished.entry),
		deltaLabel: progressDeltaLabel(
			finished.previous.progressMode,
			finished.previous,
			finished.entry,
		),
	}
}

export async function cancelReadingSession (
	db: SqlExecutor,
	sessionId: string,
): Promise<LibraryBookItem> {
	const session = await getReadingSessionById(db, sessionId)
	if (!session) {
		throw new Error('SESSION_NOT_FOUND')
	}
	await cancelActiveSession(db, sessionId)
	const item = await getLibraryBookByEntryId(db, session.libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	try {
		const { track } = await import('@/domain/analytics/analyticsService')
		const { AnalyticsEvents } = await import('@/domain/analytics/types')
		track(AnalyticsEvents.readingSessionCancelled)
	} catch {
		// ignore
	}
	return item
}

export async function listBookSessions (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<ReadingSession[]> {
	return listSessionsForEntry(db, libraryEntryId)
}

export async function deleteCompletedSession (
	db: SqlExecutor,
	sessionId: string,
): Promise<void> {
	const session = await getReadingSessionById(db, sessionId)
	if (!session) {
		throw new Error('SESSION_NOT_FOUND')
	}
	if (session.endedAt == null) {
		throw new Error('SESSION_STILL_ACTIVE')
	}
	await deleteReadingSession(db, sessionId)
}

export type QuickDelta =
	| { kind: 'pages'; delta: number }
	| { kind: 'percent'; delta: number }
	| { kind: 'minutes'; delta: number }
	| { kind: 'setPages'; page: number }
	| { kind: 'setPercent'; percent: number }
	| { kind: 'setAudioSeconds'; seconds: number }

/**
 * Quick / exact progress update without creating a reading_session.
 */
export async function applyQuickProgress (
	db: SqlExecutor,
	libraryEntryId: string,
	delta: QuickDelta,
): Promise<QuickProgressResult> {
	const previous = await getLibraryEntryById(db, libraryEntryId)
	if (!previous) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	if (previous.archivedAt) {
		throw new Error('ENTRY_ARCHIVED')
	}

	let nextPage = previous.currentPage
	let nextPercent = previous.currentPercent
	let nextAudio = previous.audioPositionSeconds

	if (delta.kind === 'pages') {
		if (previous.progressMode !== 'PAGES') {
			throw new Error('PROGRESS_MODE_MISMATCH')
		}
		const base = previous.currentPage ?? 0
		nextPage = clampPages(base + delta.delta, previous.totalPages)
		if (
			previous.totalPages != null &&
			base + delta.delta > previous.totalPages
		) {
			// Soft clamp already applied; still allow update to total.
		}
	} else if (delta.kind === 'percent') {
		if (previous.progressMode !== 'PERCENT') {
			throw new Error('PROGRESS_MODE_MISMATCH')
		}
		const base = previous.currentPercent ?? 0
		nextPercent = clampPercent(base + delta.delta)
	} else if (delta.kind === 'minutes') {
		if (previous.progressMode !== 'TIME') {
			throw new Error('PROGRESS_MODE_MISMATCH')
		}
		const base = previous.audioPositionSeconds ?? 0
		nextAudio = clampAudio(
			base + delta.delta * 60,
			previous.audioDurationSeconds,
		)
	} else if (delta.kind === 'setPages') {
		if (previous.progressMode !== 'PAGES') {
			throw new Error('PROGRESS_MODE_MISMATCH')
		}
		if (previous.totalPages != null && delta.page > previous.totalPages) {
			throw new Error('PAGE_EXCEEDS_TOTAL')
		}
		if (delta.page < 0 || !Number.isInteger(delta.page)) {
			throw new Error('INVALID_PAGE')
		}
		nextPage = delta.page
	} else if (delta.kind === 'setPercent') {
		if (previous.progressMode !== 'PERCENT') {
			throw new Error('PROGRESS_MODE_MISMATCH')
		}
		if (delta.percent < 0 || delta.percent > 100) {
			throw new Error('INVALID_PERCENT')
		}
		nextPercent = delta.percent
	} else if (delta.kind === 'setAudioSeconds') {
		if (previous.progressMode !== 'TIME') {
			throw new Error('PROGRESS_MODE_MISMATCH')
		}
		if (delta.seconds < 0) {
			throw new Error('INVALID_AUDIO')
		}
		if (
			previous.audioDurationSeconds != null &&
			delta.seconds > previous.audioDurationSeconds
		) {
			throw new Error('AUDIO_EXCEEDS_DURATION')
		}
		nextAudio = Math.floor(delta.seconds)
	}

	const progressError = validateProgress({
		progressMode: previous.progressMode,
		currentPage: nextPage,
		totalPages: previous.totalPages,
		currentPercent: nextPercent,
		audioPositionSeconds: nextAudio,
		audioDurationSeconds: previous.audioDurationSeconds,
	})
	if (progressError) {
		throw new Error(`INVALID_PROGRESS:${progressError}`)
	}

	const type =
		delta.kind.startsWith('set') ? 'MANUAL_UPDATE' : 'QUICK_UPDATE'

	const result = await runInTransaction(db, async () => {
		const entry = await updateLibraryEntry(db, libraryEntryId, {
			currentPage: nextPage,
			currentPercent: nextPercent,
			audioPositionSeconds: nextAudio,
			status:
				previous.status === 'WANT_TO_READ' ? 'READING' : previous.status,
		})
		const event = await createProgressEvent(db, {
			libraryEntryId,
			type,
			previousPage: previous.currentPage,
			newPage: entry.currentPage,
			previousPercent: previous.currentPercent,
			newPercent: entry.currentPercent,
			previousAudioSeconds: previous.audioPositionSeconds,
			newAudioSeconds: entry.audioPositionSeconds,
		})
		return { entry, event }
	})

	const item = await getLibraryBookByEntryId(db, libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	// One event per successful quick/exact update — never per repeated +1 spam beyond this call.
	if (type === 'QUICK_UPDATE') {
		try {
			const { track } = await import('@/domain/analytics/analyticsService')
			const { AnalyticsEvents } = await import('@/domain/analytics/types')
			const { mapProgressMode } = await import('@/domain/analytics/mappers')
			track(AnalyticsEvents.quickProgressUsed, {
				mode: mapProgressMode(previous.progressMode),
			})
		} catch {
			// ignore
		}
	}

	return {
		entry: result.entry,
		item,
		event: result.event,
		feedbackLabel: feedbackForEntry(result.entry),
		completionReached: isCompletionReached(result.entry),
	}
}

/**
 * Undo a quick/manual progress event by restoring previous values.
 */
export async function undoProgressEvent (
	db: SqlExecutor,
	eventId: string,
): Promise<QuickProgressResult> {
	const event = await getProgressEventById(db, eventId)
	if (!event) {
		throw new Error('PROGRESS_EVENT_NOT_FOUND')
	}
	if (event.type !== 'QUICK_UPDATE' && event.type !== 'MANUAL_UPDATE') {
		throw new Error('PROGRESS_EVENT_NOT_UNDOABLE')
	}

	const previous = await getLibraryEntryById(db, event.libraryEntryId)
	if (!previous) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	const result = await runInTransaction(db, async () => {
		const entry = await updateLibraryEntry(db, event.libraryEntryId, {
			currentPage: event.previousPage,
			currentPercent: event.previousPercent,
			audioPositionSeconds: event.previousAudioSeconds,
		})
		const undoEvent = await createProgressEvent(db, {
			libraryEntryId: event.libraryEntryId,
			type: 'UNDO',
			previousPage: previous.currentPage,
			newPage: entry.currentPage,
			previousPercent: previous.currentPercent,
			newPercent: entry.currentPercent,
			previousAudioSeconds: previous.audioPositionSeconds,
			newAudioSeconds: entry.audioPositionSeconds,
		})
		return { entry, event: undoEvent }
	})

	const item = await getLibraryBookByEntryId(db, event.libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	return {
		entry: result.entry,
		item,
		event: result.event,
		feedbackLabel: 'Прогресс отменён',
		completionReached: isCompletionReached(result.entry),
	}
}

/**
 * Explicitly mark a book finished (user consent). Optional progress fill-in.
 */
export async function markBookFinished (
	db: SqlExecutor,
	libraryEntryId: string,
	options: {
		applySuggestedProgress?: boolean
		rating?: number | null
	} = {},
): Promise<LibraryBookItem> {
	const item = await getLibraryBookByEntryId(db, libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}

	const finished = finishedTodayPayload()
	const suggested = options.applySuggestedProgress
		? suggestFinishedProgress({
			progressMode: item.entry.progressMode,
			currentPage: item.entry.currentPage,
			totalPages: item.entry.totalPages,
			currentPercent: item.entry.currentPercent,
			audioPositionSeconds: item.entry.audioPositionSeconds,
			audioDurationSeconds: item.entry.audioDurationSeconds,
			bookPageCount: item.book.pageCount,
		})
		: {}

	const fromStatus = item.entry.status
	const bookItem = await runInTransaction(db, async () => {
		const entry = await updateLibraryEntry(db, libraryEntryId, {
			status: 'FINISHED',
			finishedAt: nowIso(),
			...finished,
			...suggested,
			rating: options.rating === undefined ? item.entry.rating : options.rating,
		})
		await createProgressEvent(db, {
			libraryEntryId,
			type: 'FINISH_BOOK',
			previousPage: item.entry.currentPage,
			newPage: entry.currentPage,
			previousPercent: item.entry.currentPercent,
			newPercent: entry.currentPercent,
			previousAudioSeconds: item.entry.audioPositionSeconds,
			newAudioSeconds: entry.audioPositionSeconds,
		})
		const next = await getLibraryBookByEntryId(db, libraryEntryId)
		if (!next) {
			throw new Error('LIBRARY_ENTRY_NOT_FOUND')
		}
		return next
	})

	try {
		const { track } = await import('@/domain/analytics/analyticsService')
		const { AnalyticsEvents } = await import('@/domain/analytics/types')
		track(AnalyticsEvents.bookStatusChanged, {
			from: fromStatus,
			to: 'FINISHED',
		})
	} catch {
		// ignore
	}

	return bookItem
}

/** PAUSED / ABANDONED → READING without destroying session history. */
export async function continueReadingBook (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<LibraryBookItem> {
	const item = await getLibraryBookByEntryId(db, libraryEntryId)
	if (!item) {
		throw new Error('LIBRARY_ENTRY_NOT_FOUND')
	}
	return updateLibraryBook(db, {
		entryId: libraryEntryId,
		entry: {
			status: 'READING',
			startedAt: item.entry.startedAt ?? nowIso(),
		},
	})
}

/**
 * Reopen a finished book as READING. Keeps past sessions; clears current
 * finished-date fields from the live entry (reread cycles are a future enhancement).
 */
export async function reopenFinishedBook (
	db: SqlExecutor,
	libraryEntryId: string,
): Promise<LibraryBookItem> {
	return updateLibraryBook(db, {
		entryId: libraryEntryId,
		entry: {
			status: 'READING',
			finishedAt: null,
			finishedDatePrecision: null,
			finishedOn: null,
			finishedYear: null,
		},
	})
}

export function formatSessionHistoryLine (
	session: ReadingSession,
	mode: ProgressMode,
): string {
	const duration =
		session.durationSeconds != null
			? formatDuration(session.durationSeconds)
			: '—'
	const date = formatLocalSessionDate(session.startedAt)

	if (mode === 'PAGES') {
		const from = session.startPage != null ? `стр. ${session.startPage}` : '—'
		const to = session.endPage != null ? String(session.endPage) : '—'
		return `${date} · ${duration} · ${from} → ${to}`
	}
	if (mode === 'PERCENT') {
		const from =
			session.startPercent != null
				? `${Math.round(session.startPercent)}%`
				: '—'
		const to =
			session.endPercent != null ? `${Math.round(session.endPercent)}%` : '—'
		return `${date} · ${duration} · ${from} → ${to}`
	}

	const from =
		session.startAudioSeconds != null
			? formatClock(session.startAudioSeconds)
			: '—'
	const to =
		session.endAudioSeconds != null
			? formatClock(session.endAudioSeconds)
			: '—'
	return `${date} · ${duration} · ${from} → ${to}`
}

function formatClock (totalSeconds: number): string {
	const safe = Math.max(0, Math.floor(totalSeconds))
	const hours = Math.floor(safe / 3600)
	const minutes = Math.floor((safe % 3600) / 60)
	return `${hours}:${String(minutes).padStart(2, '0')}`
}

function formatLocalSessionDate (iso: string): string {
	const date = new Date(iso)
	if (!Number.isFinite(date.getTime())) {
		return iso
	}
	return date.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
	})
}
