import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { ExactProgressModal } from '@/components/reading/ExactProgressModal'
import { ReadingNowCard } from '@/components/reading/ReadingNowCard'
import { UndoSnackbar } from '@/components/reading/UndoSnackbar'
import {
	EmptyState,
	LoadingState,
	Screen,
	SectionHeader,
} from '@/components/ui'
import { sessionCopy, todayCopy, statsCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { listReadingNow } from '@/domain/libraryService'
import {
	listTodayMotivationGoals,
	goalTitle,
	type GoalProgress,
} from '@/domain/goalsService'
import { getStreakSummary, type StreakSummary } from '@/domain/activityService'
import {
	ActiveSessionConflictError,
	applyQuickProgress,
	getActiveSessionBundle,
	isCompletionReached,
	markBookFinished,
	startReadingSession,
	undoProgressEvent,
	type ActiveSessionBundle,
	type QuickDelta,
} from '@/domain/readingTrackerService'
import type { LibraryBookItem } from '@/db/types'
import { formatSessionTimer } from '@/utils/sessionTimer'

/**
 * Today tab — primary reading workspace (quick progress + sessions).
 */
export default function TodayScreen () {
	const { executor } = useDatabase()
	const [items, setItems] = useState<LibraryBookItem[]>([])
	const [active, setActive] = useState<ActiveSessionBundle | null>(null)
	const [motivationGoals, setMotivationGoals] = useState<GoalProgress[]>([])
	const [streak, setStreak] = useState<StreakSummary | null>(null)
	const [loading, setLoading] = useState(true)
	const [busy, setBusy] = useState(false)
	const [exactEntryId, setExactEntryId] = useState<string | null>(null)
	const [exactError, setExactError] = useState<string | null>(null)
	const [snack, setSnack] = useState<{
		message: string
		eventId: string
	} | null>(null)
	const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [reading, bundle, goals, streakSummary] = await Promise.all([
				listReadingNow(executor),
				getActiveSessionBundle(executor),
				listTodayMotivationGoals(executor),
				getStreakSummary(executor),
			])
			setItems(reading)
			setActive(bundle)
			setMotivationGoals(goals)
			setStreak(streakSummary)
		} finally {
			setLoading(false)
		}
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const showSnack = (message: string, eventId: string) => {
		if (snackTimer.current) {
			clearTimeout(snackTimer.current)
		}
		setSnack({ message, eventId })
		snackTimer.current = setTimeout(() => setSnack(null), 5000)
	}

	const offerCompletion = (item: LibraryBookItem) => {
		if (!isCompletionReached(item.entry) || item.entry.status === 'FINISHED') {
			return
		}
		Alert.alert(sessionCopy.completionTitle, sessionCopy.completionMessage, [
			{ text: sessionCopy.completionLater, style: 'cancel' },
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

	const handleQuick = async (
		item: LibraryBookItem,
		kind: 'pages' | 'percent' | 'minutes',
		delta: number,
	) => {
		setBusy(true)
		try {
			const payload: QuickDelta =
				kind === 'pages'
					? { kind: 'pages', delta }
					: kind === 'percent'
						? { kind: 'percent', delta }
						: { kind: 'minutes', delta }
			const result = await applyQuickProgress(executor, item.entry.id, payload)
			setItems((prev) =>
				prev.map((row) =>
					row.entry.id === result.item.entry.id ? result.item : row,
				),
			)
			showSnack(
				`${todayCopy.progressUpdated} · ${result.feedbackLabel}`,
				result.event.id,
			)
			offerCompletion(result.item)
		} catch (error) {
			const message =
				error instanceof Error ? error.message : 'Не удалось обновить прогресс'
			Alert.alert('Ошибка', message.replace(/^INVALID_PROGRESS:/, ''))
		} finally {
			setBusy(false)
		}
	}

	const handleExactSubmit = async (value: {
		kind: 'setPages' | 'setPercent' | 'setAudioSeconds'
		page?: number
		percent?: number
		seconds?: number
	}) => {
		if (!exactEntryId) {
			return
		}
		setExactError(null)
		setBusy(true)
		try {
			let delta: QuickDelta
			if (value.kind === 'setPages') {
				if (value.page == null || Number.isNaN(value.page)) {
					setExactError('Укажите страницу')
					return
				}
				delta = { kind: 'setPages', page: value.page }
			} else if (value.kind === 'setPercent') {
				if (value.percent == null || Number.isNaN(value.percent)) {
					setExactError('Укажите процент')
					return
				}
				delta = { kind: 'setPercent', percent: value.percent }
			} else {
				if (value.seconds == null || Number.isNaN(value.seconds)) {
					setExactError('Укажите время')
					return
				}
				delta = { kind: 'setAudioSeconds', seconds: value.seconds }
			}
			const result = await applyQuickProgress(executor, exactEntryId, delta)
			setExactEntryId(null)
			setItems((prev) =>
				prev.map((row) =>
					row.entry.id === result.item.entry.id ? result.item : row,
				),
			)
			showSnack(
				`${todayCopy.progressUpdated} · ${result.feedbackLabel}`,
				result.event.id,
			)
			offerCompletion(result.item)
		} catch (error) {
			const code = error instanceof Error ? error.message : ''
			if (code === 'PAGE_EXCEEDS_TOTAL') {
				setExactError('Страница больше общего числа страниц')
			} else if (code === 'INVALID_PERCENT') {
				setExactError('Процент от 0 до 100')
			} else if (code === 'AUDIO_EXCEEDS_DURATION') {
				setExactError('Позиция больше длительности')
			} else {
				setExactError(code.replace(/^INVALID_PROGRESS:/, '') || 'Ошибка')
			}
		} finally {
			setBusy(false)
		}
	}

	const handleStart = async (item: LibraryBookItem) => {
		setBusy(true)
		try {
			const bundle = await startReadingSession(executor, item.entry.id)
			setActive(bundle)
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
				error instanceof Error ? error.message : 'Не удалось начать сессию',
			)
		} finally {
			setBusy(false)
		}
	}

	const exactItem = items.find((row) => row.entry.id === exactEntryId) ?? null

	return (
		<Screen contentStyle={styles.content}>
			<SectionHeader title={todayCopy.title} />

			{active ? (
				<Pressable
					accessibilityRole="button"
					onPress={() => router.push('/sessions/active')}
					style={styles.banner}
				>
					<View style={styles.bannerText}>
						<Text style={styles.bannerTitle}>
							{todayCopy.activeSessionBanner}
						</Text>
						<Text style={styles.bannerBook} numberOfLines={1}>
							{active.item.book.title}
						</Text>
						<Text style={styles.bannerMeta}>
							{formatSessionTimer(active.elapsedSeconds)} ·{' '}
							{todayCopy.continueSession}
						</Text>
					</View>
				</Pressable>
			) : null}

			{motivationGoals.length > 0 || (streak && streak.current > 0) ? (
				<View style={styles.motivation}>
					{streak && streak.current > 0 ? (
						<Text style={styles.motivationStreak}>
							{statsCopy.streakCurrent(streak.current)}
							{streak.todayPending
								? ` · ${statsCopy.streakContinue}`
								: ''}
						</Text>
					) : null}
					{motivationGoals.map((goal) => (
						<Pressable
							key={goal.goal.id}
							onPress={() => router.push('/(tabs)/stats')}
						>
							<Text style={styles.motivationGoal}>
								{goalTitle(goal.goal)} · {goal.summary}
							</Text>
							<View style={styles.miniBar}>
								<View
									style={[
										styles.miniFill,
										{ width: `${Math.round(goal.ratio * 100)}%` },
									]}
								/>
							</View>
						</Pressable>
					))}
				</View>
			) : (
				<Pressable
					onPress={() => router.push('/goals/form')}
					style={styles.setGoal}
				>
					<Text style={styles.setGoalLabel}>{todayCopy.setGoal}</Text>
				</Pressable>
			)}

			{loading && items.length === 0 ? <LoadingState /> : null}
			{!loading && items.length === 0 ? (
				<View style={styles.empty}>
					<EmptyState
						icon="sunny-outline"
						title={todayCopy.emptyTitle}
						description={todayCopy.emptyDescription}
						actionLabel={todayCopy.chooseFromLibrary}
						onAction={() => router.push('/(tabs)/library')}
						secondaryActionLabel={todayCopy.addBook}
						onSecondaryAction={() => router.push('/books/add')}
					/>
				</View>
			) : null}

			{items.length > 0 ? (
				<>
					<SectionHeader title={todayCopy.readingSection} />
					<FlatList
						data={items}
						keyExtractor={(item) => item.entry.id}
						renderItem={({ item, index }) => (
							<ReadingNowCard
								item={item}
								highlighted={index === 0}
								busy={busy}
								onOpen={() => router.push(`/books/${item.entry.id}`)}
								onStartReading={() => void handleStart(item)}
								onQuick={(kind, delta) => void handleQuick(item, kind, delta)}
								onExact={() => {
									setExactError(null)
									setExactEntryId(item.entry.id)
								}}
							/>
						)}
						contentContainerStyle={styles.list}
						showsVerticalScrollIndicator={false}
					/>
				</>
			) : null}

			{exactItem ? (
				<ExactProgressModal
					key={`${exactItem.entry.id}-${exactItem.entry.updatedAt}`}
					visible
					entry={exactItem.entry}
					error={exactError}
					onClose={() => setExactEntryId(null)}
					onSubmit={(value) => void handleExactSubmit(value)}
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
									await undoProgressEvent(executor, snack.eventId)
									setSnack(null)
									await load()
								} catch {
									setSnack(null)
								}
							})()
						}}
					/>
				</View>
			) : null}
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingBottom: 0,
	},
	empty: {
		flex: 1,
		justifyContent: 'center',
		paddingVertical: spacing.xl,
	},
	list: {
		paddingBottom: spacing.xxl,
	},
	banner: {
		backgroundColor: colors.primarySoft,
		borderRadius: radii.lg,
		borderWidth: 1,
		borderColor: colors.primary,
		padding: spacing.md,
		marginBottom: spacing.md,
	},
	bannerText: {
		gap: 2,
	},
	bannerTitle: {
		...typography.caption,
		color: colors.primaryDark,
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	bannerBook: {
		...typography.section,
		color: colors.text,
	},
	bannerMeta: {
		...typography.bodySmall,
		color: colors.primaryDark,
	},
	motivation: {
		gap: spacing.xs,
		marginBottom: spacing.md,
		padding: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radii.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	motivationStreak: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.primaryDark,
	},
	motivationGoal: {
		...typography.bodySmall,
		color: colors.text,
	},
	miniBar: {
		height: 5,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
		overflow: 'hidden',
		marginTop: 4,
		marginBottom: spacing.xs,
	},
	miniFill: {
		height: '100%',
		backgroundColor: colors.primary,
	},
	setGoal: {
		marginBottom: spacing.md,
		alignSelf: 'flex-start',
	},
	setGoalLabel: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primary,
	},
	snackWrap: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		bottom: spacing.lg,
	},
})
