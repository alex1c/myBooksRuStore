/**
 * Single help section page with short blocks and decorative mocks.
 */

import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { HelpIllustration } from '@/components/help/HelpIllustration'
import { Screen } from '@/components/ui'
import { helpCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { track } from '@/domain/analytics/analyticsService'
import { AnalyticsEvents } from '@/domain/analytics/types'
import { mapHelpSectionToAnalytics } from '@/domain/analytics/helpSectionMap'
import { getHelpSection } from '@/domain/help/helpCatalog'

export default function HelpSectionScreen () {
	const { section } = useLocalSearchParams<{ section: string }>()
	const data = section ? getHelpSection(section) : null

	useEffect(() => {
		if (!section) {
			return
		}
		const mapped = mapHelpSectionToAnalytics(section)
		if (mapped) {
			track(AnalyticsEvents.helpOpened, { section: mapped })
		}
	}, [section])

	if (!data) {
		return (
			<>
				<Stack.Screen
					options={{ headerShown: true, title: helpCopy.title }}
				/>
				<Screen>
					<Text style={styles.missing}>{helpCopy.missing}</Text>
				</Screen>
			</>
		)
	}

	return (
		<>
			<Stack.Screen
				options={{ headerShown: true, title: data.title }}
			/>
			<Screen scroll contentStyle={styles.content}>
				<Text style={styles.title}>{data.title}</Text>
				<Text style={styles.subtitle}>{data.subtitle}</Text>
				{data.blocks.map((block, index) => {
					if (block.type === 'h') {
						return (
							<Text key={`h-${index}`} style={styles.heading}>
								{block.text}
							</Text>
						)
					}
					if (block.type === 'p') {
						return (
							<Text key={`p-${index}`} style={styles.body}>
								{block.text}
							</Text>
						)
					}
					if (block.type === 'bullets') {
						return (
							<View key={`b-${index}`} style={styles.bullets}>
								{block.items.map((item) => (
									<Text key={item} style={styles.body}>
										• {item}
									</Text>
								))}
							</View>
						)
					}
					if (block.type === 'warning') {
						return (
							<View key={`w-${index}`} style={styles.warning}>
								<Text style={styles.warningText}>{block.text}</Text>
							</View>
						)
					}
					if (block.type === 'note') {
						return (
							<Text key={`n-${index}`} style={styles.note}>
								{block.text}
							</Text>
						)
					}
					return (
						<HelpIllustration key={`m-${index}`} kind={block.kind} />
					)
				})}
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		gap: spacing.sm,
		paddingBottom: spacing.xxl,
	},
	title: {
		...typography.title,
		fontSize: 24,
		lineHeight: 30,
		color: colors.text,
	},
	subtitle: {
		...typography.body,
		color: colors.textSecondary,
		marginBottom: spacing.xs,
	},
	heading: {
		...typography.section,
		color: colors.text,
		marginTop: spacing.sm,
	},
	body: {
		...typography.body,
		color: colors.text,
	},
	bullets: {
		gap: spacing.xxs,
	},
	note: {
		...typography.bodySmall,
		color: colors.primaryDark,
		backgroundColor: colors.primarySoft,
		padding: spacing.sm,
		borderRadius: radii.md,
		overflow: 'hidden',
	},
	warning: {
		padding: spacing.sm,
		borderRadius: radii.md,
		backgroundColor: '#F8E8E8',
		borderWidth: 1,
		borderColor: colors.danger,
	},
	warningText: {
		...typography.bodySmall,
		color: colors.danger,
		fontWeight: '600',
	},
	missing: {
		...typography.body,
		color: colors.danger,
	},
})
