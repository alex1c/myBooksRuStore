import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import {
	EmptyState,
	LoadingState,
	Screen,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { scanCopy, searchCopy } from '@/constants/copy'
import { colors, spacing, typography } from '@/constants/theme'
import { lookupBookByIsbn } from '@/services/bookSearch'
import { setPendingSearchCandidate } from '@/services/bookSearch/pendingCandidate'
import { isBooklandEan13, parseIsbn } from '@/utils/isbn'

/**
 * ISBN barcode scanner — EAN-13 Bookland only, with scan lock against double-fire.
 */
export default function IsbnScanScreen () {
	const [permission, requestPermission] = useCameraPermissions()
	const [busy, setBusy] = useState(false)
	const [hint, setHint] = useState<string | null>(null)
	const lockedRef = useRef(false)

	const handleBarcode = useCallback(
		async (result: BarcodeScanningResult) => {
			if (lockedRef.current || busy) {
				return
			}
			const raw = result.data?.trim() ?? ''
			if (!raw) {
				return
			}

			if (!isBooklandEan13(raw)) {
				// Allow valid ISBN-10 typed into a non-EAN path is not expected from EAN scanner.
				const parsed = parseIsbn(raw)
				if (!parsed || parsed.kind !== 'ISBN13' || !isBooklandEan13(raw)) {
					setHint(scanCopy.notBookland)
					return
				}
			}

			lockedRef.current = true
			setBusy(true)
			setHint(null)

			try {
				const book = await lookupBookByIsbn(raw)
				if (!book) {
					Alert.alert(scanCopy.notFound, undefined, [
						{
							text: scanCopy.manualFallback,
							onPress: () => router.replace('/books/add/manual'),
						},
						{
							text: searchCopy.retry,
							onPress: () => {
								lockedRef.current = false
								setBusy(false)
							},
						},
					])
					return
				}
				setPendingSearchCandidate(book, 'isbn')
				router.replace('/books/search/preview')
			} catch {
				Alert.alert(searchCopy.networkErrorTitle, searchCopy.networkErrorHint, [
					{
						text: scanCopy.manualFallback,
						onPress: () => router.replace('/books/add/manual'),
					},
					{
						text: searchCopy.retry,
						onPress: () => {
							lockedRef.current = false
							setBusy(false)
						},
					},
				])
			}
		},
		[busy],
	)

	if (!permission) {
		return <LoadingState message={scanCopy.title} />
	}

	if (!permission.granted) {
		return (
			<Screen contentStyle={styles.center}>
				<SectionHeader title={scanCopy.title} />
				<EmptyState
					icon="camera-outline"
					title={
						permission.canAskAgain
							? scanCopy.permissionExplain
							: scanCopy.permissionDeniedTitle
					}
					description={
						permission.canAskAgain
							? undefined
							: scanCopy.permissionDeniedHint
					}
					actionLabel={
						permission.canAskAgain
							? scanCopy.permissionAllow
							: scanCopy.tryAgain
					}
					onAction={() => {
						void requestPermission()
					}}
					secondaryActionLabel={scanCopy.enterIsbn}
					onSecondaryAction={() => router.push('/books/search')}
				/>
			</Screen>
		)
	}

	return (
		<Screen contentStyle={styles.content}>
			<SectionHeader
				title={scanCopy.title}
				subtitle={scanCopy.permissionExplain}
			/>
			<View style={styles.cameraWrap}>
				{busy ? (
					<LoadingState message={scanCopy.lookingUp} />
				) : (
					<CameraView
						style={styles.camera}
						facing="back"
						barcodeScannerSettings={{
							barcodeTypes: ['ean13'],
						}}
						onBarcodeScanned={handleBarcode}
					/>
				)}
			</View>
			{hint ? <Text style={styles.hint}>{hint}</Text> : null}
			<SecondaryButton
				label={scanCopy.enterIsbn}
				onPress={() => router.push('/books/search')}
			/>
			<SecondaryButton
				label={scanCopy.manualFallback}
				onPress={() => router.push('/books/add/manual')}
			/>
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		gap: spacing.sm,
		paddingBottom: spacing.lg,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
	},
	cameraWrap: {
		flex: 1,
		minHeight: 280,
		borderRadius: 16,
		overflow: 'hidden',
		backgroundColor: colors.surfaceMuted,
	},
	camera: {
		flex: 1,
	},
	hint: {
		...typography.bodySmall,
		color: colors.warning,
		textAlign: 'center',
	},
})
