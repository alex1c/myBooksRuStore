/**
 * Reading reminders settings — local weekly schedules (Phase 12).
 */

import { useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
	Alert,
	Pressable,
	StyleSheet,
	Switch,
	Text,
	View,
} from 'react-native'

import {
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
	TextField,
} from '@/components/ui'
import { remindersCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { getAppSettings } from '@/db/repositories/settings'
import {
	getNotificationsAdapter,
} from '@/domain/reminders/notificationsAdapter'
import {
	reconcileReadingReminders,
	saveReadingReminders,
} from '@/domain/reminders/readingReminderService'
import {
	formatReminderTime,
	parseReminderTime,
} from '@/domain/reminders/reminderValidation'
import {
	ALL_ISO_WEEKDAYS,
	ISO_WEEKDAY_A11Y_RU,
	ISO_WEEKDAY_LABELS_RU,
	type IsoWeekday,
} from '@/domain/reminders/weekdayMapping'

export default function RemindersScreen () {
	const { executor } = useDatabase()
	const [enabled, setEnabled] = useState(false)
	const [time, setTime] = useState('21:00')
	const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7])
	const [permissionBlocked, setPermissionBlocked] = useState(false)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [statusMessage, setStatusMessage] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			let settings = await getAppSettings(executor)
			const adapter = getNotificationsAdapter()
			if (settings.reminderEnabled) {
				try {
					await reconcileReadingReminders(executor, adapter)
					settings = await getAppSettings(executor)
				} catch {
					// Reconciliation is best-effort; screen still loads settings.
				}
			}
			setEnabled(settings.reminderEnabled)
			setTime(settings.reminderTime)
			setWeekdays(settings.reminderWeekdays)
			const permission = await adapter.getPermissionStatus()
			setPermissionBlocked(permission === 'denied')
		} finally {
			setLoading(false)
		}
	}, [executor])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const sortedDays = useMemo(
		() => [...weekdays].sort((a, b) => a - b),
		[weekdays],
	)

	const toggleDay = (day: IsoWeekday) => {
		setStatusMessage(null)
		setWeekdays((prev) =>
			prev.includes(day)
				? prev.filter((d) => d !== day)
				: [...prev, day].sort((a, b) => a - b),
		)
	}

	const adjustTime = (deltaMinutes: number) => {
		const parsed = parseReminderTime(time) ?? { hour: 21, minute: 0 }
		const total = (parsed.hour * 60 + parsed.minute + deltaMinutes + 24 * 60) %
			(24 * 60)
		const hour = Math.floor(total / 60)
		const minute = total % 60
		setTime(formatReminderTime(hour, minute))
		setStatusMessage(null)
	}

	const handleSave = async () => {
		setSaving(true)
		setStatusMessage(null)
		try {
			const result = await saveReadingReminders(executor, {
				enabled,
				time,
				weekdays: sortedDays,
			})
			if (!result.ok) {
				if (result.reason === 'permission') {
					setPermissionBlocked(true)
					setEnabled(false)
					Alert.alert(remindersCopy.permissionDeniedTitle, result.message, [
						{
							text: remindersCopy.openSettings,
							onPress: () => {
								void getNotificationsAdapter().openSystemSettings()
							},
						},
						{ text: remindersCopy.notNow, style: 'cancel' },
					])
				} else {
					Alert.alert(remindersCopy.errorTitle, result.message)
				}
				await load()
				return
			}
			setPermissionBlocked(false)
			setStatusMessage(
				enabled
					? remindersCopy.savedEnabled
					: remindersCopy.savedDisabled,
			)
			await load()
		} finally {
			setSaving(false)
		}
	}

	const handleEnableToggle = (next: boolean) => {
		setStatusMessage(null)
		if (next) {
			Alert.alert(
				remindersCopy.permissionExplainTitle,
				remindersCopy.permissionExplain,
				[
					{ text: remindersCopy.notNow, style: 'cancel' },
					{
						text: remindersCopy.continueEnable,
						onPress: () => {
							setEnabled(true)
							if (weekdays.length === 0) {
								setWeekdays([1, 2, 3, 4, 5, 6, 7])
							}
						},
					},
				],
			)
			return
		}
		setEnabled(false)
	}

	if (loading) {
		return (
			<Screen>
				<Text style={styles.muted}>{remindersCopy.loading}</Text>
			</Screen>
		)
	}

	return (
		<Screen scroll contentStyle={styles.content}>
			<SectionHeader
				title={remindersCopy.title}
				subtitle={remindersCopy.subtitle}
			/>
			<Text style={styles.privacy}>{remindersCopy.privacy}</Text>

			<View style={styles.rowBetween}>
				<Text style={styles.label}>{remindersCopy.enableLabel}</Text>
				<Switch
					value={enabled}
					onValueChange={handleEnableToggle}
					accessibilityLabel={remindersCopy.enableLabel}
				/>
			</View>

			{permissionBlocked ? (
				<View style={styles.blocked}>
					<Text style={styles.blockedText}>
						{remindersCopy.permissionDeniedTitle}
					</Text>
					<SecondaryButton
						label={remindersCopy.openSettings}
						onPress={() => {
							void getNotificationsAdapter().openSystemSettings()
						}}
					/>
				</View>
			) : null}

			{enabled ? (
				<>
					<Text style={styles.section}>{remindersCopy.timeLabel}</Text>
					<View style={styles.timeRow}>
						<Pressable
							onPress={() => adjustTime(-15)}
							accessibilityLabel={remindersCopy.timeMinus}
							style={styles.timeBtn}
						>
							<Text style={styles.timeBtnText}>−15</Text>
						</Pressable>
						<Text
							style={styles.timeDisplay}
							accessibilityLabel={`${remindersCopy.timeLabel}: ${time}`}
						>
							{time}
						</Text>
						<Pressable
							onPress={() => adjustTime(15)}
							accessibilityLabel={remindersCopy.timePlus}
							style={styles.timeBtn}
						>
							<Text style={styles.timeBtnText}>+15</Text>
						</Pressable>
					</View>
					<TextField
						label="Точное время (ЧЧ:ММ)"
						value={time}
						onChangeText={(v) => {
							setTime(v)
							setStatusMessage(null)
						}}
						keyboardType="numbers-and-punctuation"
						maxLength={5}
						accessibilityLabel={remindersCopy.timeLabel}
					/>

					<Text style={styles.section}>{remindersCopy.daysLabel}</Text>
					<View style={styles.days}>
						{ALL_ISO_WEEKDAYS.map((day) => {
							const active = weekdays.includes(day)
							return (
								<Pressable
									key={day}
									onPress={() => toggleDay(day)}
									accessibilityRole="checkbox"
									accessibilityState={{ checked: active }}
									accessibilityLabel={ISO_WEEKDAY_A11Y_RU[day]}
									style={[
										styles.dayChip,
										active && styles.dayChipActive,
									]}
								>
									<Text
										style={[
											styles.dayText,
											active && styles.dayTextActive,
										]}
									>
										{ISO_WEEKDAY_LABELS_RU[day]}
									</Text>
								</Pressable>
							)
						})}
					</View>
				</>
			) : null}

			{statusMessage ? (
				<Text style={styles.status}>{statusMessage}</Text>
			) : null}

			<PrimaryButton
				label={remindersCopy.save}
				onPress={() => {
					void handleSave()
				}}
				loading={saving}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	privacy: {
		...typography.bodySmall,
		color: colors.muted,
	},
	rowBetween: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: spacing.md,
	},
	label: {
		...typography.body,
		color: colors.text,
		flex: 1,
	},
	section: {
		...typography.section,
		color: colors.text,
	},
	timeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
	},
	timeBtn: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.md,
		backgroundColor: colors.surfaceMuted,
	},
	timeBtnText: {
		...typography.body,
		color: colors.text,
	},
	timeDisplay: {
		minWidth: 96,
		textAlign: 'center',
		...typography.title,
		fontSize: 32,
		lineHeight: 38,
		color: colors.text,
	},
	days: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	dayChip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.full,
		borderWidth: 1,
		borderColor: colors.border,
		backgroundColor: colors.surface,
	},
	dayChipActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	dayText: {
		...typography.bodySmall,
		color: colors.text,
	},
	dayTextActive: {
		color: colors.textInverse,
	},
	status: {
		...typography.bodySmall,
		color: colors.primaryDark,
	},
	blocked: {
		gap: spacing.sm,
		padding: spacing.md,
		borderRadius: radii.md,
		backgroundColor: colors.surfaceMuted,
	},
	blockedText: {
		...typography.body,
		color: colors.text,
	},
	muted: {
		...typography.body,
		color: colors.muted,
	},
})
