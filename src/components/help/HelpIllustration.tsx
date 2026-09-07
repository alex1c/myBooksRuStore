/**
 * Decorative UI mocks for onboarding / help — not interactive, not real data.
 */

import { StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing, typography } from '@/constants/theme'

type MockKind = 'library' | 'today' | 'notes' | 'progress' | 'quickProgress' | 'startReading' | 'statuses'

interface HelpIllustrationProps {
	kind: MockKind
}

export function HelpIllustration ({ kind }: HelpIllustrationProps) {
	if (kind === 'library' || kind === 'statuses') {
		return (
			<View
				style={styles.card}
				accessible
				accessibilityLabel="Пример статусов книг: Хочу прочитать, Читаю, Прочитано"
			>
				{['Хочу прочитать', 'Читаю', 'Прочитано'].map((label) => (
					<View key={label} style={styles.chip}>
						<Text style={styles.chipLabel}>{label}</Text>
					</View>
				))}
			</View>
		)
	}

	if (kind === 'today' || kind === 'quickProgress') {
		return (
			<View
				style={styles.card}
				accessible
				accessibilityLabel="Пример быстрых кнопок прогресса: плюс один, плюс десять, плюс двадцать пять"
			>
				<View style={styles.row}>
					{['+1', '+10', '+25'].map((label) => (
						<View key={label} style={styles.chipStrong}>
							<Text style={styles.chipStrongLabel}>{label}</Text>
						</View>
					))}
				</View>
				{kind === 'today' ? (
					<View style={styles.primaryFake}>
						<Text style={styles.primaryFakeLabel}>Начать чтение</Text>
					</View>
				) : null}
			</View>
		)
	}

	if (kind === 'startReading') {
		return (
			<View
				style={styles.card}
				accessible
				accessibilityLabel="Пример кнопки Начать чтение"
			>
				<View style={styles.primaryFake}>
					<Text style={styles.primaryFakeLabel}>Начать чтение</Text>
				</View>
			</View>
		)
	}

	if (kind === 'notes') {
		return (
			<View
				style={styles.card}
				accessible
				accessibilityLabel="Пример типов записей: цитата, мысль, заметка"
			>
				<View style={styles.row}>
					{['Цитата', 'Мысль', 'Заметка'].map((label) => (
						<View key={label} style={styles.chip}>
							<Text style={styles.chipLabel}>{label}</Text>
						</View>
					))}
				</View>
			</View>
		)
	}

	// progress
	return (
		<View
			style={styles.card}
			accessible
			accessibilityLabel="Пример разделов прогресса: цели, статистика, год в книгах"
		>
			{['Цели', 'Статистика', 'Мой год в книгах'].map((label) => (
				<Text key={label} style={styles.listLine}>
					• {label}
				</Text>
			))}
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		gap: spacing.sm,
		padding: spacing.md,
		borderRadius: radii.lg,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
		minHeight: 40,
		justifyContent: 'center',
	},
	chipLabel: {
		...typography.bodySmall,
		color: colors.textSecondary,
		fontWeight: '600',
	},
	chipStrong: {
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
		borderRadius: radii.md,
		backgroundColor: colors.primarySoft,
		borderWidth: 1,
		borderColor: colors.primary,
		minHeight: 44,
		justifyContent: 'center',
	},
	chipStrongLabel: {
		...typography.body,
		color: colors.primaryDark,
		fontWeight: '700',
	},
	primaryFake: {
		minHeight: 48,
		borderRadius: radii.md,
		backgroundColor: colors.primary,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: spacing.lg,
	},
	primaryFakeLabel: {
		...typography.button,
		color: colors.textInverse,
	},
	listLine: {
		...typography.body,
		color: colors.text,
	},
})
