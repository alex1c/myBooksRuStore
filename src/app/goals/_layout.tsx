import { Stack } from 'expo-router'

import { colors } from '@/constants/theme'

export default function GoalsLayout () {
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.primary,
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="form" options={{ title: 'Цель' }} />
		</Stack>
	)
}
