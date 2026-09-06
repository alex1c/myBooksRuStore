import { Link, Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

/**
 * Fallback for unknown routes (typed routes / deep links).
 */
export default function NotFoundScreen () {
	return (
		<>
			<Stack.Screen options={{ title: 'Не найдено' }} />
			<View style={styles.container}>
				<Text style={styles.title}>Экран не найден</Text>
				<Link href="/" style={styles.link}>
					Вернуться на главную
				</Link>
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: spacing.lg,
		backgroundColor: colors.background,
		gap: spacing.md,
	},
	title: {
		...typography.section,
		color: colors.text,
	},
	link: {
		...typography.body,
		color: colors.primary,
		paddingVertical: spacing.sm,
	},
})
