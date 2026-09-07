import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AppErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorState, LoadingState } from '@/components/ui'
import { appCopy } from '@/constants/copy'
import { colors } from '@/constants/theme'
import { DatabaseProvider } from '@/context/DatabaseContext'
import { useAppBootstrap } from '@/hooks/useAppBootstrap'

// Keep splash visible until DB bootstrap finishes (or fails recoverably).
SplashScreen.preventAutoHideAsync().catch(() => {
	// Ignore if splash is already hidden in fast refresh / tests.
})

/**
 * Root layout: bootstrap SQLite, then mount tab navigation + library stacks.
 */
export default function RootLayout () {
	const { status, database, retry } = useAppBootstrap()

	useEffect(() => {
		if (status === 'ready' || status === 'error') {
			SplashScreen.hideAsync().catch(() => undefined)
		}
	}, [status])

	if (status === 'loading') {
		return (
			<SafeAreaProvider>
				<StatusBar style="dark" />
				<LoadingState message={appCopy.loading} />
			</SafeAreaProvider>
		)
	}

	if (status === 'error' || !database) {
		return (
			<SafeAreaProvider>
				<StatusBar style="dark" />
				<ErrorState
					title={appCopy.bootstrapErrorTitle}
					message={appCopy.bootstrapErrorMessage}
					actionLabel={appCopy.retry}
					onRetry={retry}
				/>
			</SafeAreaProvider>
		)
	}

	return (
		<SafeAreaProvider>
			<AppErrorBoundary>
				<DatabaseProvider value={database}>
					<StatusBar style="dark" />
					<Stack
						screenOptions={{
							headerShown: false,
							contentStyle: { backgroundColor: colors.background },
							headerTintColor: colors.primary,
							headerStyle: { backgroundColor: colors.background },
							headerShadowVisible: false,
						}}
					>
						<Stack.Screen name="(tabs)" />
						<Stack.Screen name="books" />
						<Stack.Screen name="sessions" />
						<Stack.Screen name="notes" />
						<Stack.Screen name="goals" />
						<Stack.Screen
							name="year-in-books/index"
							options={{
								headerShown: false,
								animation: 'slide_from_right',
							}}
						/>
						<Stack.Screen
							name="archive"
							options={{
								headerShown: true,
								title: 'Архив книг',
							}}
						/>
						<Stack.Screen
							name="shelves/index"
							options={{
								headerShown: true,
								title: 'Полки',
							}}
						/>
						<Stack.Screen
							name="about"
							options={{
								presentation: 'modal',
								headerShown: true,
								title: 'О приложении',
							}}
						/>
					</Stack>
				</DatabaseProvider>
			</AppErrorBoundary>
		</SafeAreaProvider>
	)
}
