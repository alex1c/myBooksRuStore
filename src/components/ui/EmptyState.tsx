import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, spacing, typography } from '@/constants/theme'
import { Card } from './Card'
import { PrimaryButton } from './PrimaryButton'
import { SecondaryButton } from './SecondaryButton'

interface EmptyStateProps {
	title: string
	description?: string
	icon?: keyof typeof Ionicons.glyphMap
	actionLabel?: string
	onAction?: () => void
	actionDisabled?: boolean
	secondaryActionLabel?: string
	onSecondaryAction?: () => void
}

/**
 * Friendly empty placeholder for unfinished or empty feature areas.
 */
export function EmptyState ({
	title,
	description,
	icon = 'book-outline',
	actionLabel,
	onAction,
	actionDisabled = false,
	secondaryActionLabel,
	onSecondaryAction,
}: EmptyStateProps) {
	return (
		<Card style={styles.card}>
			<View style={styles.iconWrap} accessibilityElementsHidden>
				<Ionicons name={icon} size={36} color={colors.primary} />
			</View>
			<Text style={styles.title}>{title}</Text>
			{description ? (
				<Text style={styles.description}>{description}</Text>
			) : null}
			{actionLabel && onAction ? (
				<PrimaryButton
					label={actionLabel}
					onPress={onAction}
					disabled={actionDisabled}
					style={styles.button}
				/>
			) : null}
			{secondaryActionLabel && onSecondaryAction ? (
				<SecondaryButton
					label={secondaryActionLabel}
					onPress={onSecondaryAction}
					style={styles.button}
				/>
			) : null}
		</Card>
	)
}

const styles = StyleSheet.create({
	card: {
		alignItems: 'center',
		gap: spacing.sm,
		paddingVertical: spacing.xl,
		paddingHorizontal: spacing.lg,
	},
	iconWrap: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.primarySoft,
		marginBottom: spacing.xs,
	},
	title: {
		...typography.section,
		textAlign: 'center',
		color: colors.text,
	},
	description: {
		...typography.bodySmall,
		textAlign: 'center',
		color: colors.textSecondary,
	},
	button: {
		alignSelf: 'stretch',
		marginTop: spacing.xs,
	},
})
