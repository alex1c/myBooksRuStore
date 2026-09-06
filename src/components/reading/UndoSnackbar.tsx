import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'

interface UndoSnackbarProps {
	message: string
	actionLabel: string
	onAction: () => void
	onDismiss?: () => void
}

/**
 * Lightweight snackbar for quick-progress feedback + undo.
 * Not a blocking modal — sits above tab content.
 */
export function UndoSnackbar ({
	message,
	actionLabel,
	onAction,
	onDismiss,
}: UndoSnackbarProps) {
	return (
		<View style={styles.bar} accessibilityLiveRegion="polite">
			<Text style={styles.message} numberOfLines={2}>
				{message}
			</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={actionLabel}
				onPress={onAction}
				style={({ pressed }) => [
					styles.action,
					pressed ? styles.actionPressed : null,
				]}
			>
				<Text style={styles.actionLabel}>{actionLabel}</Text>
			</Pressable>
			{onDismiss ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Закрыть"
					onPress={onDismiss}
					hitSlop={8}
				>
					<Text style={styles.dismiss}>×</Text>
				</Pressable>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.text,
		borderRadius: radii.md,
	},
	message: {
		...typography.bodySmall,
		color: colors.textInverse,
		flex: 1,
	},
	action: {
		paddingHorizontal: spacing.xs,
		paddingVertical: spacing.xxs,
	},
	actionPressed: {
		opacity: 0.7,
	},
	actionLabel: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primarySoft,
	},
	dismiss: {
		...typography.section,
		color: colors.muted,
		paddingHorizontal: spacing.xxs,
	},
})
