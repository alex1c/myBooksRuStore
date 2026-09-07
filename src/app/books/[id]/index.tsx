import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import { ExactProgressModal } from '@/components/reading/ExactProgressModal'
import { QuickProgressRow } from '@/components/reading/ReadingNowCard'
import { UndoSnackbar } from '@/components/reading/UndoSnackbar'
import {
	Card,
	DestructiveButton,
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
} from '@/components/ui'
import { appCopy, bookDetailsCopy, diaryCopy, ocrCopy, sessionCopy, todayCopy } from '@/constants/copy'
import {
	formatLabels,
	statusLabels,
} from '@/constants/labels'
import { colors, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	archiveLibraryBook,
	getLibraryBookByEntryId,
	listShelves,
} from '@/domain/libraryService'
import {
	getNoteCountsForBook,
	listNotesForBook,
} from '@/domain/diaryService'
import {
	ActiveSessionConflictError,
	applyQuickProgress,
	continueReadingBook,
	formatSessionHistoryLine,
	isCompletionReached,
	listBookSessions,
	markBookFinished,
	reopenFinishedBook,
	startReadingSession,
	undoProgressEvent,
	type QuickDelta,
} from '@/domain/readingTrackerService'
import type { LibraryBookItem, ReadingNote, ReadingSession, Shelf } from '@/db/types'
import { formatProgressLabel, progressRatio } from '@/utils/progress'
import { formatDateRu } from '@/utils/dates'
import { formatNoteTypeCounts } from '@/utils/format'
import { NoteCard } from '@/components/notes/NoteCard'
import { getActiveSession } from '@/db/repositories/readingSessions'
import {
	setPendingOcrDraft,
} from '@/domain/ocr/ocrService'

/**
 * Book details — progress actions, sessions history, finish / continue.
 */
