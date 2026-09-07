import { Pressable, StyleSheet, Text, View } from 'react-native'

import { statsCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import type { DayActivity } from '@/domain/activityService'
import {
	eachLocalDay,
	endOfMonth,
	formatMonthTitle,
	parseLocalDayKey,
	shiftMonth,
	startOfMonth,
} from '@/utils/period'
import { toDateOnlyLocal } from '@/utils/dates'

interface MonthCalendarProps {
	year: number
	monthIndex: number
	activity: Map<string, DayActivity>
	selectedDay: string | null
	onSelectDay: (dayKey: string) => void
	onChangeMonth: (year: number, monthIndex: number) => void
}

function intensityColor (level: DayActivity['intensity']): string {
	if (level === 'strong') {
		return colors.primaryDark
	}
	if (level === 'medium') {
		return colors.primary
	}
	if (level === 'light') {
		return colors.primarySoft
	}
	return 'transparent'
}

/**
 * Simple Monday-first month grid for reading activity.
 */
export function MonthCalendar ({
	year,
	monthIndex,
	activity,
	selectedDay,
	onSelectDay,
	onChangeMonth,
}: MonthCalendarProps) {
	const today = toDateOnlyLocal()
	const anchor = toDateOnlyLocal(new Date(year, monthIndex, 1))
	const start = startOfMonth(anchor)
	const end = endOfMonth(anchor)
	const days = eachLocalDay(start, end)

	// Pad leading cells so Monday is column 0.
	const startDate = parseLocalDayKey(start)
	const jsDay = startDate.getDay()
	const lead = jsDay === 0 ? 6 : jsDay - 1
	const cells: (string | null)[] = [
		...Array.from({ length: lead }, () => null),
		...days,
	]

	return (
		<View style={styles.wrap}>
			<View style={styles.header}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Предыдущий месяц"
					onPress={() => {
						const next = shiftMonth(year, monthIndex, -1)
						onChangeMonth(next.year, next.monthIndex)
					}}
					hitSlop={8}
				>
					<Text style={styles.nav}>‹</Text>
				</Pressable>
				<Text style={styles.title}>{formatMonthTitle(year, monthIndex)}</Text>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Следующий месяц"
					onPress={() => {
						const next = shiftMonth(year, monthIndex, 1)
						onChangeMonth(next.year, next.monthIndex)
					}}
					hitSlop={8}
				>
					<Text style={styles.nav}>›</Text>
				</Pressable>
			</View>

			<View style={styles.weekRow}>
				{statsCopy.weekdays.map((label) => (
					<Text key={label} style={styles.weekday}>
						{label}
					</Text>
				))}
			</View>

			<View style={styles.grid}>
				{cells.map((dayKey, index) => {
					if (!dayKey) {
						return <View key={`pad-${index}`} style={styles.cell} />
					}
					const day = activity.get(dayKey)
					const isToday = dayKey === today
					const isSelected = dayKey === selectedDay
					const dayNum = Number.parseInt(dayKey.slice(8), 10)
					const fill = intensityColor(day?.intensity ?? 'none')

					return (
						<Pressable
							key={dayKey}
							accessibilityRole="button"
							accessibilityLabel={dayKey}
							onPress={() => onSelectDay(dayKey)}
							style={[
								styles.cell,
								isToday ? styles.today : null,
								isSelected ? styles.selected : null,
							]}
						>
							<View
								style={[
									styles.dot,
									day?.active
										? { backgroundColor: fill === colors.primarySoft ? colors.primary : fill }
										: null,
									day?.intensity === 'light'
										? { backgroundColor: '#A8C9BE' }
										: null,
								]}
							>
								<Text
									style={[
										styles.dayNum,
										day?.active && day.intensity !== 'light'
											? styles.dayNumOn
											: null,
									]}
								>
									{dayNum}
								</Text>
							</View>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		gap: spacing.sm,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	title: {
		...typography.section,
		textTransform: 'capitalize',
		color: colors.text,
	},
	nav: {
		...typography.title,
		fontSize: 28,
		color: colors.primary,
		paddingHorizontal: spacing.sm,
	},
	weekRow: {
		flexDirection: 'row',
	},
	weekday: {
		width: `${100 / 7}%`,
		textAlign: 'center',
		...typography.caption,
		color: colors.muted,
		textTransform: 'lowercase',
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
	cell: {
		width: `${100 / 7}%`,
		aspectRatio: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 2,
	},
	dot: {
		width: '86%',
		aspectRatio: 1,
		borderRadius: radii.full,
		alignItems: 'center',
		justifyContent: 'center',
	},
	dayNum: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.text,
	},
	dayNumOn: {
		color: colors.textInverse,
	},
	today: {
		borderRadius: radii.md,
		borderWidth: 1,
		borderColor: colors.primary,
	},
	selected: {
		backgroundColor: colors.surfaceMuted,
		borderRadius: radii.md,
	},
})
