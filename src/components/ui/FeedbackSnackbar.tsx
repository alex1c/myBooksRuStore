/**
 * Lightweight feedback bar for non-blocking success/status messages.
 */

import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'

interface FeedbackSnackbarProps {
	message: string
	actionLabel?: string
	onAction?: () => void
	onDismiss?: () => void
	/** Auto-hide after ms (default 4000). Pass 0 to keep until dismiss. */
	durationMs?: number
}

/**
 * Non-blocking snackbar — prefer over Alert for ordinary success feedback.
 */
export function FeedbackSnackbar ({
	message,
	actionLabel,
	onAction,
	onDismiss,
	durationMs = 4000,
}: FeedbackSnackbarProps) {
	useEffect(() => {
		if (!durationMs || !onDismiss) {
			return
		}
		const timer = setTimeout(onDismiss, durationMs)
		return () => clearTimeout(timer)
	}, [durationMs, onDismiss, message])

	return (
		<View style={styles.bar} accessibilityLiveRegion="polite">
			<Text style={styles.message} numberOfLines={2}>
				{message}
			</Text>
			{actionLabel && onAction ? (
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
			) : null}
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
