import { Stack } from 'expo-router'

import { colors } from '@/constants/theme'

/**
 * OCR quote capture stack (camera + review).
 */
export default function OcrLayout () {
	return (
		<Stack
			screenOptions={{
				headerTintColor: colors.primary,
				headerStyle: { backgroundColor: colors.background },
				headerShadowVisible: false,
				contentStyle: { backgroundColor: colors.background },
			}}
		>
			<Stack.Screen name="scan" options={{ title: 'Сканировать цитату' }} />
			<Stack.Screen name="review" options={{ title: 'Проверьте цитату' }} />
		</Stack>
	)
}
