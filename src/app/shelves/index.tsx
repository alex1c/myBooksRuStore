import { Stack, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import {
	Alert,
	FlatList,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import {
	EmptyState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
	TextField,
} from '@/components/ui'
import { appCopy, shelvesCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	archiveShelf,
	createShelf,
	listActiveShelves,
	renameShelf,
} from '@/db/repositories'
import type { Shelf } from '@/db/types'

/**
 * User shelves management — create, rename, soft-archive.
 */
export default function ShelvesScreen () {
	const { executor } = useDatabase()
	const [shelves, setShelves] = useState<Shelf[]>([])
	const [name, setName] = useState('')
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editingName, setEditingName] = useState('')

	const load = useCallback(async () => {
		setShelves(await listActiveShelves(executor))
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const handleCreate = async () => {
		try {
			await createShelf(executor, name)
			setName('')
			await load()
		} catch {
			Alert.alert(shelvesCopy.nameLabel, 'Укажите название полки')
		}
	}

	const handleRename = async (id: string) => {
		try {
			await renameShelf(executor, id, editingName)
			setEditingId(null)
			setEditingName('')
			await load()
		} catch {
			Alert.alert(shelvesCopy.nameLabel, 'Укажите название полки')
		}
	}

	const handleArchive = (shelf: Shelf) => {
		Alert.alert(shelvesCopy.archiveConfirmTitle, shelvesCopy.archiveConfirmMessage, [
			{ text: appCopy.cancel, style: 'cancel' },
			{
				text: shelvesCopy.archive,
				style: 'destructive',
				onPress: () => {
					void (async () => {
						await archiveShelf(executor, shelf.id)
						await load()
					})()
				},
			},
		])
	}

	return (
		<>
			<Stack.Screen options={{ title: shelvesCopy.title, headerShown: true }} />
			<Screen scroll keyboardAvoiding contentStyle={styles.content}>
				<SectionHeader
					title={shelvesCopy.title}
					subtitle={shelvesCopy.emptyDescription}
				/>

				<View style={styles.createRow}>
					<View style={styles.flex}>
						<TextField
							label={shelvesCopy.nameLabel}
							placeholder={shelvesCopy.namePlaceholder}
							value={name}
							onChangeText={setName}
						/>
					</View>
					<PrimaryButton
						label={shelvesCopy.create}
						onPress={() => {
							void handleCreate()
						}}
						style={styles.createButton}
					/>
				</View>

				{shelves.length === 0 ? (
					<EmptyState
						icon="bookmarks-outline"
						title={shelvesCopy.emptyTitle}
						description={shelvesCopy.emptyDescription}
					/>
				) : (
					<FlatList
						data={shelves}
						keyExtractor={(item) => item.id}
						scrollEnabled={false}
						renderItem={({ item }) => (
							<View style={styles.card}>
								{editingId === item.id ? (
									<>
										<TextField
											label={shelvesCopy.rename}
											value={editingName}
											onChangeText={setEditingName}
										/>
										<PrimaryButton
											label={appCopy.save}
											onPress={() => {
												void handleRename(item.id)
											}}
										/>
										<SecondaryButton
											label={appCopy.cancel}
											onPress={() => {
												setEditingId(null)
												setEditingName('')
											}}
										/>
									</>
								) : (
									<>
										<Text style={styles.name}>{item.name}</Text>
										<View style={styles.actions}>
											<SecondaryButton
												label={shelvesCopy.rename}
												onPress={() => {
													setEditingId(item.id)
													setEditingName(item.name)
												}}
												style={styles.actionBtn}
											/>
											<SecondaryButton
												label={shelvesCopy.archive}
												onPress={() => handleArchive(item)}
												style={styles.actionBtn}
											/>
										</View>
									</>
								)}
							</View>
						)}
					/>
				)}
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	createRow: {
		gap: spacing.sm,
	},
	flex: {
		flex: 1,
	},
	createButton: {
		alignSelf: 'stretch',
	},
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.md,
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	name: {
		...typography.section,
		color: colors.text,
	},
	actions: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	actionBtn: {
		flexGrow: 1,
	},
})
