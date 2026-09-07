/**
 * Compact annual activity heatmap (12 months × days) using Phase 6 intensity.
 */

import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'

import type { ActivityIntensity } from '@/domain/activityService'
import type { YearActivityDay } from '@/domain/yearInBooksService'
import { colors, spacing, typography } from '@/constants/theme'
import { eachLocalDay, parseLocalDayKey } from '@/utils/period'

interface YearHeatmapProps {
	year: number
	days: YearActivityDay[]
}

function colorFor (intensity: ActivityIntensity): string {
	if (intensity === 'strong') {
		return colors.primaryDark
	}
	if (intensity === 'medium') {
		return colors.primary
	}
	if (intensity === 'light') {
		return '#A8C9BE'
	}
	return colors.surfaceMuted
}

/**
 * Lightweight SVG grid — one cell per local day of the year.
 */
export function YearActivityHeatmap ({ year, days }: YearHeatmapProps) {
	const map = useMemo(() => {
		const m = new Map<string, ActivityIntensity>()
		for (const d of days) {
			m.set(d.dayKey, d.intensity)
		}
		return m
	}, [days])

	const cells = useMemo(() => {
		const start = `${year}-01-01`
		const end = `${year}-12-31`
		return eachLocalDay(start, end).map((dayKey) => ({
			dayKey,
			intensity: map.get(dayKey) ?? 'none',
		}))
	}, [year, map])

	const cell = 8
	const gap = 2
	const cols = 20
	const rows = Math.ceil(cells.length / cols)
	const width = cols * (cell + gap)
	const height = rows * (cell + gap)

	return (
		<View
			accessibilityLabel={`Активность за ${year} год: ${days.length} дней чтения`}
		>
			<Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
				{cells.map((c, index) => {
					const col = index % cols
					const row = Math.floor(index / cols)
					return (
						<Rect
							key={c.dayKey}
							x={col * (cell + gap)}
							y={row * (cell + gap)}
							width={cell}
							height={cell}
							rx={1}
							fill={colorFor(c.intensity)}
						/>
					)
				})}
			</Svg>
			<Text style={styles.legend}>
				Светлее — меньше активности · темнее — больше
			</Text>
		</View>
	)
}

/** Month label helper kept for potential axis labels. */
export function monthShortFromDay (dayKey: string): string {
	return String(parseLocalDayKey(dayKey).getMonth() + 1)
}

const styles = StyleSheet.create({
	legend: {
		...typography.caption,
		color: colors.muted,
		marginTop: spacing.xs,
	},
})
