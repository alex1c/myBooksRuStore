import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { MonthCalendar } from '@/components/activity/MonthCalendar'
import {
	Card,
	EmptyState,
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { statsCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	getDayActivity,
	getMonthActivity,
	getStreakSummary,
	type DayActivity,
	type StreakSummary,
} from '@/domain/activityService'
import {
	deactivateGoal,
	goalTitle,
	listGoalProgress,
	type GoalProgress,
} from '@/domain/goalsService'
import { formatDiaryDayTitle } from '@/utils/diaryDates'
import { formatDuration } from '@/utils/progress'
import { toDateOnlyLocal } from '@/utils/dates'

/**
 * Activity tab — streak, month calendar, goals (Phase 6).
 * Advanced charts stay Phase 7.
 */
export default function StatsScreen () {
	const { executor } = useDatabase()
	const now = useMemo(() => new Date(), [])
	const [year, setYear] = useState(now.getFullYear())
	const [monthIndex, setMonthIndex] = useState(now.getMonth())
	const [activity, setActivity] = useState<Map<string, DayActivity>>(
		new Map(),
	)
	const [selectedDay, setSelectedDay] = useState<string | null>(
		toDateOnlyLocal(now),
	)
	const [dayDetail, setDayDetail] = useState<DayActivity | null>(null)
	const [streak, setStreak] = useState<StreakSummary | null>(null)
	const [goals, setGoals] = useState<GoalProgress[]>([])
	const [loading, setLoading] = useState(true)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [monthMap, streakSummary, goalRows] = await Promise.all([
				getMonthActivity(executor, year, monthIndex),
				getStreakSummary(executor),
				listGoalProgress(executor),
			])
			setActivity(monthMap)
			setStreak(streakSummary)
			setGoals(goalRows)
			if (selectedDay) {
				setDayDetail(await getDayActivity(executor, selectedDay))
			}
		} finally {
			setLoading(false)
		}
	}, [executor, year, monthIndex, selectedDay])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const handleSelectDay = (dayKey: string) => {
		setSelectedDay(dayKey)
		void (async () => {
			setDayDetail(await getDayActivity(executor, dayKey))
		})()
	}

	const hasAnyActivity = [...activity.values()].some((d) => d.active)

	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader title={statsCopy.title} />

			{loading && !streak ? <LoadingState /> : null}

			<Card style={styles.card}>
				<Text style={styles.section}>{statsCopy.streakTitle}</Text>
				{streak && streak.best === 0 && streak.current === 0 ? (
					<Text style={styles.muted}>{statsCopy.streakEmpty}</Text>
				) : (
					<>
						<Text style={styles.streakValue}>
							{statsCopy.streakCurrent(streak?.current ?? 0)}
						</Text>
						<Text style={styles.muted}>
							{statsCopy.streakBest(streak?.best ?? 0)}
						</Text>
						{streak?.todayPending ? (
							<Text style={styles.hint}>{statsCopy.streakContinue}</Text>
						) : null}
						{streak?.message && !streak.todayPending ? (
							<Text style={styles.hint}>{streak.message}</Text>
						) : null}
					</>
				)}
			</Card>

			<Card style={styles.card}>
				<Text style={styles.section}>{statsCopy.calendarTitle}</Text>
				{!hasAnyActivity && !loading ? (
					<Text style={styles.muted}>{statsCopy.emptyTitle}</Text>
				) : null}
				<MonthCalendar
					year={year}
					monthIndex={monthIndex}
					activity={activity}
					selectedDay={selectedDay}
					onSelectDay={handleSelectDay}
					onChangeMonth={(y, m) => {
						setYear(y)
						setMonthIndex(m)
					}}
				/>
			</Card>

			{selectedDay && dayDetail ? (
				<Card style={styles.card}>
					<Text style={styles.section}>
						{formatDiaryDayTitle(selectedDay)}
					</Text>
					{!dayDetail.active ? (
						<Text style={styles.muted}>{statsCopy.dayEmpty}</Text>
					) : (
						<View style={styles.dayLines}>
							{dayDetail.sessionSeconds > 0 ? (
								<Text style={styles.body}>
									{statsCopy.dayMinutes(
										Math.floor(dayDetail.sessionSeconds / 60),
									)}
								</Text>
							) : null}
							{dayDetail.pagesRead > 0 ? (
								<Text style={styles.body}>
									{statsCopy.dayPages(dayDetail.pagesRead)}
								</Text>
							) : null}
							{dayDetail.percentDelta > 0 ? (
								<Text style={styles.body}>
									{statsCopy.dayPercent(dayDetail.percentDelta)}
								</Text>
							) : null}
							{dayDetail.audioSecondsDelta > 0 ? (
								<Text style={styles.body}>
									{statsCopy.dayAudio(
										formatDuration(dayDetail.audioSecondsDelta),
									)}
								</Text>
							) : null}
							{dayDetail.sessionCount > 0 ? (
								<Text style={styles.body}>
									{statsCopy.daySessions(dayDetail.sessionCount)}
								</Text>
							) : null}
							{dayDetail.noteCount > 0 ? (
								<Text style={styles.muted}>
									{statsCopy.dayNotes(dayDetail.noteCount)}
								</Text>
							) : null}
							{dayDetail.bookTitles.map((title) => (
								<Text key={title} style={styles.book} numberOfLines={1}>
									{title}
								</Text>
							))}
						</View>
					)}
				</Card>
			) : null}

			<Card style={styles.card}>
				<View style={styles.goalsHeader}>
					<Text style={styles.section}>{statsCopy.goalsTitle}</Text>
					<Pressable
						onPress={() => router.push('/goals/form')}
						hitSlop={8}
					>
						<Text style={styles.addLink}>{statsCopy.addGoal}</Text>
					</Pressable>
				</View>

				{goals.length === 0 ? (
					<EmptyState
						icon="flag-outline"
						title={statsCopy.goalsEmpty}
						actionLabel={statsCopy.createGoal}
						onAction={() => router.push('/goals/form')}
					/>
				) : (
					goals.map((item) => (
						<View key={item.goal.id} style={styles.goalRow}>
							<Text style={styles.goalTitle}>{goalTitle(item.goal)}</Text>
							<Text style={styles.body}>{item.summary}</Text>
							<View style={styles.barTrack}>
								<View
									style={[
										styles.barFill,
										{ width: `${Math.round(item.ratio * 100)}%` },
									]}
								/>
							</View>
							{!item.completed ? (
								<Text style={styles.hint}>
									{item.goal.type === 'PAGES'
										? statsCopy.remainingPages(item.remaining)
										: item.goal.type === 'MINUTES'
											? statsCopy.remainingMinutes(item.remaining)
											: statsCopy.remainingBooks(item.remaining)}
								</Text>
							) : null}
							<View style={styles.goalActions}>
								<SecondaryButton
									label={statsCopy.editGoal}
									onPress={() =>
										router.push({
											pathname: '/goals/form',
											params: { id: item.goal.id },
										})
									}
								/>
								<SecondaryButton
									label={statsCopy.archiveGoal}
									onPress={() => {
										Alert.alert(statsCopy.archiveGoalConfirm, undefined, [
											{ text: 'Отмена', style: 'cancel' },
											{
												text: statsCopy.archiveGoal,
												style: 'destructive',
												onPress: () => {
													void (async () => {
														await deactivateGoal(executor, item.goal.id)
														await load()
													})()
												},
											},
										])
									}}
								/>
							</View>
						</View>
					))
				)}
			</Card>

			{goals.length === 0 ? null : (
				<PrimaryButton
					label={statsCopy.createGoal}
					onPress={() => router.push('/goals/form')}
				/>
			)}
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	card: {
		gap: spacing.sm,
	},
	section: {
		...typography.section,
		color: colors.text,
	},
	streakValue: {
		...typography.title,
		fontSize: 26,
		color: colors.primaryDark,
	},
	muted: {
		...typography.bodySmall,
		color: colors.muted,
	},
	hint: {
		...typography.bodySmall,
		color: colors.primaryDark,
	},
	body: {
		...typography.body,
		color: colors.text,
	},
	book: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.text,
	},
	dayLines: {
		gap: 4,
	},
	goalsHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	addLink: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primary,
	},
	goalRow: {
		gap: spacing.xs,
		paddingVertical: spacing.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	goalTitle: {
		...typography.body,
		fontWeight: '700',
		color: colors.text,
	},
	barTrack: {
		height: 8,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
		overflow: 'hidden',
	},
	barFill: {
		height: '100%',
		backgroundColor: colors.primary,
	},
	goalActions: {
		gap: spacing.xs,
		marginTop: spacing.xs,
	},
})
