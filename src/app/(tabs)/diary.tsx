import { StyleSheet, View } from 'react-native'

import { EmptyState, Screen, SectionHeader } from '@/components/ui'
import { diaryCopy } from '@/constants/copy'
import { spacing } from '@/constants/theme'

/**
 * Diary tab — placeholder for sessions, quotes, and notes (Phase 5).
 */
export default function DiaryScreen () {
	return (
		<Screen scroll>
			<SectionHeader title={diaryCopy.title} />
			<View style={styles.body}>
				<EmptyState
					icon="journal-outline"
					title={diaryCopy.emptyTitle}
					description={diaryCopy.emptyDescription}
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
