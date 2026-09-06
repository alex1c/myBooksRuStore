import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, touchTarget, typography } from '@/constants/theme'

export interface ChipOption<T extends string> {
	value: T
	label: string
}

interface ChipScrollerProps<T extends string> {
	options: ChipOption<T>[]
	value: T
	onChange: (value: T) => void
	accessibilityLabel?: string
}

/**
 * Horizontal status / filter chips sized for narrow Android screens.
 */
export function ChipScroller<T extends string> ({
	options,
	value,
	onChange,
	accessibilityLabel,
}: ChipScrollerProps<T>) {
	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
			accessibilityLabel={accessibilityLabel}
		>
			{options.map((option) => {
				const selected = option.value === value
				return (
					<Pressable
						key={option.value}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						accessibilityLabel={option.label}
						onPress={() => onChange(option.value)}
						style={[styles.chip, selected && styles.chipSelected]}
					>
						<Text style={[styles.label, selected && styles.labelSelected]}>
							{option.label}
						</Text>
					</Pressable>
				)
			})}
		</ScrollView>
	)
}

interface ChoiceGroupProps<T extends string> {
	label: string
	options: ChipOption<T>[]
	value: T
	onChange: (value: T) => void
}

/** Wrapped choice chips for forms (format / status / progress mode). */
export function ChoiceGroup<T extends string> ({
	label,
	options,
	value,
	onChange,
}: ChoiceGroupProps<T>) {
	return (
		<View style={styles.group}>
			{label ? <Text style={styles.groupLabel}>{label}</Text> : null}
			<View style={styles.wrap}>
				{options.map((option) => {
					const selected = option.value === value
					return (
						<Pressable
							key={option.value}
							accessibilityRole="button"
							accessibilityState={{ selected }}
							accessibilityLabel={option.label}
							onPress={() => onChange(option.value)}
							style={[styles.choice, selected && styles.chipSelected]}
						>
							<Text style={[styles.label, selected && styles.labelSelected]}>
								{option.label}
							</Text>
						</Pressable>
					)
				})}
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		gap: spacing.xs,
		paddingVertical: spacing.xs,
		paddingRight: spacing.md,
	},
	chip: {
		minHeight: touchTarget.min - 8,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		justifyContent: 'center',
	},
	choice: {
		minHeight: touchTarget.min - 4,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		justifyContent: 'center',
		marginBottom: spacing.xs,
		marginRight: spacing.xs,
	},
	chipSelected: {
		backgroundColor: colors.primarySoft,
		borderColor: colors.primary,
	},
	label: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	labelSelected: {
		color: colors.primaryDark,
	},
	group: {
		gap: spacing.xs,
	},
	groupLabel: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	wrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
	},
})
