import { Stack } from 'expo-router'

import { colors } from '@/constants/theme'

/**
 * Stack for note create / details / edit flows.
 */
export default function NotesLayout () {
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.primary,
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="new" options={{ title: 'Новая запись' }} />
			<Stack.Screen name="[id]/index" options={{ title: 'Запись' }} />
			<Stack.Screen name="[id]/edit" options={{ title: 'Изменить запись' }} />
		</Stack>
	)
}
