import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Card, ListRow, Screen, SectionHeader } from '@/components/ui'
import { searchCopy } from '@/constants/copy'
import { colors, radii, spacing } from '@/constants/theme'

/**
 * Add hub — search is primary; manual and scanner remain available offline-friendly.
 */
export default function AddBookHubScreen () {
	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader title={searchCopy.hubTitle} />
			<Card style={styles.card}>
				<ListRow
					title={searchCopy.hubSearchTitle}
					subtitle={searchCopy.hubSearchHint}
					showChevron
					left={
						<Ionicons name="search-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/books/search')}
					style={styles.firstRow}
				/>
				<ListRow
					title={searchCopy.hubScanTitle}
					subtitle={searchCopy.hubScanHint}
					showChevron
					left={
						<Ionicons name="barcode-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/books/scan')}
				/>
				<ListRow
					title={searchCopy.hubManualTitle}
					subtitle={searchCopy.hubManualHint}
					showChevron
					left={
						<Ionicons name="create-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/books/add/manual')}
					style={styles.lastRow}
				/>
			</Card>
			<View style={styles.spacer} />
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		paddingTop: spacing.sm,
	},
	card: {
		padding: 0,
		overflow: 'hidden',
		borderRadius: radii.lg,
	},
	firstRow: {
		borderTopLeftRadius: radii.lg,
		borderTopRightRadius: radii.lg,
	},
	lastRow: {
		borderBottomWidth: 0,
		borderBottomLeftRadius: radii.lg,
		borderBottomRightRadius: radii.lg,
	},
	spacer: {
		height: spacing.xl,
	},
})
