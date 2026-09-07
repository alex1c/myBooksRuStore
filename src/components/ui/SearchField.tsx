/**
 * Clearable search field with Android-friendly clear control and Search return key.
 */

import { Ionicons } from '@expo/vector-icons'
import {
	Pressable,
	StyleSheet,
	TextInput,
	TextInputProps,
	View,
} from 'react-native'

import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'

interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
	value: string
	onChangeText: (text: string) => void
	onSubmitEditing?: () => void
	accessibilityLabel?: string
}

/**
 * Search input with always-available clear (×) when non-empty.
 */
export function SearchField ({
	value,
	onChangeText,
	onSubmitEditing,
	accessibilityLabel,
	placeholder,
	...rest
}: SearchFieldProps) {
	return (
		<View style={styles.wrap}>
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={colors.muted}
				accessibilityLabel={accessibilityLabel ?? placeholder ?? 'Поиск'}
				returnKeyType="search"
				onSubmitEditing={onSubmitEditing}
				autoCapitalize="none"
				autoCorrect={false}
				style={styles.input}
				{...rest}
			/>
			{value.length > 0 ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Очистить поиск"
					hitSlop={8}
					onPress={() => onChangeText('')}
					style={styles.clear}
				>
					<Ionicons name="close-circle" size={20} color={colors.muted} />
				</Pressable>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		position: 'relative',
		justifyContent: 'center',
	},
	input: {
		minHeight: touchTarget.min,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: radii.md,
		paddingHorizontal: spacing.md,
		paddingRight: spacing.xl + spacing.sm,
		paddingVertical: spacing.sm,
		backgroundColor: colors.surface,
		color: colors.text,
		fontSize: typography.body.fontSize,
	},
	clear: {
		position: 'absolute',
		right: spacing.sm,
		minWidth: touchTarget.min - 8,
		minHeight: touchTarget.min - 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
})
