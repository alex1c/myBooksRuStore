/**
 * OCR camera capture — photograph a quote fragment (Phase 11).
 * Does not pause / finish an active reading session.
 */

import {
	CameraView,
	useCameraPermissions,
	type CameraView as CameraViewType,
} from 'expo-camera'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'

import {
	EmptyState,
	LoadingState,
	PrimaryButton,
	Screen,
	SecondaryButton,
	SectionHeader,
} from '@/components/ui'
import { ocrCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import {
	cleanupOcrTempImage,
	isOcrBusy,
	OcrError,
	recognizeText,
	setPendingOcrDraft,
	updatePendingOcrDraft,
} from '@/domain/ocr/ocrService'

export default function OcrScanScreen () {
	const params = useLocalSearchParams<{
		entryId?: string
		sessionId?: string
		returnTo?: string
		pageHint?: string
		existingDraft?: string
	}>()
	const [permission, requestPermission] = useCameraPermissions()
	const cameraRef = useRef<CameraViewType>(null)
	const [busy, setBusy] = useState(false)
	const [busyLabel, setBusyLabel] = useState(ocrCopy.processing)

	const entryId = params.entryId
	const returnTo =
		params.returnTo === 'session' ||
		params.returnTo === 'book' ||
		params.returnTo === 'editor'
			? params.returnTo
			: 'editor'

	const openManual = () => {
		if (!entryId) {
			router.back()
			return
		}
		router.replace({
			pathname: '/notes/new',
			params: {
				entryId,
				type: 'QUOTE',
				sessionId: params.sessionId ?? undefined,
				returnTo: returnTo === 'session' ? 'session' : undefined,
			},
		})
	}

	const handleCapture = async () => {
		if (!entryId || busy || isOcrBusy() || !cameraRef.current) {
			return
		}
		setBusy(true)
		setBusyLabel(ocrCopy.processing)
		let captureUri: string | null = null
		try {
			const photo = await cameraRef.current.takePictureAsync({
				quality: 0.7,
				skipProcessing: false,
				exif: true,
			})
			if (!photo?.uri) {
				throw new OcrError('FAILED', ocrCopy.failed)
			}
			captureUri = photo.uri

			setPendingOcrDraft({
				entryId,
				sessionId: params.sessionId ?? null,
				returnTo,
				pageHint: params.pageHint ?? null,
				existingDraft: params.existingDraft ?? '',
			})

			const result = await recognizeText(photo.uri)
			updatePendingOcrDraft({
				confirmedText: result.fullText,
			})
			router.replace('/ocr/review')
		} catch (error) {
			const empty =
				error instanceof OcrError && error.kind === 'EMPTY'
			Alert.alert(
				empty ? ocrCopy.empty : ocrCopy.failed,
				undefined,
				[
					{
						text: ocrCopy.retake,
						onPress: () => setBusy(false),
					},
					{
						text: ocrCopy.manualEntry,
						onPress: openManual,
					},
				],
			)
			setBusy(false)
		} finally {
			await cleanupOcrTempImage(captureUri)
		}
	}

	if (!entryId) {
		return (
			<>
				<Stack.Screen options={{ title: ocrCopy.scanTitle, headerShown: true }} />
				<Screen>
					<Text style={styles.error}>Книга не указана</Text>
				</Screen>
			</>
		)
	}

	if (!permission) {
		return (
			<>
				<Stack.Screen options={{ title: ocrCopy.scanTitle, headerShown: true }} />
				<LoadingState message={ocrCopy.scanTitle} />
			</>
		)
	}

	if (!permission.granted) {
		return (
			<>
				<Stack.Screen options={{ title: ocrCopy.scanTitle, headerShown: true }} />
				<Screen contentStyle={styles.center}>
					<EmptyState
						icon="camera-outline"
						title={
							permission.canAskAgain
								? ocrCopy.permissionExplain
								: ocrCopy.permissionDeniedTitle
						}
						description={
							permission.canAskAgain
								? undefined
								: ocrCopy.permissionDeniedHint
						}
						actionLabel={
							permission.canAskAgain
								? ocrCopy.permissionAllow
								: ocrCopy.tryAgain
						}
						onAction={() => {
							void requestPermission()
						}}
						secondaryActionLabel={ocrCopy.manualEntry}
						onSecondaryAction={openManual}
					/>
				</Screen>
			</>
		)
	}

	return (
		<>
			<Stack.Screen options={{ title: ocrCopy.scanTitle, headerShown: true }} />
			<Screen contentStyle={styles.content}>
				<SectionHeader
					title={ocrCopy.scanTitle}
					subtitle={ocrCopy.scanHint}
				/>
				<Text style={styles.privacy}>{ocrCopy.privacy}</Text>
				<View style={styles.cameraWrap}>
					{busy ? (
						<LoadingState message={busyLabel} />
					) : (
						<>
							<CameraView
								ref={cameraRef}
								style={styles.camera}
								facing="back"
								mode="picture"
							/>
							<View pointerEvents="none" style={styles.guide} />
						</>
					)}
				</View>
				<PrimaryButton
					label={ocrCopy.scanButton}
					onPress={() => {
						void handleCapture()
					}}
					disabled={busy}
					loading={busy}
				/>
				<SecondaryButton
					label={ocrCopy.manualEntry}
					onPress={openManual}
					disabled={busy}
				/>
			</Screen>
		</>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		gap: spacing.sm,
		paddingBottom: spacing.lg,
	},
	center: { flex: 1, justifyContent: 'center' },
	privacy: {
		...typography.bodySmall,
		color: colors.muted,
	},
	cameraWrap: {
		flex: 1,
		minHeight: 280,
		borderRadius: radii.lg,
		overflow: 'hidden',
		backgroundColor: colors.surfaceMuted,
		position: 'relative',
	},
	camera: { flex: 1 },
	guide: {
		position: 'absolute',
		left: '8%',
		right: '8%',
		top: '18%',
		bottom: '18%',
		borderWidth: 2,
		borderColor: 'rgba(255,255,255,0.7)',
		borderRadius: radii.md,
	},
	error: {
		...typography.body,
		color: colors.danger,
	},
})
