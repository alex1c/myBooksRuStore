import { router } from 'expo-router'
import { Alert, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Card, ListRow, Screen, SectionHeader } from '@/components/ui'
import { appCopy, moreCopy } from '@/constants/copy'
import { colors, radii, spacing } from '@/constants/theme'

/**
 * More / settings-style hub. Backup and reminders are stubs only.
 */
export default function MoreScreen () {
	const handleComingSoon = (subtitle: string) => {
		Alert.alert(appCopy.comingSoonTitle, subtitle)
	}

	return (
		<Screen scroll>
			<SectionHeader title={moreCopy.title} subtitle={moreCopy.subtitle} />
			<Card style={styles.card}>
				<ListRow
					title={moreCopy.backup}
					subtitle={moreCopy.backupHint}
					showChevron
					left={
						<Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
					}
					onPress={() => handleComingSoon(moreCopy.backupHint)}
					style={styles.firstRow}
				/>
				<ListRow
					title={moreCopy.reminders}
					subtitle={moreCopy.remindersHint}
					showChevron
					left={
						<Ionicons name="notifications-outline" size={22} color={colors.primary} />
					}
					onPress={() => handleComingSoon(moreCopy.remindersHint)}
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
