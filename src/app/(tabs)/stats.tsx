/**
 * Statistics tab — period analytics + Phase 6 streak / calendar / goals.
 */

import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { MonthCalendar } from '@/components/activity/MonthCalendar'
import {
	formatSeriesValue,
	SimpleBarChart,
} from '@/components/stats/SimpleBarChart'
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
import { statusFilterLabels } from '@/constants/labels'
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
import {
	getStatsDashboard,
	type SeriesMetric,
	type StatsDashboard,
} from '@/domain/statisticsService'
import { formatDiaryDayTitle } from '@/utils/diaryDates'
import { toDateOnlyLocal } from '@/utils/dates'
import {
	formatBooksCount,
	formatDaysCount,
	formatIntegerRu,
	formatPagesCount,
	formatRatingRu,
	formatStatsDuration,
} from '@/utils/format'
import { formatDuration } from '@/utils/progress'
import type { StatsPeriodKind } from '@/utils/statsPeriod'

const PERIODS: { kind: StatsPeriodKind; label: string }[] = [
	{ kind: 'D7', label: statsCopy.periodD7 },
	{ kind: 'D30', label: statsCopy.periodD30 },
	{ kind: 'D90', label: statsCopy.periodD90 },
	{ kind: 'YEAR', label: statsCopy.periodYearStats },
	{ kind: 'ALL', label: statsCopy.periodAll },
]

/**
 * Statistics screen: summary → charts → insights → calendar → streak → goals.
 */
