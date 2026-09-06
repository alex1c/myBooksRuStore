import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'

import { EmptyState, Screen, SectionHeader } from '@/components/ui'
import { todayCopy } from '@/constants/copy'
import { spacing } from '@/constants/theme'

/**
 * Today tab — empty state until reading progress exists (Phase 4+).
 */
export default function TodayScreen () {
	return (
		<Screen scroll>
			<SectionHeader title={todayCopy.title} />
			<View style={styles.body}>
				<EmptyState
					icon="book-outline"
					title={todayCopy.emptyTitle}
					description={todayCopy.emptyDescription}
					actionLabel={todayCopy.goToLibrary}
					onAction={() => router.push('/(tabs)/library')}
				/>
			</View>
		</Screen>
	)
}

const styles = StyleSheet.create({
	body: {
		flexGrow: 1,
		justifyContent: 'center',
		paddingVertical: spacing.xl,
	},
})
