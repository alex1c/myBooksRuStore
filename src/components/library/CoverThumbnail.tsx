import { Image } from 'expo-image'
import { StyleSheet, Text, View } from 'react-native'

import { radii, typography } from '@/constants/theme'
import { coverMonogram, coverPlaceholderColor } from '@/utils/progress'

interface CoverThumbnailProps {
	title: string
	coverUri?: string | null
	remoteCoverUrl?: string | null
	size?: number
}

/**
 * Cover image with deterministic monogram fallback (no crash on dead URLs).
 */
export function CoverThumbnail ({
	title,
	coverUri,
	remoteCoverUrl,
	size = 56,
}: CoverThumbnailProps) {
	const backgroundColor = coverPlaceholderColor(title)
	const uri = coverUri?.trim() || remoteCoverUrl?.trim() || null
	const height = size * 1.45

	return (
		<View
			accessibilityLabel={`Обложка: ${title}`}
			style={[
				styles.cover,
				{
					width: size,
					height,
					borderRadius: radii.sm,
					backgroundColor,
				},
			]}
		>
			{uri ? (
				<Image
					source={{ uri }}
					style={{ width: size, height, borderRadius: radii.sm }}
					contentFit="cover"
					transition={150}
					recyclingKey={uri}
				/>
			) : (
				<Text style={[styles.letter, { fontSize: size * 0.42 }]}>
					{coverMonogram(title)}
				</Text>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	cover: {
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
	},
	letter: {
		...typography.title,
		color: '#FFFFFF',
		fontWeight: '700',
	},
})
