import { Alert, StyleSheet, View } from 'react-native'

import { EmptyState, Screen, SectionHeader } from '@/components/ui'
import { appCopy, libraryCopy } from '@/constants/copy'
import { spacing } from '@/constants/theme'

/**
 * Library tab — empty state; add-book CRUD arrives in Phase 2.
 * Button is intentionally disabled (no fake persistence).
 */
export default function LibraryScreen () {
	const handleAddBook = () => {
		Alert.alert(appCopy.comingSoonTitle, libraryCopy.addBookHint)
	}

	return (
		<Screen scroll>
			<SectionHeader title={libraryCopy.title} />
			<View style={styles.body}>
				<EmptyState
					icon="library-outline"
					title={libraryCopy.emptyTitle}
					description={libraryCopy.emptyDescription}
					actionLabel={libraryCopy.addBook}
					onAction={handleAddBook}
					actionDisabled
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
