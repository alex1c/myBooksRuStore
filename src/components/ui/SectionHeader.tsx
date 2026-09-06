import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

interface SectionHeaderProps {
	title: string
	subtitle?: string
}

/**
 * Screen section title with optional supporting line.
 */
export function SectionHeader ({ title, subtitle }: SectionHeaderProps) {
	return (
		<View style={styles.wrap}>
			<Text style={styles.title} accessibilityRole="header">
				{title}
			</Text>
			{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		gap: spacing.xxs,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	title: {
		...typography.title,
		color: colors.text,
	},
	subtitle: {
		...typography.subtitle,
		color: colors.textSecondary,
	},
})
