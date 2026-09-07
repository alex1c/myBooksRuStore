/**
 * Low-emphasis destructive action (archive / delete) — never next to primary CTAs.
 */

import {
	Pressable,
	StyleSheet,
	Text,
	ViewStyle,
	StyleProp,
} from 'react-native'

import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'

interface DestructiveButtonProps {
	label: string
	onPress: () => void
	disabled?: boolean
	style?: StyleProp<ViewStyle>
	accessibilityLabel?: string
}

export function DestructiveButton ({
	label,
	onPress,
	disabled = false,
	style,
	accessibilityLabel,
}: DestructiveButtonProps) {
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.button,
				pressed && !disabled ? styles.pressed : null,
				disabled ? styles.disabled : null,
				style,
			]}
		>
			<Text style={styles.label}>{label}</Text>
		</Pressable>
	)
}

const styles = StyleSheet.create({
	button: {
		minHeight: touchTarget.min,
		borderRadius: radii.md,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
		backgroundColor: 'transparent',
	},
	pressed: {
		backgroundColor: colors.surfaceMuted,
	},
	disabled: {
		opacity: 0.5,
	},
	label: {
		...typography.button,
		color: colors.danger,
		fontWeight: '600',
	},
})
