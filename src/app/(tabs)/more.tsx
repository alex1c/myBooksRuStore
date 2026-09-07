import { router } from 'expo-router'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Card, ListRow, Screen, SectionHeader } from '@/components/ui'
import { moreCopy } from '@/constants/copy'
import { colors, radii, spacing } from '@/constants/theme'

/**
 * More / settings hub — help, backup, export, archive, shelves, reminders.
 */
export default function MoreScreen () {
	return (
		<Screen scroll>
			<SectionHeader title={moreCopy.title} subtitle={moreCopy.subtitle} />
			<Card style={styles.card}>
				<ListRow
					title={moreCopy.help}
					subtitle={moreCopy.helpHint}
					showChevron
					left={
						<Ionicons name="help-circle-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/help')}
					style={styles.firstRow}
				/>
				<ListRow
					title={moreCopy.shelves}
					subtitle={moreCopy.shelvesHint}
					showChevron
					left={
						<Ionicons name="bookmarks-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/shelves')}
				/>
				<ListRow
					title={moreCopy.archive}
					subtitle={moreCopy.archiveHint}
					showChevron
					left={
						<Ionicons name="archive-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/archive')}
				/>
				<ListRow
					title={moreCopy.backup}
					subtitle={moreCopy.backupHint}
					showChevron
					left={
						<Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/backup')}
				/>
				<ListRow
					title={moreCopy.exportData}
					subtitle={moreCopy.exportDataHint}
					showChevron
					left={
						<Ionicons name="download-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/export')}
				/>
				<ListRow
					title={moreCopy.importData}
					subtitle={moreCopy.importDataHint}
					showChevron
					left={
						<Ionicons name="cloud-download-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/import')}
				/>
				<ListRow
					title={moreCopy.reminders}
					subtitle={moreCopy.remindersHint}
					showChevron
					left={
						<Ionicons name="notifications-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/reminders')}
				/>
				<ListRow
					title={moreCopy.about}
					subtitle={moreCopy.aboutHint}
					showChevron
					left={
						<Ionicons name="information-circle-outline" size={22} color={colors.primary} />
					}
					onPress={() => router.push('/about')}
					style={styles.lastRow}
				/>
			</Card>
			<View style={styles.spacer} />
		</Screen>
	)
}

const styles = StyleSheet.create({
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
