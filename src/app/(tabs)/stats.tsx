import { StyleSheet, Text, View } from 'react-native'

import { Card, EmptyState, Screen, SectionHeader } from '@/components/ui'
import { statsCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'

const PLACEHOLDERS = [
	{ key: 'books', label: statsCopy.placeholderBooks },
	{ key: 'pages', label: statsCopy.placeholderPages },
	{ key: 'time', label: statsCopy.placeholderTime },
	{ key: 'days', label: statsCopy.placeholderDays },
] as const

/**
 * Statistics tab — layout slots without fake numbers (Phase 7).
 */
export default function StatsScreen () {
	return (
		<Screen scroll>
			<SectionHeader title={statsCopy.title} />
			<View style={styles.body}>
				<EmptyState
					icon="bar-chart-outline"
					title={statsCopy.emptyTitle}
					description={statsCopy.emptyDescription}
				/>
				<View style={styles.grid}>
					{PLACEHOLDERS.map((item) => (
						<Card key={item.key} style={styles.statCard}>
							<Text style={styles.statValue}>{statsCopy.placeholderValue}</Text>
							<Text style={styles.statLabel}>{item.label}</Text>
						</Card>
					))}
				</View>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	body: {
		gap: spacing.md,
		paddingVertical: spacing.md,
	},
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.sm,
	},
	statCard: {
		width: '47%',
		flexGrow: 1,
		alignItems: 'center',
		paddingVertical: spacing.lg,
		borderRadius: radii.lg,
	},
	statValue: {
		...typography.title,
		color: colors.muted,
		fontSize: 24,
		lineHeight: 30,
	},
	statLabel: {
		...typography.bodySmall,
		color: colors.textSecondary,
		marginTop: spacing.xxs,
		textAlign: 'center',
	},
})
