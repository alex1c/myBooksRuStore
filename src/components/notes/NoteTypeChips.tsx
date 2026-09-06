import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { NoteType } from '@/constants/domain'
import { noteTypeLabels } from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'

const TYPES: NoteType[] = ['QUOTE', 'THOUGHT', 'NOTE']

interface NoteTypeChipsProps {
	value: NoteType
	onChange: (type: NoteType) => void
}

/**
 * Compact type selector for quote / thought / note.
 */
export function NoteTypeChips ({ value, onChange }: NoteTypeChipsProps) {
	return (
		<View style={styles.row}>
			{TYPES.map((type) => {
				const selected = type === value
				return (
					<Pressable
						key={type}
						accessibilityRole="button"
						accessibilityState={{ selected }}
						onPress={() => onChange(type)}
						style={[styles.chip, selected ? styles.chipSelected : null]}
					>
						<Text
							style={[
								styles.label,
								selected ? styles.labelSelected : null,
							]}
						>
							{noteTypeLabels[type]}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.sm,
		backgroundColor: colors.surfaceMuted,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		minHeight: 36,
		justifyContent: 'center',
	},
	chipSelected: {
		backgroundColor: colors.primarySoft,
		borderColor: colors.primary,
	},
	label: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.textSecondary,
	},
	labelSelected: {
		color: colors.primaryDark,
	},
})
