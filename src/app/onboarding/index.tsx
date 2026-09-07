/**
 * First-launch onboarding — 4 slides, skippable, no demo DB data.
 */

import { router, Stack } from 'expo-router'
import { useMemo, useState } from 'react'
import {
	Pressable,
	StyleSheet,
	Text,
	View,
	useWindowDimensions,
} from 'react-native'

import { HelpIllustration } from '@/components/help/HelpIllustration'
import { PrimaryButton, SecondaryButton, Screen } from '@/components/ui'
import { onboardingCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import { ONBOARDING_SLIDES } from '@/domain/help/onboardingSlides'
import { finishOnboarding } from '@/domain/help/onboardingService'

export default function OnboardingScreen () {
	const { executor } = useDatabase()
	const { width } = useWindowDimensions()
	const [index, setIndex] = useState(0)
	const [busy, setBusy] = useState(false)
	const slide = ONBOARDING_SLIDES[index]!
	const isLast = index === ONBOARDING_SLIDES.length - 1

	const complete = async () => {
		if (busy) {
			return
		}
		setBusy(true)
		try {
			await finishOnboarding(executor)
			router.replace('/(tabs)')
		} finally {
			setBusy(false)
		}
	}

	const pageLabel = useMemo(
		() => onboardingCopy.pageIndicator(index + 1, ONBOARDING_SLIDES.length),
		[index],
	)

	return (
		<>
			<Stack.Screen options={{ headerShown: false }} />
			<Screen contentStyle={styles.screen}>
				<View style={styles.topRow}>
					<Text
						style={styles.page}
						accessibilityRole="text"
						accessibilityLabel={pageLabel}
					>
						{pageLabel}
					</Text>
					{!isLast ? (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={onboardingCopy.skip}
							onPress={() => {
								void complete()
							}}
							hitSlop={8}
							disabled={busy}
						>
							<Text style={styles.skip}>{onboardingCopy.skip}</Text>
						</Pressable>
					) : (
						<View style={styles.skipPlaceholder} />
					)}
				</View>

				<View style={[styles.body, { maxWidth: Math.min(420, width - 32) }]}>
					<Text style={styles.title}>{slide.title}</Text>
					<Text style={styles.copy}>{slide.body}</Text>
					{slide.note ? (
						<Text style={styles.note}>{slide.note}</Text>
					) : null}
					<HelpIllustration kind={slide.illustration} />
				</View>

				<View style={styles.dots} accessibilityLabel={pageLabel}>
					{ONBOARDING_SLIDES.map((item, i) => (
						<View
							key={item.id}
							style={[styles.dot, i === index && styles.dotActive]}
						/>
					))}
				</View>

				<View style={styles.actions}>
					{index > 0 ? (
						<SecondaryButton
							label={onboardingCopy.back}
							onPress={() => setIndex((v) => Math.max(0, v - 1))}
							disabled={busy}
						/>
					) : null}
					<PrimaryButton
						label={
							isLast ? onboardingCopy.start : onboardingCopy.next
						}
						loading={busy}
						onPress={() => {
							if (isLast) {
								void complete()
								return
							}
							setIndex((v) =>
								Math.min(ONBOARDING_SLIDES.length - 1, v + 1),
							)
						}}
					/>
				</View>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		paddingTop: spacing.md,
		justifyContent: 'space-between',
		gap: spacing.lg,
	},
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	page: {
		...typography.caption,
		color: colors.muted,
	},
	skip: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primary,
		minHeight: 44,
		textAlignVertical: 'center',
	},
	skipPlaceholder: {
		minWidth: 64,
		minHeight: 44,
	},
	body: {
		gap: spacing.md,
		alignSelf: 'center',
		width: '100%',
	},
	title: {
		...typography.title,
		fontSize: 26,
		lineHeight: 32,
		color: colors.text,
	},
	copy: {
		...typography.body,
		color: colors.textSecondary,
	},
	note: {
		...typography.bodySmall,
		color: colors.muted,
	},
	dots: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: spacing.xs,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: radii.full,
		backgroundColor: colors.border,
	},
	dotActive: {
		backgroundColor: colors.primary,
		width: 18,
	},
	actions: {
		gap: spacing.sm,
		paddingBottom: spacing.md,
	},
})
