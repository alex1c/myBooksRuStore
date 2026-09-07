import { Pressable, StyleSheet, Text, View } from 'react-native'

import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import { PrimaryButton } from '@/components/ui'
import { appCopy, todayCopy } from '@/constants/copy'
import { formatLabels } from '@/constants/labels'
import { colors, radii, spacing, typography } from '@/constants/theme'
import type { LibraryBookItem, LibraryEntry } from '@/db/types'
import { formatProgressLabel, progressRatio } from '@/utils/progress'

interface QuickChip {
	label: string
	onPress: () => void
}

interface ReadingNowCardProps {
	item: LibraryBookItem
	highlighted?: boolean
	onOpen: () => void
	onStartReading: () => void
	onQuick: (kind: 'pages' | 'percent' | 'minutes', delta: number) => void
	onExact: () => void
	busy?: boolean
	/** When false, hide Start/Continue to avoid competing with active session banner. */
	showStartReading?: boolean
	startLabel?: string
}

function buildChips (
	entry: LibraryEntry,
	onQuick: ReadingNowCardProps['onQuick'],
	onExact: () => void,
): QuickChip[] {
	if (entry.progressMode === 'PAGES') {
		return [
			{ label: todayCopy.plus1, onPress: () => onQuick('pages', 1) },
			{ label: todayCopy.plus10, onPress: () => onQuick('pages', 10) },
			{ label: todayCopy.plus25, onPress: () => onQuick('pages', 25) },
			{ label: todayCopy.setExact, onPress: onExact },
		]
	}
	if (entry.progressMode === 'PERCENT') {
		return [
			{ label: todayCopy.plus1pct, onPress: () => onQuick('percent', 1) },
			{ label: todayCopy.plus5pct, onPress: () => onQuick('percent', 5) },
			{ label: todayCopy.plus10pct, onPress: () => onQuick('percent', 10) },
			{ label: todayCopy.setExact, onPress: onExact },
		]
	}
	return [
		{ label: todayCopy.plus10min, onPress: () => onQuick('minutes', 10) },
		{ label: todayCopy.plus30min, onPress: () => onQuick('minutes', 30) },
		{ label: todayCopy.plus60min, onPress: () => onQuick('minutes', 60) },
		{ label: todayCopy.setExact, onPress: onExact },
	]
}

/**
 * Today working card: progress, quick actions, start reading — compact height.
 */
export function ReadingNowCard ({
	item,
	highlighted = false,
	onOpen,
	onStartReading,
	onQuick,
	onExact,
	busy = false,
	showStartReading = true,
	startLabel = todayCopy.startReading,
}: ReadingNowCardProps) {
	const { book, entry } = item
	const author = book.authorText.trim() || appCopy.authorUnknown
	const progress = formatProgressLabel(entry)
	const ratio = progressRatio(entry)
	const chips = buildChips(entry, onQuick, onExact)

	return (
		<View style={[styles.card, highlighted ? styles.highlighted : null]}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${book.title}, ${author}`}
				onPress={onOpen}
				style={styles.header}
			>
				<CoverThumbnail
					title={book.title}
					coverUri={book.coverUri}
					remoteCoverUrl={book.remoteCoverUrl}
					size={56}
				/>
				<View style={styles.headerText}>
					<Text style={styles.title} numberOfLines={2}>
						{book.title}
					</Text>
					<Text style={styles.author} numberOfLines={1}>
						{author}
					</Text>
					<Text style={styles.format}>{formatLabels[entry.format]}</Text>
				</View>
			</Pressable>

			{progress ? <Text style={styles.progress}>{progress}</Text> : null}
			{ratio != null ? (
				<View style={styles.barTrack}>
					<View style={[styles.barFill, { width: `${Math.round(ratio * 100)}%` }]} />
				</View>
			) : null}

			<View style={styles.chips}>
				{chips.map((chip) => (
					<Pressable
						key={chip.label}
						accessibilityRole="button"
						accessibilityLabel={chip.label}
						disabled={busy}
						onPress={chip.onPress}
						style={({ pressed }) => [
							styles.chip,
							pressed ? styles.chipPressed : null,
							busy ? styles.chipDisabled : null,
						]}
					>
						<Text style={styles.chipLabel}>{chip.label}</Text>
					</Pressable>
				))}
			</View>

			{showStartReading ? (
				<PrimaryButton
					label={startLabel}
					onPress={onStartReading}
					disabled={busy}
				/>
			) : null}
		</View>
	)
}

/** Shared quick-action strip for book details. */
export function QuickProgressRow ({
	entry,
	onQuick,
	onExact,
	onStartReading,
	busy = false,
	startLabel = todayCopy.startReading,
}: {
	entry: LibraryEntry
	onQuick: ReadingNowCardProps['onQuick']
	onExact: () => void
	onStartReading?: () => void
	busy?: boolean
	startLabel?: string
}) {
	const chips = buildChips(entry, onQuick, onExact)
	return (
		<View style={styles.detailsBlock}>
			<View style={styles.chips}>
				{chips.map((chip) => (
					<Pressable
						key={chip.label}
						accessibilityRole="button"
						accessibilityLabel={chip.label}
						disabled={busy}
						onPress={chip.onPress}
						style={({ pressed }) => [
							styles.chip,
							pressed ? styles.chipPressed : null,
						]}
					>
						<Text style={styles.chipLabel}>{chip.label}</Text>
					</Pressable>
				))}
			</View>
			{onStartReading ? (
				<PrimaryButton
					label={startLabel}
					onPress={onStartReading}
					disabled={busy}
				/>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		padding: spacing.md,
		gap: spacing.sm,
		marginBottom: spacing.sm,
	},
	highlighted: {
		borderColor: colors.primary,
		borderWidth: 1.5,
		backgroundColor: colors.primarySoft,
	},
	header: {
		flexDirection: 'row',
		gap: spacing.sm,
	},
	headerText: {
		flex: 1,
		minWidth: 0,
		gap: 2,
		justifyContent: 'center',
	},
	title: {
		...typography.section,
		fontSize: 17,
		lineHeight: 22,
		color: colors.text,
	},
	author: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	format: {
		...typography.caption,
		color: colors.muted,
	},
	progress: {
		...typography.bodySmall,
		color: colors.primaryDark,
		fontWeight: '600',
	},
	barTrack: {
		height: 6,
		borderRadius: radii.full,
		backgroundColor: colors.surfaceMuted,
		overflow: 'hidden',
	},
	barFill: {
		height: '100%',
		backgroundColor: colors.primary,
		borderRadius: radii.full,
	},
	chips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: spacing.xs,
	},
	chip: {
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radii.sm,
		backgroundColor: colors.surfaceMuted,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
		minHeight: 44,
		justifyContent: 'center',
	},
	chipPressed: {
		backgroundColor: colors.primarySoft,
	},
	chipDisabled: {
		opacity: 0.5,
	},
	chipLabel: {
		...typography.bodySmall,
		fontWeight: '600',
		color: colors.text,
	},
	detailsBlock: {
		gap: spacing.sm,
	},
})
