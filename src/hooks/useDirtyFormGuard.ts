/**
 * Reusable dirty-form guard for stack screens (Android Back / header back).
 * Shows a discard confirmation only when content changed and not saving.
 */

import { useNavigation } from 'expo-router'
import { useEffect } from 'react'
import { Alert } from 'react-native'

import { diaryCopy } from '@/constants/copy'

export interface DirtyFormGuardOptions {
	dirty: boolean
	saving?: boolean
	title?: string
	discardLabel?: string
	keepLabel?: string
}

/**
 * Prevent accidental discard of unsaved text/forms.
 * Call from edit screens that own local draft state.
 */
export function useDirtyFormGuard ({
	dirty,
	saving = false,
	title = diaryCopy.dirtyTitle,
	discardLabel = diaryCopy.dirtyDiscard,
	keepLabel = diaryCopy.dirtyKeep,
}: DirtyFormGuardOptions): void {
	const navigation = useNavigation()

	useEffect(() => {
		const unsubscribe = navigation.addListener(
			'beforeRemove',
			(event: {
				preventDefault: () => void
				data: { action: unknown }
			}) => {
				if (!dirty || saving) {
					return
				}
				event.preventDefault()
				Alert.alert(title, undefined, [
					{
						text: discardLabel,
						style: 'destructive',
						onPress: () =>
							navigation.dispatch(event.data.action as never),
					},
					{ text: keepLabel, style: 'cancel' },
				])
			},
		)
		return unsubscribe
	}, [navigation, dirty, saving, title, discardLabel, keepLabel])
}
