import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import {
	PrimaryButton,
	Screen,
	SecondaryButton,
	TextField,
} from '@/components/ui'
import { appCopy, statsCopy } from '@/constants/copy'
import type { GoalPeriod, GoalType } from '@/constants/domain'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	createGoal,
	editGoal,
	findSimilarActiveGoal,
} from '@/domain/goalsService'
import { getReadingGoalById } from '@/db/repositories/readingGoals'

const TYPES: { key: GoalType; label: string }[] = [
	{ key: 'PAGES', label: statsCopy.goalPages },
	{ key: 'MINUTES', label: statsCopy.goalMinutes },
	{ key: 'BOOKS', label: statsCopy.goalBooks },
]

const PERIODS: { key: GoalPeriod; label: string }[] = [
	{ key: 'DAY', label: statsCopy.periodDay },
	{ key: 'WEEK', label: statsCopy.periodWeek },
	{ key: 'MONTH', label: statsCopy.periodMonth },
	{ key: 'YEAR', label: statsCopy.periodYear },
]

function presetDefaults (preset?: string): {
	type: GoalType
	period: GoalPeriod
	target: string
} {
	if (preset === 'minutes') {
		return { type: 'MINUTES', period: 'DAY', target: '30' }
	}
	if (preset === 'books') {
		return { type: 'BOOKS', period: 'YEAR', target: '12' }
	}
	if (preset === 'pages') {
		return { type: 'PAGES', period: 'DAY', target: '20' }
	}
	return { type: 'PAGES', period: 'DAY', target: '20' }
}

/**
 * Create or edit a reading goal.
 */
export default function GoalFormScreen () {
	const { id, preset } = useLocalSearchParams<{
		id?: string
		preset?: string
	}>()
	const { executor } = useDatabase()
	const defaults = useMemo(() => presetDefaults(preset), [preset])
	const [type, setType] = useState<GoalType>(defaults.type)
	const [period, setPeriod] = useState<GoalPeriod>(defaults.period)
	const [target, setTarget] = useState(defaults.target)
	const [error, setError] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [loadedEdit, setLoadedEdit] = useState(!id)

	const loadEdit = useCallback(async () => {
		if (!id) {
			setLoadedEdit(true)
			return
		}
		const goal = await getReadingGoalById(executor, id)
		if (goal) {
			setType(goal.type)
			setPeriod(goal.period)
			setTarget(String(goal.targetValue))
		}
		setLoadedEdit(true)
	}, [executor, id])

	useFocusEffect(
		useCallback(() => {
			void loadEdit()
		}, [loadEdit]),
	)

	const save = async (force = false) => {
		setError(null)
		const value = Number.parseInt(target, 10)
		if (!Number.isInteger(value) || value <= 0) {
			setError('Укажите целое число больше 0')
			return
		}
		setSaving(true)
		try {
			if (!id && !force) {
				const similar = await findSimilarActiveGoal(
					executor,
					type,
					period,
					value,
				)
				if (similar) {
					Alert.alert(
						statsCopy.duplicateGoalTitle,
						statsCopy.duplicateGoalMessage,
						[
							{ text: appCopy.cancel, style: 'cancel' },
							{
								text: statsCopy.duplicateCreate,
								onPress: () => void save(true),
							},
						],
					)
					return
				}
			}

			if (id) {
				await editGoal(executor, id, {
					type,
					period,
					targetValue: value,
				})
			} else {
				await createGoal(executor, {
					type,
					period,
					targetValue: value,
				})
			}
			router.back()
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Не удалось сохранить'
			setError(message.replace(/^INVALID_GOAL_COMBO:/, ''))
		} finally {
			setSaving(false)
		}
	}

	if (!loadedEdit) {
		return null
	}

	return (
		<>
			<Stack.Screen
				options={{
					title: id ? statsCopy.editGoal : statsCopy.createGoal,
					headerShown: true,
				}}
			/>
			<Screen scroll keyboardAvoiding contentStyle={styles.content}>
				<Text style={styles.label}>{statsCopy.goalType}</Text>
				<View style={styles.chips}>
					{TYPES.map((item) => (
						<Pressable
							key={item.key}
							onPress={() => setType(item.key)}
							style={[
								styles.chip,
								type === item.key ? styles.chipActive : null,
							]}
						>
							<Text
								style={[
									styles.chipLabel,
									type === item.key ? styles.chipLabelActive : null,
								]}
							>
								{item.label}
							</Text>
						</Pressable>
					))}
				</View>

				<Text style={styles.label}>{statsCopy.goalPeriod}</Text>
				<View style={styles.chips}>
					{PERIODS.map((item) => (
						<Pressable
							key={item.key}
							onPress={() => setPeriod(item.key)}
							style={[
								styles.chip,
								period === item.key ? styles.chipActive : null,
							]}
						>
							<Text
								style={[
									styles.chipLabel,
									period === item.key ? styles.chipLabelActive : null,
								]}
							>
								{item.label}
							</Text>
						</Pressable>
					))}
				</View>

				<TextField
					label={statsCopy.goalTarget}
					value={target}
					onChangeText={setTarget}
					keyboardType="number-pad"
					error={error ?? undefined}
				/>

				{!id ? (
					<View style={styles.presets}>
						<SecondaryButton
							label={statsCopy.presetPages}
							onPress={() => {
								setType('PAGES')
								setPeriod('DAY')
								setTarget('20')
							}}
						/>
						<SecondaryButton
							label={statsCopy.presetMinutes}
							onPress={() => {
								setType('MINUTES')
								setPeriod('DAY')
								setTarget('30')
							}}
						/>
						<SecondaryButton
							label={statsCopy.presetBooks}
							onPress={() => {
								setType('BOOKS')
								setPeriod('YEAR')
								setTarget('12')
							}}
						/>
					</View>
				) : null}

				<PrimaryButton
					label={appCopy.save}
					onPress={() => void save()}
					loading={saving}
				/>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.md,
		paddingBottom: spacing.xxl,
	},
	label: {
		...typography.caption,
		color: colors.muted,
		textTransform: 'uppercase',
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.sm,
		backgroundColor: colors.surfaceMuted,
	},
	chipActive: {
		backgroundColor: colors.primarySoft,
	},
	chipLabel: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	chipLabelActive: {
		color: colors.primaryDark,
		fontWeight: '700',
	},
	presets: {
		gap: spacing.xs,
	},
})
