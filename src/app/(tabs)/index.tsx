import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'

import { ExactProgressModal } from '@/components/reading/ExactProgressModal'
import { ReadingNowCard } from '@/components/reading/ReadingNowCard'
import { UndoSnackbar } from '@/components/reading/UndoSnackbar'
import { MicroHintBanner } from '@/components/help/MicroHintBanner'
import { AppBanner } from '@/components/ads/AppBanner'
import {
	EmptyState,
	LoadingState,
	Screen,
	SectionHeader,
} from '@/components/ui'
import { ADS_BANNER_GROUP_TODAY_LIBRARY } from '@/config/ads'
import { appCopy, helpCopy, sessionCopy, todayCopy, statsCopy } from '@/constants/copy'
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
	dismissHint,
	HINT_KEYS,
	shouldShowHint,
} from '@/domain/help/onboardingService'
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
import {
	shouldShowStartReadingCta,
} from '@/utils/format'
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
	const [showProgressHint, setShowProgressHint] = useState(false)
	const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [reading, bundle, goals, streakSummary, hint] = await Promise.all([
				listReadingNow(executor),
				getActiveSessionBundle(executor),
				listTodayMotivationGoals(executor),
				getStreakSummary(executor),
				shouldShowHint(executor, HINT_KEYS.todayProgress),
			])
			setItems(reading)
			setActive(bundle)
			setMotivationGoals(goals)
			setStreak(streakSummary)
			setShowProgressHint(hint && reading.length > 0)
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
			Alert.alert(appCopy.errorTitle, message.replace(/^INVALID_PROGRESS:/, ''))
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
				setExactError(code.replace(/^INVALID_PROGRESS:/, '') || appCopy.errorTitle)
			}
		} finally {
			setBusy(false)
		}
	}

	const handleStart = async (item: LibraryBookItem) => {
		setBusy(true)
		try {
			if (
				active &&
				active.session.libraryEntryId === item.entry.id
			) {
				router.push('/sessions/active')
				return
			}
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
						{ text: appCopy.close, style: 'cancel' },
					],
				)
				return
			}
			Alert.alert(
				appCopy.errorTitle,
				error instanceof Error ? error.message : 'Не удалось начать сессию',
			)
		} finally {
			setBusy(false)
		}
	}

	const exactItem = items.find((row) => row.entry.id === exactEntryId) ?? null

	const listHeader = useMemo(() => (
		<View>
			<SectionHeader title={todayCopy.title} />

			{active ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${todayCopy.activeSessionBanner}: ${active.item.book.title}`}
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
						<Text style={styles.motivationStreak} numberOfLines={1}>
							{statsCopy.streakCurrent(streak.current)}
							{streak.todayPending
								? ` · ${statsCopy.streakContinue}`
								: ''}
						</Text>
					) : null}
					{motivationGoals.slice(0, 2).map((goal) => (
						<Pressable
							key={goal.goal.id}
							onPress={() => router.push('/(tabs)/stats')}
							accessibilityRole="button"
							accessibilityLabel={goalTitle(goal.goal)}
						>
							<Text style={styles.motivationGoal} numberOfLines={1}>
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
					accessibilityRole="button"
					accessibilityLabel={todayCopy.setGoal}
				>
					<Text style={styles.setGoalLabel}>{todayCopy.setGoal}</Text>
				</Pressable>
			)}

			{items.length > 0 ? (
				<SectionHeader title={todayCopy.readingSection} />
			) : null}
			{showProgressHint && items.length > 0 ? (
				<MicroHintBanner
					message={helpCopy.hintTodayProgress}
					dismissLabel={helpCopy.hintDismiss}
					onDismiss={() => {
						setShowProgressHint(false)
						void dismissHint(executor, HINT_KEYS.todayProgress)
					}}
				/>
			) : null}
		</View>
	), [active, motivationGoals, streak, items.length, showProgressHint, executor])

	return (
		<Screen contentStyle={styles.content}>
			{loading && items.length === 0 ? <LoadingState /> : null}

			{!loading && items.length === 0 ? (
				<View style={styles.empty}>
					{listHeader}
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
				<FlatList
					data={items}
					keyExtractor={(item) => item.entry.id}
					ListHeaderComponent={listHeader}
					renderItem={({ item, index }) => {
						const showStart = shouldShowStartReadingCta(Boolean(active))
						return (
							<ReadingNowCard
								item={item}
								highlighted={index === 0 && !active}
								busy={busy}
								showStartReading={showStart}
								startLabel={todayCopy.startReading}
								onOpen={() => router.push(`/books/${item.entry.id}`)}
								onStartReading={() => void handleStart(item)}
								onQuick={(kind, delta) => void handleQuick(item, kind, delta)}
								onExact={() => {
									setExactError(null)
									setExactEntryId(item.entry.id)
								}}
							/>
						)
					}}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
					initialNumToRender={8}
					windowSize={7}
				/>
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

			{/* Conservatively hide banner while a reading session is active. */}
			<AppBanner
				group={ADS_BANNER_GROUP_TODAY_LIBRARY}
				visible={!active}
			/>
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
		paddingVertical: spacing.md,
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
		marginBottom: spacing.sm,
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
		gap: spacing.xxs,
		marginBottom: spacing.sm,
		paddingVertical: spacing.xs,
		paddingHorizontal: spacing.sm,
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
		...typography.caption,
		color: colors.text,
	},
	miniBar: {
		height: 4,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
		overflow: 'hidden',
		marginTop: 2,
		marginBottom: spacing.xxs,
	},
	miniFill: {
		height: '100%',
		backgroundColor: colors.primary,
	},
	setGoal: {
		marginBottom: spacing.sm,
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
