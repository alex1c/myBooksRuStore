import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Platform } from 'react-native'

import { tabsCopy } from '@/constants/copy'
import { colors } from '@/constants/theme'
import { AdContexts, type AdContext } from '@/domain/ads/adContexts'
import {
	onSafeTabTransition,
	recordMeaningfulAdAction,
} from '@/domain/ads/adsService'

const TAB_CONTEXT: Record<string, AdContext> = {
	index: AdContexts.HOME,
	library: AdContexts.LIBRARY,
	diary: AdContexts.DIARY,
	stats: AdContexts.STATISTICS,
	more: AdContexts.MORE,
}

/**
 * Production-quality bottom tabs for the five primary destinations.
 * Records meaningful navigation and may attempt interstitial on safe tabs.
 */
export default function TabsLayout () {
	return (
		<Tabs
			screenOptions={{
				headerShown: false,
				tabBarActiveTintColor: colors.primary,
				tabBarInactiveTintColor: colors.muted,
				tabBarLabelStyle: {
					fontSize: 11,
					fontWeight: '600',
				},
				tabBarStyle: {
					backgroundColor: colors.surface,
					borderTopColor: colors.border,
					height: Platform.OS === 'android' ? 64 : 84,
					paddingBottom: Platform.OS === 'android' ? 8 : 24,
					paddingTop: 6,
				},
				sceneStyle: {
					backgroundColor: colors.background,
				},
			}}
			screenListeners={{
				tabPress: (event) => {
					const routeName = event.target?.split('-')[0] ?? ''
					const context = TAB_CONTEXT[routeName]
					if (!context) {
						return
					}
					// Today is never an interstitial target; still counts as an action
					// when leaving/entering other tabs via onSafeTabTransition whitelist.
					if (
						context === AdContexts.LIBRARY
						|| context === AdContexts.DIARY
						|| context === AdContexts.STATISTICS
						|| context === AdContexts.MORE
					) {
						onSafeTabTransition(context)
					} else {
						// Major tab navigation still counts toward the meaningful-action gate.
						recordMeaningfulAdAction()
					}
				},
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: tabsCopy.today.title,
					tabBarAccessibilityLabel: tabsCopy.today.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="sunny-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="library"
				options={{
					title: tabsCopy.library.title,
					tabBarAccessibilityLabel: tabsCopy.library.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="library-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="diary"
				options={{
					title: tabsCopy.diary.title,
					tabBarAccessibilityLabel: tabsCopy.diary.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="journal-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="stats"
				options={{
					title: tabsCopy.stats.title,
					tabBarAccessibilityLabel: tabsCopy.stats.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons name="bar-chart-outline" size={size} color={color} />
					),
				}}
			/>
			<Tabs.Screen
				name="more"
				options={{
					title: tabsCopy.more.title,
					tabBarAccessibilityLabel: tabsCopy.more.title,
					tabBarIcon: ({ color, size }) => (
						<Ionicons
							name="ellipsis-horizontal-circle-outline"
							size={size}
							color={color}
						/>
					),
				}}
			/>
		</Tabs>
	)
}
