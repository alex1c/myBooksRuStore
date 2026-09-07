/**
 * Lightweight SVG bar chart for statistics (no heavy chart library).
 */

import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Rect } from 'react-native-svg'

import { colors, spacing, typography } from '@/constants/theme'
import { formatIntegerRu, formatStatsDuration } from '@/utils/format'

export interface BarDatum {
	key: string
	label: string
	value: number
}

interface SimpleBarChartProps {
	data: BarDatum[]
	/** Accessibility / empty copy. */
	emptyLabel: string
	/** Selected bar detail formatter. */
	formatValue?: (value: number) => string
	height?: number
	metricLabel?: string
}

const CHART_HEIGHT = 140
const AXIS_HEIGHT = 28

/**
 * Compact bar chart: tap a bar for label + value (no floating tooltip overlay).
 */
export function SimpleBarChart ({
	data,
	emptyLabel,
	formatValue,
	height = CHART_HEIGHT,
	metricLabel,
}: SimpleBarChartProps) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null)
	const max = useMemo(
		() => Math.max(0, ...data.map((d) => d.value)),
		[data],
	)
	const hasSignal = data.some((d) => d.value > 0)

	if (!hasSignal) {
		return (
			<View
				style={styles.empty}
				accessibilityRole="text"
				accessibilityLabel={emptyLabel}
			>
				<Text style={styles.emptyText}>{emptyLabel}</Text>
			</View>
		)
	}

	const selected = data.find((d) => d.key === selectedKey) ?? null
	const fmt =
		formatValue ??
		((v: number) => formatIntegerRu(v))

	const barGap = data.length > 40 ? 1 : data.length > 20 ? 2 : 4
	const plotWidth = Math.max(280, data.length * 10)

	return (
		<View
			accessibilityRole="summary"
			accessibilityLabel={
				metricLabel
					? `${metricLabel}. Максимум ${fmt(max)}.`
					: `График. Максимум ${fmt(max)}.`
			}
		>
			{selected ? (
				<Text style={styles.selection}>
					{selected.label} · {fmt(selected.value)}
				</Text>
			) : (
				<Text style={styles.selectionHint}>Нажмите столбик для деталей</Text>
			)}

			<View style={[styles.plot, { height: height + AXIS_HEIGHT }]}>
				<Svg width="100%" height={height} viewBox={`0 0 ${plotWidth} ${height}`}>
					{data.map((d, index) => {
						const slot = plotWidth / data.length
						const barW = Math.max(2, slot - barGap)
						const h =
							max > 0 ? Math.max(d.value > 0 ? 2 : 0, (d.value / max) * (height - 4)) : 0
						const x = index * slot + (slot - barW) / 2
						const y = height - h
						const active = selectedKey === d.key
						return (
							<Rect
								key={d.key}
								x={x}
								y={y}
								width={barW}
								height={h}
								rx={2}
								fill={active ? colors.primaryDark : colors.primary}
								opacity={d.value > 0 ? 1 : 0.15}
								onPress={() => setSelectedKey(d.key)}
							/>
						)
					})}
				</Svg>

				{/* Tap targets as Pressables for better RN hit area */}
				<View style={[styles.hitRow, { height }]} pointerEvents="box-none">
					{data.map((d) => (
						<Pressable
							key={`hit-${d.key}`}
							style={styles.hit}
							accessibilityRole="button"
							accessibilityLabel={`${d.label}: ${fmt(d.value)}`}
							onPress={() => setSelectedKey(d.key)}
						/>
					))}
				</View>

				<View style={styles.axisRow}>
					{data.length <= 12
						? data.map((d) => (
							<Text key={`ax-${d.key}`} style={styles.axisLabel} numberOfLines={1}>
								{d.label}
							</Text>
						))
						: (
							<>
								<Text style={styles.axisLabel}>{data[0]?.label}</Text>
								<Text style={styles.axisLabel}>{data[Math.floor(data.length / 2)]?.label}</Text>
								<Text style={styles.axisLabel}>{data[data.length - 1]?.label}</Text>
							</>
						)}
				</View>
			</View>
		</View>
	)
}

/** Format chart value as minutes or pages depending on metric. */
export function formatSeriesValue (
	metric: 'time' | 'pages',
	value: number,
): string {
	if (metric === 'time') {
		return formatStatsDuration(value)
	}
	return `${formatIntegerRu(value)} стр.`
}

const styles = StyleSheet.create({
	empty: {
		paddingVertical: spacing.lg,
		alignItems: 'center',
	},
	emptyText: {
		...typography.bodySmall,
		color: colors.muted,
		textAlign: 'center',
	},
	selection: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.text,
		marginBottom: spacing.xs,
	},
	selectionHint: {
		...typography.caption,
		color: colors.muted,
		marginBottom: spacing.xs,
	},
	plot: {
		width: '100%',
	},
	hitRow: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		flexDirection: 'row',
	},
	hit: {
		flex: 1,
	},
	axisRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: spacing.xxs,
		gap: 2,
	},
	axisLabel: {
		...typography.caption,
		color: colors.muted,
		flex: 1,
		textAlign: 'center',
		fontSize: 10,
	},
})
