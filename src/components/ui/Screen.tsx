import { ReactNode } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	View,
	ViewStyle,
	StyleProp,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors, spacing } from '@/constants/theme'

interface ScreenProps {
	children: ReactNode
	/** When true, content scrolls vertically (forms / long empty states). */
	scroll?: boolean
	/** When true, wraps content so Android keyboard does not cover inputs. */
	keyboardAvoiding?: boolean
	style?: StyleProp<ViewStyle>
	contentStyle?: StyleProp<ViewStyle>
	testID?: string
}

/**
 * Standard screen shell with safe-area padding and calm background.
 * Forms should pass scroll + keyboardAvoiding together.
 */
export function Screen ({
	children,
	scroll = false,
	keyboardAvoiding = false,
	style,
	contentStyle,
	testID,
}: ScreenProps) {
	const body = scroll ? (
		<ScrollView
			contentContainerStyle={[styles.content, contentStyle]}
			keyboardShouldPersistTaps="handled"
			keyboardDismissMode="on-drag"
			showsVerticalScrollIndicator={false}
		>
			{children}
		</ScrollView>
	) : (
		<View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
	)

	const wrapped = keyboardAvoiding ? (
		<KeyboardAvoidingView
			style={styles.flex}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
		>
			{body}
		</KeyboardAvoidingView>
	) : (
		body
	)

	return (
		<SafeAreaView style={[styles.safe, style]} edges={['top']} testID={testID}>
			{wrapped}
		</SafeAreaView>
	)
}

const styles = StyleSheet.create({
	safe: {
		flex: 1,
		backgroundColor: colors.background,
	},
	flex: {
		flex: 1,
	},
	content: {
		flexGrow: 1,
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.lg,
	},
})