export default function StatsScreen () {
	const { executor } = useDatabase()
	const now = useMemo(() => new Date(), [])
	const [periodKind, setPeriodKind] = useState<StatsPeriodKind>('D30')
	const [statsYear, setStatsYear] = useState(now.getFullYear())
	const [metric, setMetric] = useState<SeriesMetric>('time')
	const [dashboard, setDashboard] = useState<StatsDashboard | null>(null)

	const [calYear, setCalYear] = useState(now.getFullYear())
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
	const [calendarOpen, setCalendarOpen] = useState(true)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [dash, monthMap, streakSummary, goalRows] = await Promise.all([
				getStatsDashboard(
					executor,
					periodKind,
					new Date(),
					periodKind === 'YEAR' ? statsYear : undefined,
				),
				getMonthActivity(executor, calYear, monthIndex),
				getStreakSummary(executor),
				listGoalProgress(executor),
			])
			setDashboard(dash)
			setActivity(monthMap)
			setStreak(streakSummary)
			setGoals(goalRows)
			if (selectedDay) {
				setDayDetail(await getDayActivity(executor, selectedDay))
			}
		} finally {
			setLoading(false)
		}
	}, [
		executor,
		periodKind,
		statsYear,
		calYear,
		monthIndex,
		selectedDay,
	])

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

	const chartData = useMemo(() => {
		if (!dashboard) {
			return []
		}
		return dashboard.series.map((p) => ({
			key: p.key,
			label: p.label,
			value: metric === 'time' ? p.seconds : p.pages,
		}))
	}, [dashboard, metric])

	const booksChartData = useMemo(() => {
		if (!dashboard?.monthlyBooks) {
			return []
		}
		return dashboard.monthlyBooks.months.map((m, idx) => ({
			key: `m-${idx}-${m.label}`,
			label: m.label,
			value: m.count,
		}))
	}, [dashboard])

	const formatMax = useMemo(() => {
		if (!dashboard) {
			return 1
		}
		return Math.max(
			1,
			dashboard.formats.PAPER,
			dashboard.formats.EBOOK,
			dashboard.formats.AUDIOBOOK,
		)
	}, [dashboard])

	const showEmptyStats = dashboard && !dashboard.hasReadingSignal

	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader title={statsCopy.title} />

			{loading && !dashboard ? <LoadingState /> : null}

			{/* Period selector */}
			<View style={styles.periodRow}>
				{PERIODS.map((p) => {
					const active = periodKind === p.kind
					return (
						<Pressable
							key={p.kind}
							onPress={() => setPeriodKind(p.kind)}
							style={[styles.periodChip, active && styles.periodChipActive]}
							accessibilityRole="button"
							accessibilityState={{ selected: active }}
						>
							<Text
								style={[
									styles.periodChipText,
									active && styles.periodChipTextActive,
								]}
							>
								{p.label}
							</Text>
						</Pressable>
					)
				})}
			</View>

			{periodKind === 'YEAR' ? (
				<View style={styles.yearNav}>
					<Pressable
						onPress={() => setStatsYear((y) => y - 1)}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Предыдущий год"
					>
						<Text style={styles.yearNavBtn}>‹</Text>
					</Pressable>
					<Text style={styles.yearNavLabel}>{statsYear}</Text>
					<Pressable
						onPress={() => setStatsYear((y) => y + 1)}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Следующий год"
					>
						<Text style={styles.yearNavBtn}>›</Text>
					</Pressable>
				</View>
			) : null}

			{showEmptyStats ? (
				<EmptyState
					icon="stats-chart-outline"
					title={statsCopy.emptyTitle}
					description={statsCopy.emptyDescription}
				/>
			) : null}

			{dashboard && dashboard.hasReadingSignal ? (
				<>
					{/* Summary */}
					<Card style={styles.card}>
						<Text style={styles.section}>{statsCopy.summaryTitle}</Text>
						<View style={styles.summaryGrid}>
							<SummaryCell
								label={statsCopy.summaryBooks}
								value={formatBooksCount(dashboard.summary.booksFinished)}
							/>
							<SummaryCell
								label={statsCopy.summaryPages}
								value={formatPagesCount(dashboard.summary.pagesRead)}
							/>
							<SummaryCell
								label={statsCopy.summaryTime}
								value={
									dashboard.summary.readingSeconds > 0
										? formatStatsDuration(dashboard.summary.readingSeconds)
										: statsCopy.noTimeData
								}
							/>
							<SummaryCell
								label={statsCopy.summaryDays}
								value={formatDaysCount(dashboard.summary.readingDays)}
							/>
						</View>
						{dashboard.summary.percentProgress > 0 ? (
							<Text style={styles.hint}>
								{statsCopy.percentInsight(dashboard.summary.percentProgress)}
							</Text>
						) : null}
						{dashboard.summary.yearPrecisionBooks > 0 &&
						periodKind === 'YEAR' ? (
							<Text style={styles.muted}>
								{statsCopy.yearPrecisionHint(
									dashboard.summary.yearPrecisionBooks,
								)}
							</Text>
						) : null}
						{dashboard.summary.unknownPrecisionBooks > 0 &&
						periodKind === 'ALL' ? (
							<Text style={styles.muted}>
								{statsCopy.unknownPrecisionHint(
									dashboard.summary.unknownPrecisionBooks,
								)}
							</Text>
						) : null}
					</Card>

					{/* Reading dynamics chart */}
					<Card style={styles.card}>
						<Text style={styles.section}>{statsCopy.chartTitle}</Text>
						<View style={styles.metricRow}>
							{(
								[
									['time', statsCopy.chartMetricTime],
									['pages', statsCopy.chartMetricPages],
								] as const
							).map(([key, label]) => {
								const active = metric === key
								return (
									<Pressable
										key={key}
										onPress={() => setMetric(key)}
										style={[
											styles.metricChip,
											active && styles.metricChipActive,
										]}
									>
										<Text
											style={[
												styles.metricChipText,
												active && styles.metricChipTextActive,
											]}
										>
											{label}
										</Text>
									</Pressable>
								)
							})}
						</View>
						<SimpleBarChart
							data={chartData}
							emptyLabel={statsCopy.chartEmpty}
							metricLabel={
								metric === 'time'
									? statsCopy.chartMetricTime
									: statsCopy.chartMetricPages
							}
							formatValue={(v) => formatSeriesValue(metric, v)}
						/>
					</Card>

					{/* Monthly books (year / all) */}
					{dashboard.monthlyBooks ? (
						<Card style={styles.card}>
							<Text style={styles.section}>
								{statsCopy.booksByMonthTitle}
							</Text>
							<SimpleBarChart
								data={booksChartData}
								emptyLabel={statsCopy.chartEmpty}
								metricLabel={statsCopy.booksByMonthTitle}
								formatValue={(v) => formatBooksCount(v)}
							/>
							{dashboard.monthlyBooks.yearPrecisionOnly > 0 &&
							periodKind === 'YEAR' ? (
								<Text style={styles.muted}>
									{statsCopy.yearPrecisionHint(
										dashboard.monthlyBooks.yearPrecisionOnly,
									)}
								</Text>
							) : null}
							{dashboard.monthlyBooks.unknownPrecision > 0 &&
							periodKind === 'ALL' ? (
								<Text style={styles.muted}>
									{statsCopy.unknownPrecisionHint(
										dashboard.monthlyBooks.unknownPrecision,
									)}
								</Text>
							) : null}
						</Card>
					) : null}

					{/* Formats */}
					{(dashboard.formats.PAPER > 0 ||
						dashboard.formats.EBOOK > 0 ||
						dashboard.formats.AUDIOBOOK > 0) && (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.formatsTitle}</Text>
							<FormatBar
								label={statsCopy.formatPaper}
								count={dashboard.formats.PAPER}
								max={formatMax}
							/>
							<FormatBar
								label={statsCopy.formatEbook}
								count={dashboard.formats.EBOOK}
								max={formatMax}
							/>
							<FormatBar
								label={statsCopy.formatAudio}
								count={dashboard.formats.AUDIOBOOK}
								max={formatMax}
							/>
						</Card>
					)}

					{/* Sessions */}
					{dashboard.sessions.count > 0 ? (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.sessionsTitle}</Text>
							<Text style={styles.body}>
								{statsCopy.sessionsCount}:{' '}
								{formatIntegerRu(dashboard.sessions.count)}
							</Text>
							{dashboard.sessions.averageSeconds != null ? (
								<Text style={styles.body}>
									{statsCopy.sessionsAvg}:{' '}
									{formatStatsDuration(dashboard.sessions.averageSeconds)}
								</Text>
							) : null}
							{dashboard.sessions.maxSeconds != null ? (
								<Text style={styles.body}>
									{statsCopy.sessionsMax}:{' '}
									{formatStatsDuration(dashboard.sessions.maxSeconds)}
								</Text>
							) : null}
						</Card>
					) : null}

					{/* Averages + most active day */}
					{(dashboard.averages.secondsPerActiveDay != null ||
						dashboard.averages.pagesPerActiveDay != null ||
						dashboard.mostActiveDay) && (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.averagesTitle}</Text>
							{dashboard.averages.secondsPerActiveDay != null ? (
								<Text style={styles.body}>
									{formatStatsDuration(
										dashboard.averages.secondsPerActiveDay,
									)}{' '}
									{statsCopy.avgPerActiveDayTime}
								</Text>
							) : null}
							{dashboard.averages.pagesPerActiveDay != null ? (
								<Text style={styles.body}>
									{formatIntegerRu(dashboard.averages.pagesPerActiveDay)}{' '}
									{statsCopy.avgPerActiveDayPages}
								</Text>
							) : null}
							{dashboard.mostActiveDay ? (
								<>
									<Text style={styles.sectionSmall}>
										{statsCopy.mostActiveDayTitle}
									</Text>
									<Text style={styles.body}>
										{formatDiaryDayTitle(dashboard.mostActiveDay.dayKey)} ·{' '}
										{formatStatsDuration(dashboard.mostActiveDay.seconds)}
									</Text>
								</>
							) : null}
							{dashboard.pacePagesPerActiveDay30 != null ? (
								<Text style={styles.hint}>
									{statsCopy.pacePages(dashboard.pacePagesPerActiveDay30)}
								</Text>
							) : null}
						</Card>
					)}

					{/* Top books */}
					{dashboard.topBooks.length > 0 ? (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.topBooksTitle}</Text>
							{dashboard.topBooks.map((book, index) => (
								<Text
									key={book.libraryEntryId}
									style={styles.body}
									numberOfLines={2}
								>
									{index + 1}. {book.title} —{' '}
									{formatStatsDuration(book.durationSeconds)}
								</Text>
							))}
						</Card>
					) : null}

					{/* Top authors */}
					{dashboard.topAuthors.length > 0 ? (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.topAuthorsTitle}</Text>
							{dashboard.topAuthors.map((a) => (
								<Text key={a.authorText} style={styles.body} numberOfLines={1}>
									{a.authorText} — {statsCopy.authorBooks(a.bookCount)}
								</Text>
							))}
						</Card>
					) : null}

					{/* Ratings */}
					{dashboard.ratings.average != null ? (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.ratingsTitle}</Text>
							<Text style={styles.streakValue}>
								{statsCopy.ratingAverage(
									formatRatingRu(dashboard.ratings.average),
								)}
							</Text>
							<Text style={styles.muted}>
								{statsCopy.ratingCoverage(
									dashboard.ratings.ratedCount,
									dashboard.ratings.finishedCount,
								)}
							</Text>
						</Card>
					) : null}

					{/* Notes */}
					{(dashboard.notes.QUOTE > 0 ||
						dashboard.notes.THOUGHT > 0 ||
						dashboard.notes.NOTE > 0) && (
						<Card style={styles.card}>
							<Text style={styles.section}>{statsCopy.notesTitle}</Text>
							<Text style={styles.body}>
								{statsCopy.notesQuote}: {formatIntegerRu(dashboard.notes.QUOTE)}
							</Text>
							<Text style={styles.body}>
								{statsCopy.notesThought}:{' '}
								{formatIntegerRu(dashboard.notes.THOUGHT)}
							</Text>
							<Text style={styles.body}>
								{statsCopy.notesNote}: {formatIntegerRu(dashboard.notes.NOTE)}
							</Text>
						</Card>
					)}
				</>
			) : null}

			{/* Library now — lifetime, always useful */}
			{dashboard ? (
				<Card style={styles.card}>
					<Text style={styles.section}>{statsCopy.libraryNowTitle}</Text>
					{(
						[
							'READING',
							'WANT_TO_READ',
							'FINISHED',
							'PAUSED',
							'ABANDONED',
						] as const
					).map((status) => (
						<Text key={status} style={styles.body}>
							{statusFilterLabels[status]}:{' '}
							{formatIntegerRu(dashboard.libraryNow[status])}
						</Text>
					))}
				</Card>
			) : null}

			{/* Streak */}
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

			{/* Calendar */}
			<Card style={styles.card}>
				<View style={styles.goalsHeader}>
					<Text style={styles.section}>{statsCopy.calendarCompactTitle}</Text>
					<Pressable
						onPress={() => setCalendarOpen((v) => !v)}
						hitSlop={8}
					>
						<Text style={styles.addLink}>
							{calendarOpen ? 'Свернуть' : 'Развернуть'}
						</Text>
					</Pressable>
				</View>
				{calendarOpen ? (
					<>
						<MonthCalendar
							year={calYear}
							monthIndex={monthIndex}
							activity={activity}
							selectedDay={selectedDay}
							onSelectDay={handleSelectDay}
							onChangeMonth={(y, m) => {
								setCalYear(y)
								setMonthIndex(m)
							}}
						/>
						{selectedDay && dayDetail ? (
							<View style={styles.dayLines}>
								<Text style={styles.sectionSmall}>
									{formatDiaryDayTitle(selectedDay)}
								</Text>
								{!dayDetail.active ? (
									<Text style={styles.muted}>{statsCopy.dayEmpty}</Text>
								) : (
									<>
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
										{dayDetail.bookTitles.map((title) => (
											<Text
												key={title}
												style={styles.book}
												numberOfLines={1}
											>
												{title}
											</Text>
										))}
									</>
								)}
							</View>
						) : null}
					</>
				) : null}
			</Card>

			{/* Goals */}
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

