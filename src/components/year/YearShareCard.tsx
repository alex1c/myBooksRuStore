/**
 * Final Year in Books share card — summary only, no private content / ads.
 */

import { forwardRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'
import type { YearShareCardModel } from '@/domain/yearInBooksService'

interface YearShareCardProps {
	model: YearShareCardModel
}

/**
 * Portrait 4:5-ish card rendered for on-screen preview and view-shot capture.
 */
export const YearShareCard = forwardRef<View, YearShareCardProps>(
	function YearShareCard ({ model }, ref) {
		return (
			<View
				ref={ref}
				collapsable={false}
				style={styles.card}
				accessibilityLabel={`${model.title}. ${model.lines.map((l) => l.value).join('. ')}. ${model.brand}`}
			>
				<Text style={styles.title}>{model.title}</Text>
				<View style={styles.lines}>
					{model.lines.map((line) => (
						<View key={line.label} style={styles.line}>
							<Text style={styles.value}>{line.value}</Text>
							<Text style={styles.label}>{line.label}</Text>
						</View>
					))}
				</View>
				<Text style={styles.brand}>{model.brand}</Text>
			</View>
		)
	},
)

const styles = StyleSheet.create({
	card: {
		width: '100%',
		aspectRatio: 4 / 5,
		maxWidth: 360,
		alignSelf: 'center',
		backgroundColor: colors.primaryDark,
		borderRadius: radii.lg,
		padding: spacing.lg,
		justifyContent: 'space-between',
	},
	title: {
		...typography.title,
		fontSize: 28,
		color: colors.textInverse,
	},
	lines: {
		gap: spacing.md,
	},
	line: {
		gap: 2,
	},
	value: {
		...typography.title,
		fontSize: 26,
		color: colors.textInverse,
	},
	label: {
		...typography.caption,
		color: 'rgba(255,255,255,0.72)',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	brand: {
		...typography.bodySmall,
		color: 'rgba(255,255,255,0.85)',
		fontWeight: '600',
	},
})
