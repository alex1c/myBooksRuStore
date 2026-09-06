import { StyleSheet, Text, View } from 'react-native'

import { radii, typography } from '@/constants/theme'
import { coverMonogram, coverPlaceholderColor } from '@/utils/progress'

interface CoverThumbnailProps {
	title: string
	coverUri?: string | null
	size?: number
}

/**
 * Cover image or deterministic monogram placeholder (no network images in Phase 2).
 */
export function CoverThumbnail ({
	title,
	coverUri,
	size = 56,
}: CoverThumbnailProps) {
	const backgroundColor = coverPlaceholderColor(title)
	// coverUri is reserved for Phase 3 remote covers; Phase 2 uses placeholders.
	void coverUri

	return (
		<View
			accessibilityLabel={`Обложка: ${title}`}
			style={[
				styles.cover,
				{
					width: size,
					height: size * 1.45,
					borderRadius: radii.sm,
					backgroundColor,
				},
			]}
		>
			<Text style={[styles.letter, { fontSize: size * 0.42 }]}>
				{coverMonogram(title)}
			</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	cover: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	letter: {
		...typography.title,
		color: '#FFFFFF',
		fontWeight: '700',
	},
})
