import { Stack } from 'expo-router'

import { colors } from '@/constants/theme'

/**
 * Stack for active session + finish flows.
 */
export default function SessionsLayout () {
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.primary,
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="active" options={{ title: 'Читаем' }} />
			<Stack.Screen name="finish" options={{ title: 'Итог сессии' }} />
		</Stack>
	)
}
