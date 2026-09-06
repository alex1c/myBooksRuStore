import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useState } from 'react'

import { PrimaryButton, SecondaryButton, TextField } from '@/components/ui'
import { appCopy, sessionCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import type { LibraryEntry } from '@/db/types'
import {
	hoursMinutesToSeconds,
	secondsToHoursMinutes,
} from '@/utils/progress'

interface ExactProgressModalProps {
	visible: boolean
	entry: LibraryEntry
	onClose: () => void
	onSubmit: (value: {
		kind: 'setPages' | 'setPercent' | 'setAudioSeconds'
		page?: number
		percent?: number
		seconds?: number
	}) => void
	error?: string | null
}

/**
 * Compact exact-progress sheet — pages / percent / audio position.
 * Remount with a fresh `key` when opening so fields match current entry.
 */
export function ExactProgressModal ({
	visible,
	entry,
	onClose,
	onSubmit,
	error,
}: ExactProgressModalProps) {
	const initialHm = secondsToHoursMinutes(entry.audioPositionSeconds)
	const [page, setPage] = useState(String(entry.currentPage ?? ''))
	const [percent, setPercent] = useState(
		String(entry.currentPercent != null ? Math.round(entry.currentPercent) : ''),
	)
	const [hours, setHours] = useState(String(initialHm.hours || ''))
	const [minutes, setMinutes] = useState(String(initialHm.minutes || ''))

	const handleSave = () => {
		if (entry.progressMode === 'PAGES') {
			const value = Number.parseInt(page, 10)
			onSubmit({ kind: 'setPages', page: value })
			return
		}
		if (entry.progressMode === 'PERCENT') {
			const value = Number.parseFloat(percent)
			onSubmit({ kind: 'setPercent', percent: value })
			return
		}
		const h = Number.parseInt(hours || '0', 10)
		const m = Number.parseInt(minutes || '0', 10)
		onSubmit({
			kind: 'setAudioSeconds',
			seconds: hoursMinutesToSeconds(h, m),
		})
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={onClose}
		>
			<Pressable style={styles.overlay} onPress={onClose}>
				<Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
					<Text style={styles.title}>{sessionCopy.exactTitle}</Text>
					{entry.progressMode === 'PAGES' ? (
						<TextField
							label={sessionCopy.pageLabel}
							value={page}
							onChangeText={setPage}
							keyboardType="number-pad"
							error={error ?? undefined}
						/>
					) : null}
					{entry.progressMode === 'PERCENT' ? (
						<TextField
							label={sessionCopy.percentLabel}
							value={percent}
							onChangeText={setPercent}
							keyboardType="decimal-pad"
							error={error ?? undefined}
						/>
					) : null}
					{entry.progressMode === 'TIME' ? (
						<View style={styles.row}>
							<View style={styles.flex}>
								<TextField
									label={sessionCopy.hoursLabel}
									value={hours}
									onChangeText={setHours}
									keyboardType="number-pad"
								/>
							</View>
							<View style={styles.flex}>
								<TextField
									label={sessionCopy.minutesLabel}
									value={minutes}
									onChangeText={setMinutes}
									keyboardType="number-pad"
									error={error ?? undefined}
								/>
							</View>
						</View>
					) : null}
					<View style={styles.actions}>
						<SecondaryButton label={appCopy.cancel} onPress={onClose} />
						<PrimaryButton label={appCopy.save} onPress={handleSave} />
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	)
}

const styles = StyleSheet.create({
	overlay: {
		flex: 1,
		backgroundColor: colors.overlay,
		justifyContent: 'flex-end',
	},
	sheet: {
		backgroundColor: colors.surface,
		borderTopLeftRadius: radii.xl,
		borderTopRightRadius: radii.xl,
		padding: spacing.lg,
		gap: spacing.md,
	},
	title: {
		...typography.section,
		color: colors.text,
	},
	row: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	flex: {
		flex: 1,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.sm,
		marginTop: spacing.xs,
	},
})
