/**
 * Dismissible one-time tip strip.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'

interface MicroHintBannerProps {
	message: string
	dismissLabel?: string
	onDismiss: () => void
}

export function MicroHintBanner ({
	message,
	dismissLabel = 'Понятно',
	onDismiss,
}: MicroHintBannerProps) {
	return (
		<View style={styles.wrap} accessibilityLiveRegion="polite">
			<Text style={styles.message}>{message}</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={dismissLabel}
				onPress={onDismiss}
				hitSlop={8}
				style={styles.button}
			>
				<Text style={styles.buttonLabel}>{dismissLabel}</Text>
			</Pressable>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		padding: spacing.sm,
		marginBottom: spacing.sm,
		borderRadius: radii.md,
		backgroundColor: colors.primarySoft,
		borderWidth: 1,
		borderColor: colors.primary,
	},
	message: {
		...typography.bodySmall,
		color: colors.primaryDark,
		flex: 1,
	},
	button: {
		minHeight: 44,
		justifyContent: 'center',
		paddingHorizontal: spacing.xs,
	},
	buttonLabel: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primary,
	},
})
