import { Stack } from 'expo-router'
import { StyleSheet, Text } from 'react-native'

import { Card, Screen } from '@/components/ui'
import { moreCopy } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'

/**
 * About modal — static product description for Phase 1.
 */
export default function AboutScreen () {
	return (
		<>
			<Stack.Screen options={{ title: moreCopy.about }} />
			<Screen scroll>
				<Card style={styles.card}>
					<Text style={styles.title}>{moreCopy.aboutHint}</Text>
					<Text style={styles.body}>{moreCopy.aboutBody}</Text>
				</Card>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	card: {
		marginTop: spacing.md,
		gap: spacing.sm,
	},
	title: {
		...typography.section,
		color: colors.text,
	},
	body: {
		...typography.body,
		color: colors.textSecondary,
	},
})
