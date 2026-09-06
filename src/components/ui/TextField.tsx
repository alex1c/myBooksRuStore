import {
	StyleSheet,
	Text,
	TextInput,
	TextInputProps,
	View,
} from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'

interface TextFieldProps extends TextInputProps {
	label: string
	error?: string
}

/**
 * Labeled text field prepared for future forms (keyboard + scroll friendly).
 */
export function TextField ({
	label,
	error,
	style,
	...rest
}: TextFieldProps) {
	return (
		<View style={styles.wrap}>
			<Text style={styles.label}>{label}</Text>
			<TextInput
				accessibilityLabel={label}
				placeholderTextColor={colors.muted}
				style={[styles.input, error ? styles.inputError : null, style]}
				{...rest}
			/>
			{error ? <Text style={styles.error}>{error}</Text> : null}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		gap: spacing.xxs,
	},
	label: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	input: {
		minHeight: 48,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		backgroundColor: colors.surface,
		color: colors.text,
		fontSize: typography.body.fontSize,
	},
	inputError: {
		borderColor: colors.danger,
	},
	error: {
		...typography.caption,
		color: colors.danger,
	},
})