export default function BookDetailsScreen () {
	const { id } = useLocalSearchParams<{ id: string }>()
	const { executor } = useDatabase()
	const [item, setItem] = useState<LibraryBookItem | null>(null)
	const [shelves, setShelves] = useState<Shelf[]>([])
	const [sessions, setSessions] = useState<ReadingSession[]>([])
	const [notes, setNotes] = useState<ReadingNote[]>([])
	const [noteCounts, setNoteCounts] = useState({
		QUOTE: 0,
		THOUGHT: 0,
		NOTE: 0,
		total: 0,
	})
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [exactOpen, setExactOpen] = useState(false)
	const [exactError, setExactError] = useState<string | null>(null)
	const [snack, setSnack] = useState<{ message: string; eventId: string } | null>(
		null,
	)
	const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const showSnack = (message: string, eventId: string) => {
		if (snackTimer.current) {
			clearTimeout(snackTimer.current)
		}
		setSnack({ message, eventId })
		snackTimer.current = setTimeout(() => setSnack(null), 5000)
	}

	const load = useCallback(async () => {
		if (!id) {
			return
		}
		setLoading(true)
		try {
			const [next, shelfRows, history, bookNotes, counts] = await Promise.all([
				getLibraryBookByEntryId(executor, id),
				listShelves(executor),
				listBookSessions(executor, id),
				listNotesForBook(executor, id, { limit: 5 }),
				getNoteCountsForBook(executor, id),
			])
			setItem(next)
			setShelves(shelfRows)
			setSessions(history.filter((s) => s.endedAt != null).slice(0, 5))
			setNotes(bookNotes.slice(0, 5))
			setNoteCounts(counts)
		} finally {
			setLoading(false)
		}
	}, [executor, id])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const offerCompletion = (next: LibraryBookItem) => {
		if (!isCompletionReached(next.entry) || next.entry.status === 'FINISHED') {
			return
		}
		Alert.alert(sessionCopy.completionTitle, sessionCopy.completionMessage, [
			{ text: sessionCopy.completionLater, style: 'cancel' },
			{
				text: sessionCopy.completionDone,
				onPress: () => {
					void (async () => {
						await markBookFinished(executor, next.entry.id, {
							applySuggestedProgress: true,
						})
						await load()
					})()
				},
			},
		])
	}

	const handleArchive = () => {
		if (!item) {
			return
		}
		Alert.alert(bookDetailsCopy.archiveTitle, bookDetailsCopy.archiveMessage, [
			{ text: appCopy.cancel, style: 'cancel' },
			{
				text: bookDetailsCopy.archiveConfirm,
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await archiveLibraryBook(executor, item.entry.id)
						router.replace('/(tabs)/library')
					})()
				},
			},
		])
	}

	const handleQuick = async (
		kind: 'pages' | 'percent' | 'minutes',
		delta: number,
	) => {
		if (!item) {
			return
		}
		setBusy(true)
		try {
			const payload: QuickDelta =
				kind === 'pages'
					? { kind: 'pages', delta }
					: kind === 'percent'
						? { kind: 'percent', delta }
						: { kind: 'minutes', delta }
			const result = await applyQuickProgress(executor, item.entry.id, payload)
			setItem(result.item)
			showSnack(
				`${todayCopy.progressUpdated} · ${result.feedbackLabel}`,
				result.event.id,
			)
			offerCompletion(result.item)
		} catch (error) {
			Alert.alert(
				appCopy.errorTitle,
				error instanceof Error
					? error.message.replace(/^INVALID_PROGRESS:/, '')
					: appCopy.errorTitle,
			)
		} finally {
			setBusy(false)
		}
	}

	const handleExact = async (value: {
		kind: 'setPages' | 'setPercent' | 'setAudioSeconds'
		page?: number
		percent?: number
		seconds?: number
	}) => {
		if (!item) {
			return
		}
		setExactError(null)
		setBusy(true)
		try {
			let delta: QuickDelta
			if (value.kind === 'setPages') {
				delta = { kind: 'setPages', page: value.page ?? 0 }
			} else if (value.kind === 'setPercent') {
				delta = { kind: 'setPercent', percent: value.percent ?? 0 }
			} else {
				delta = { kind: 'setAudioSeconds', seconds: value.seconds ?? 0 }
			}
			const result = await applyQuickProgress(executor, item.entry.id, delta)
			setExactOpen(false)
			setItem(result.item)
			showSnack(
				`${todayCopy.progressUpdated} · ${result.feedbackLabel}`,
				result.event.id,
			)
			offerCompletion(result.item)
		} catch (error) {
			const code = error instanceof Error ? error.message : ''
			setExactError(code.replace(/^INVALID_PROGRESS:/, '') || appCopy.errorTitle)
		} finally {
			setBusy(false)
		}
	}

	const handleStart = async () => {
		if (!item) {
			return
		}
		setBusy(true)
		try {
			await startReadingSession(executor, item.entry.id)
			router.push('/sessions/active')
		} catch (error) {
			if (error instanceof ActiveSessionConflictError) {
				const title = error.bookTitle ?? 'книга'
				Alert.alert(
					sessionCopy.conflictTitle,
					sessionCopy.conflictMessage(title),
					[
						{
							text: sessionCopy.returnToSession,
							onPress: () => router.push('/sessions/active'),
						},
						{
							text: sessionCopy.finishExisting,
							onPress: () =>
								router.push({
									pathname: '/sessions/finish',
									params: { sessionId: error.activeSession.id },
								}),
						},
						{ text: 'Закрыть', style: 'cancel' },
					],
				)
				return
			}
			Alert.alert(
				'Ошибка',
				error instanceof Error ? error.message : 'Ошибка',
			)
		} finally {
			setBusy(false)
		}
	}

	const handleMarkFinished = () => {
		if (!item) {
			return
		}
		Alert.alert(sessionCopy.completionTitle, sessionCopy.completionMessage, [
			{ text: appCopy.cancel, style: 'cancel' },
			{
				text: sessionCopy.completionDone,
				onPress: () => {
					void (async () => {
						await markBookFinished(executor, item.entry.id, {
							applySuggestedProgress: true,
						})
						await load()
					})()
				},
			},
		])
	}

	if (loading && !item) {
		return <LoadingState />
	}

	if (!item) {
		return (
			<Screen>
				<Text style={styles.missing}>{appCopy.bookNotFound}</Text>
			</Screen>
		)
	}

	const author = item.book.authorText.trim() || appCopy.authorUnknown
	const progress = formatProgressLabel(item.entry)
	const ratio = progressRatio(item.entry)
	const shelfNames = shelves
		.filter((shelf) => item.shelfIds.includes(shelf.id))
		.map((shelf) => shelf.name)

	const finishedLabel = (() => {
		const e = item.entry
		if (e.status !== 'FINISHED') {
			return null
		}
		if (e.finishedDatePrecision === 'EXACT' && e.finishedOn) {
			return formatDateRu(e.finishedOn)
		}
		if (e.finishedDatePrecision === 'YEAR' && e.finishedYear != null) {
			return String(e.finishedYear)
		}
		if (e.finishedDatePrecision === 'UNKNOWN') {
			return 'Раньше'
		}
		return null
	})()

	const showTracker =
		item.entry.status === 'READING' ||
		item.entry.status === 'WANT_TO_READ' ||
		item.entry.status === 'PAUSED' ||
		item.entry.status === 'ABANDONED'

	return (
		<>
			<Stack.Screen options={{ title: item.book.title, headerShown: true }} />
			<Screen scroll contentStyle={styles.content}>
				<View style={styles.hero}>
					<CoverThumbnail
						title={item.book.title}
						coverUri={item.book.coverUri}
						remoteCoverUrl={item.book.remoteCoverUrl}
						size={88}
					/>
					<View style={styles.heroText}>
						<Text style={styles.title} numberOfLines={3}>{item.book.title}</Text>
						{item.book.subtitle ? (
							<Text style={styles.subtitle} numberOfLines={2}>{item.book.subtitle}</Text>
						) : null}
						<Text style={styles.author} numberOfLines={2}>{author}</Text>
						<Text style={styles.meta}>
							{statusLabels[item.entry.status]} · {formatLabels[item.entry.format]}
						</Text>
					</View>
				</View>

				<Card style={styles.card}>
					<Text style={styles.section}>{bookDetailsCopy.progress}</Text>
					<Text style={styles.body}>
						{progress ?? bookDetailsCopy.noProgress}
					</Text>
					{ratio != null ? (
						<View style={styles.barTrack}>
							<View
								style={[
									styles.barFill,
									{ width: `${Math.round(ratio * 100)}%` },
								]}
							/>
						</View>
					) : null}
					{item.entry.rating != null ? (
						<Text style={styles.body}>★ {item.entry.rating}</Text>
					) : (
						<Text style={styles.muted}>{bookDetailsCopy.noRating}</Text>
					)}
					{finishedLabel ? (
						<Text style={styles.body}>Прочитано: {finishedLabel}</Text>
					) : null}

					{showTracker &&
					(item.entry.status === 'READING' ||
						item.entry.status === 'WANT_TO_READ') ? (
						<QuickProgressRow
							entry={item.entry}
							busy={busy}
							onQuick={(kind, delta) => void handleQuick(kind, delta)}
							onExact={() => {
								setExactError(null)
								setExactOpen(true)
							}}
							onStartReading={() => void handleStart()}
						/>
					) : null}

					{item.entry.status === 'PAUSED' ? (
						<PrimaryButton
							label={sessionCopy.continueReading}
							onPress={() => {
								void (async () => {
									await continueReadingBook(executor, item.entry.id)
									await load()
								})()
							}}
						/>
					) : null}

					{item.entry.status === 'ABANDONED' ? (
						<PrimaryButton
							label={sessionCopy.returnToBook}
							onPress={() => {
								void (async () => {
									await continueReadingBook(executor, item.entry.id)
									await load()
								})()
							}}
						/>
					) : null}

					{item.entry.status === 'FINISHED' ? (
						<SecondaryButton
							label={sessionCopy.reopenReading}
							onPress={() => {
								void (async () => {
									await reopenFinishedBook(executor, item.entry.id)
									await load()
								})()
							}}
						/>
					) : null}

					{item.entry.status !== 'FINISHED' ? (
						<SecondaryButton
							label={sessionCopy.markFinished}
							onPress={handleMarkFinished}
						/>
					) : null}
				</Card>

				<Card style={styles.card}>
					<Text style={styles.section}>{bookDetailsCopy.notes}</Text>
					{noteCounts.total > 0 ? (
						<Text style={styles.muted}>
							{formatNoteTypeCounts(
								noteCounts.QUOTE,
								noteCounts.THOUGHT,
								noteCounts.NOTE,
							)}
						</Text>
					) : (
						<Text style={styles.muted}>{diaryCopy.notesEmpty}</Text>
					)}
					{notes.map((note) => (
						<NoteCard
							key={note.id}
							note={note}
							progressMode={item.entry.progressMode}
							onPress={() => router.push(`/notes/${note.id}`)}
						/>
					))}
					<View style={styles.noteActions}>
						<SecondaryButton
							label={diaryCopy.addQuote}
							onPress={() =>
								router.push({
									pathname: '/notes/new',
									params: { entryId: item.entry.id, type: 'QUOTE' },
								})
							}
						/>
						{item.entry.format !== 'AUDIOBOOK' ? (
							<SecondaryButton
								label={ocrCopy.scanQuoteAction}
								onPress={() => {
									void (async () => {
										const active = await getActiveSession(executor)
										const sessionId =
											active && active.libraryEntryId === item.entry.id
												? active.id
												: undefined
										setPendingOcrDraft({
											entryId: item.entry.id,
											sessionId: sessionId ?? null,
											returnTo: 'book',
											pageHint:
												item.entry.progressMode === 'PAGES' &&
												item.entry.currentPage != null
													? String(item.entry.currentPage)
													: null,
											existingDraft: '',
										})
										router.push({
											pathname: '/ocr/scan',
											params: {
												entryId: item.entry.id,
												sessionId,
												returnTo: 'book',
												pageHint:
													item.entry.progressMode === 'PAGES' &&
													item.entry.currentPage != null
														? String(item.entry.currentPage)
														: undefined,
											},
										})
									})()
								}}
							/>
						) : null}
						<SecondaryButton
							label={diaryCopy.addThought}
							onPress={() =>
								router.push({
									pathname: '/notes/new',
									params: { entryId: item.entry.id, type: 'THOUGHT' },
								})
							}
						/>
						<SecondaryButton
							label={diaryCopy.addNoteShort}
							onPress={() =>
								router.push({
									pathname: '/notes/new',
									params: { entryId: item.entry.id, type: 'NOTE' },
								})
							}
						/>
					</View>
					<SecondaryButton
						label={diaryCopy.allNotes}
						onPress={() =>
							router.push(`/books/${item.entry.id}/notes`)
						}
					/>
				</Card>

				<Card style={styles.card}>
					<Text style={styles.section}>{bookDetailsCopy.history}</Text>
					{sessions.length === 0 ? (
						<Text style={styles.muted}>{sessionCopy.historyEmpty}</Text>
					) : (
						sessions.map((session) => (
							<Text key={session.id} style={styles.historyLine}>
								{formatSessionHistoryLine(session, item.entry.progressMode)}
							</Text>
						))
					)}
					<SecondaryButton
						label={sessionCopy.historyAll}
						onPress={() =>
							router.push(`/books/${item.entry.id}/history`)
						}
					/>
				</Card>

				{(item.book.isbn13 ||
					item.book.isbn10 ||
					item.book.publisher ||
					item.book.publishedYear ||
					item.book.pageCount ||
					item.book.description) ? (
					<Card style={styles.card}>
						<Text style={styles.section}>{bookDetailsCopy.metadata}</Text>
						{item.book.isbn13 ? (
							<Text style={styles.body}>ISBN-13: {item.book.isbn13}</Text>
						) : null}
						{item.book.isbn10 ? (
							<Text style={styles.body}>ISBN-10: {item.book.isbn10}</Text>
						) : null}
						{item.book.publisher ? (
							<Text style={styles.body}>{item.book.publisher}</Text>
						) : null}
						{item.book.publishedYear ? (
							<Text style={styles.body}>{item.book.publishedYear}</Text>
						) : null}
						{item.book.pageCount ? (
							<Text style={styles.body}>{item.book.pageCount} стр.</Text>
						) : null}
						{item.book.description ? (
							<Text style={styles.body}>{item.book.description}</Text>
						) : null}
					</Card>
				) : null}

				{shelfNames.length > 0 ? (
					<Card style={styles.card}>
						<Text style={styles.section}>{bookDetailsCopy.shelves}</Text>
						<Text style={styles.body}>{shelfNames.join(' · ')}</Text>
					</Card>
				) : null}

				<SecondaryButton
					label={appCopy.edit}
					onPress={() => router.push(`/books/${item.entry.id}/edit`)}
				/>
				<DestructiveButton label={appCopy.archive} onPress={handleArchive} />
			</Screen>

			{exactOpen ? (
				<ExactProgressModal
					key={`${item.entry.id}-${item.entry.updatedAt}-exact`}
					visible
					entry={item.entry}
					error={exactError}
					onClose={() => setExactOpen(false)}
					onSubmit={(value) => void handleExact(value)}
				/>
			) : null}

			{snack ? (
				<View style={styles.snackWrap}>
					<UndoSnackbar
						message={snack.message}
						actionLabel={todayCopy.undo}
						onDismiss={() => setSnack(null)}
						onAction={() => {
							void (async () => {
								try {
									const result = await undoProgressEvent(
										executor,
										snack.eventId,
									)
									setItem(result.item)
									setSnack(null)
								} catch {
									setSnack(null)
								}
							})()
						}}
					/>
				</View>
			) : null}
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.xxl,
	},
	hero: {
		flexDirection: 'row',
		gap: spacing.md,
		alignItems: 'flex-start',
	},
	heroText: {
		flex: 1,
		gap: spacing.xxs,
		minWidth: 0,
	},
	title: {
		...typography.title,
		fontSize: 24,
		lineHeight: 30,
	},
	subtitle: {
		...typography.body,
		color: colors.textSecondary,
	},
	author: {
		...typography.body,
		color: colors.textSecondary,
	},
	meta: {
		...typography.bodySmall,
		color: colors.muted,
		marginTop: spacing.xxs,
	},
	card: {
		gap: spacing.xs,
	},
	section: {
		...typography.section,
	},
	body: {
		...typography.body,
		color: colors.text,
	},
	muted: {
		...typography.bodySmall,
		color: colors.muted,
	},
	historyLine: {
		...typography.bodySmall,
		color: colors.text,
		paddingVertical: 2,
	},
	barTrack: {
		height: 6,
		borderRadius: 999,
		backgroundColor: colors.surfaceMuted,
		overflow: 'hidden',
		marginVertical: spacing.xxs,
	},
	barFill: {
		height: '100%',
		backgroundColor: colors.primary,
	},
	snackWrap: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		bottom: spacing.lg,
	},
	noteActions: {
		gap: spacing.xs,
		marginTop: spacing.xs,
	},
	missing: {
		...typography.body,
		color: colors.textSecondary,
		marginTop: spacing.xl,
		textAlign: 'center',
	},
})
