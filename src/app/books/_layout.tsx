import { Stack } from 'expo-router'

import { colors } from '@/constants/theme'

/**
 * Stack for book add / search / scan / details / edit flows.
 */
export default function BooksLayout () {
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.primary,
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="add/index" options={{ title: 'Добавить книгу' }} />
			<Stack.Screen name="add/manual" options={{ title: 'Вручную' }} />
			<Stack.Screen name="search/index" options={{ title: 'Поиск книг' }} />
			<Stack.Screen name="search/preview" options={{ title: 'Добавить' }} />
			<Stack.Screen name="scan" options={{ title: 'Сканер ISBN' }} />
			<Stack.Screen name="[id]/index" options={{ title: 'Книга' }} />
			<Stack.Screen name="[id]/edit" options={{ title: 'Изменить книгу' }} />
			<Stack.Screen
				name="[id]/history"
				options={{ title: 'История чтения' }}
			/>
		</Stack>
	)
}
