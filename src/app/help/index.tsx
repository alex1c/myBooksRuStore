/**
 * Permanent help home — section list.
 */

import { router, Stack } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Card, ListRow, Screen, SectionHeader } from '@/components/ui'
import { helpCopy } from '@/constants/copy'
import { colors, radii, spacing } from '@/constants/theme'
import { HELP_SECTIONS } from '@/domain/help/helpCatalog'

export default function HelpHomeScreen () {
	return (
		<>
			<Stack.Screen
				options={{ headerShown: true, title: helpCopy.title }}
			/>
			<Screen scroll contentStyle={styles.content}>
				<SectionHeader
					title={helpCopy.title}
					subtitle={helpCopy.subtitle}
				/>
				<Card style={styles.card}>
					{HELP_SECTIONS.map((section, index) => (
						<ListRow
							key={section.id}
							title={section.title}
							subtitle={section.subtitle}
							showChevron
							left={
								<Ionicons
									name="book-outline"
									size={20}
									color={colors.primary}
								/>
							}
							onPress={() =>
								router.push(`/help/${section.id}`)
							}
							style={[
								index === 0 ? styles.first : null,
								index === HELP_SECTIONS.length - 1
									? styles.last
									: null,
							]}
							accessibilityLabel={`${section.title}. ${section.subtitle}`}
						/>
					))}
				</Card>
				<View style={styles.spacer} />
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.sm,
	},
	card: {
		padding: 0,
		overflow: 'hidden',
		borderRadius: radii.lg,
	},
	first: {
		borderTopLeftRadius: radii.lg,
		borderTopRightRadius: radii.lg,
	},
	last: {
		borderBottomWidth: 0,
		borderBottomLeftRadius: radii.lg,
		borderBottomRightRadius: radii.lg,
	},
	spacer: {
		height: spacing.xl,
	},
})
