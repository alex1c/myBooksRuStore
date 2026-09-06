import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Platform } from 'react-native'

import { tabsCopy } from '@/constants/copy'
import { colors } from '@/constants/theme'

/**
 * Production-quality bottom tabs for the five primary destinations.
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