function SummaryCell ({ label, value }: { label: string; value: string }) {
	return (
		<View style={styles.summaryCell} accessibilityLabel={`${label}: ${value}`}>
			<Text style={styles.summaryValue}>{value}</Text>
			<Text style={styles.summaryLabel}>{label}</Text>
		</View>
	)
}

function FormatBar ({
	label,
	count,
	max,
}: {
	label: string
	count: number
	max: number
}) {
	const widthPct = Math.round((count / Math.max(1, max)) * 100)
	return (
		<View style={styles.formatRow}>
			<Text style={styles.body}>
				{label} {formatIntegerRu(count)}
			</Text>
			<View style={styles.barTrack}>
				<View style={[styles.barFill, { width: `${widthPct}%` as `${number}%` }]} />
			</View>
		</View>
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
	sectionSmall: {
		...typography.body,
		fontWeight: '700',
		color: colors.text,
		marginTop: spacing.xs,
	},
	periodRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	periodChip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
	},
	periodChipActive: {
		backgroundColor: colors.primarySoft,
	},
	periodChipText: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	periodChipTextActive: {
		color: colors.primaryDark,
	},
	yearNav: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.lg,
	},
	yearNavBtn: {
		fontSize: 28,
		color: colors.primary,
		fontWeight: '600',
		paddingHorizontal: spacing.sm,
	},
	yearNavLabel: {
		...typography.section,
		color: colors.text,
	},
	summaryGrid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	summaryCell: {
		width: '47%',
		backgroundColor: colors.surfaceMuted,
		borderRadius: radii.md,
		padding: spacing.sm,
		gap: 2,
	},
	summaryValue: {
		...typography.section,
		fontSize: 20,
		color: colors.primaryDark,
	},
	summaryLabel: {
		...typography.caption,
		color: colors.muted,
	},
	metricRow: {
		flexDirection: 'row',
		gap: spacing.xs,
	},
	metricChip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xxs,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
	},
	metricChipActive: {
		backgroundColor: colors.primary,
	},
	metricChipText: {
		...typography.caption,
		color: colors.textSecondary,
		fontWeight: '700',
	},
	metricChipTextActive: {
		color: colors.textInverse,
	},
	formatRow: {
		gap: spacing.xxs,
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
		marginTop: spacing.sm,
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
