/**
 * Year in Books — emotional annual recap (Phase 8).
 * Aggregate is loaded once per selected year; slides only present data.
 */

import { Stack, router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
	ActivityIndicator,
	Dimensions,
	FlatList,
	Pressable,
	Share,
	StyleSheet,
	Text,
	View,
	type ViewToken,
} from 'react-native'
import type { RefObject } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'

import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import { YearActivityHeatmap } from '@/components/year/YearActivityHeatmap'
import { YearShareCard } from '@/components/year/YearShareCard'
import { EmptyState, PrimaryButton } from '@/components/ui'
import { yearInBooksCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import { useDatabase } from '@/context/DatabaseContext'
import {
	buildYearShareCardModel,
	getYearInBooks,
	getYearInBooksBounds,
	type YearInBooks,
} from '@/domain/yearInBooksService'
import {
	formatBooksCount,
	formatDaysCount,
	formatHoursCount,
	formatIntegerRu,
	formatPagesCount,
	formatRatingRu,
	formatStatsDuration,
} from '@/utils/format'

type SlideId =
	| 'cover'
	| 'numbers'
	| 'pace'
	| 'month'
	| 'books'
	| 'insights'
	| 'activity'
	| 'notes'
	| 'share'

interface Slide {
	id: SlideId
	visible: boolean
}

function buildSlides (year: YearInBooks | null): Slide[] {
	if (!year || !year.hasData) {
		return [{ id: 'cover', visible: true }]
	}
	const noteTotal =
		year.notes.QUOTE + year.notes.THOUGHT + year.notes.NOTE
	const slides: Slide[] = [
		{ id: 'cover', visible: true },
		{ id: 'numbers', visible: true },
		{
			id: 'pace',
			visible:
				year.averages.secondsPerActiveDay != null ||
				year.averages.pagesPerActiveDay != null ||
				(year.sessions.count > 0 && year.sessions.maxSeconds != null),
		},
		{
			id: 'month',
			visible: !!(year.bestMonthByTime || year.bestMonthByPages),
		},
		{ id: 'books', visible: year.topBooks.length > 0 },
		{
			id: 'insights',
			visible: !!(
				year.topAuthor ||
				year.favoriteFormat ||
				year.ratings.average != null ||
				year.favoriteBook ||
				year.longestBook
			),
		},
		{
			id: 'activity',
			visible: year.activeDays > 0 || year.bestStreakInYear > 0,
		},
		{ id: 'notes', visible: noteTotal > 0 },
		{ id: 'share', visible: true },
	]
	return slides.filter((s) => s.visible)
}

/**
 * Horizontal paging story for one calendar year.
 */
export default function YearInBooksScreen () {
	const { executor } = useDatabase()
	const insets = useSafeAreaInsets()
	const width = Dimensions.get('window').width
	const nowYear = useMemo(() => new Date().getFullYear(), [])
	const [year, setYear] = useState(nowYear)
	const [bounds, setBounds] = useState({ minYear: nowYear, maxYear: nowYear })
	const [model, setModel] = useState<YearInBooks | null>(null)
	const [loading, setLoading] = useState(true)
	const [index, setIndex] = useState(0)
	const [sharing, setSharing] = useState(false)
	const shareCardRef = useRef<View>(null)
	const listRef = useRef<FlatList<Slide>>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const [b, data] = await Promise.all([
				getYearInBooksBounds(executor),
				getYearInBooks(executor, year),
			])
			setBounds(b)
			setModel(data)
			setIndex(0)
			listRef.current?.scrollToOffset({ offset: 0, animated: false })
		} finally {
			setLoading(false)
		}
	}, [executor, year])

	useFocusEffect(
		useCallback(() => {
			void load()
		}, [load]),
	)

	const slides = useMemo(() => buildSlides(model), [model])

	const shareModel = useMemo(() => {
		if (!model) {
			return null
		}
		return buildYearShareCardModel(model, {
			books: formatBooksCount,
			pages: formatPagesCount,
			hours: formatHoursCount,
			days: formatDaysCount,
			streak: (n) => `${formatIntegerRu(n)} ${n === 1 ? 'день' : n < 5 ? 'дня' : 'дней'}`,
		})
	}, [model])

	const handleShare = async () => {
		if (!shareModel) {
			return
		}
		setSharing(true)
		try {
			const canShareFile = await Sharing.isAvailableAsync()
			if (canShareFile && shareCardRef.current) {
				const uri = await captureRef(shareCardRef, {
					format: 'png',
					quality: 1,
					result: 'tmpfile',
				})
				const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`
				await Sharing.shareAsync(fileUri, {
					mimeType: 'image/png',
					dialogTitle: shareModel.title,
				})
				return
			}
			await Share.share({ message: shareModel.textFallback })
		} catch {
			try {
				await Share.share({ message: shareModel.textFallback })
			} catch {
				// User cancelled or share unavailable — ignore.
			}
		} finally {
			setSharing(false)
		}
	}

	const onViewableItemsChanged = useCallback(
		({ viewableItems }: { viewableItems: ViewToken[] }) => {
			const first = viewableItems[0]
			if (first?.index != null) {
				setIndex(first.index)
			}
		},
		[],
	)

	const renderSlide = ({ item }: { item: Slide }) => (
		<View style={[styles.slide, { width, paddingTop: insets.top + 56 }]}>
			{loading && !model ? (
				<ActivityIndicator color={colors.primary} />
			) : (
				<SlideBody
					id={item.id}
					year={year}
					model={model}
					shareModel={shareModel}
					shareCardRef={shareCardRef}
					sharing={sharing}
					onShare={() => {
						void handleShare()
					}}
				/>
			)}
		</View>
	)

	return (
		<View style={styles.root}>
			<Stack.Screen options={{ headerShown: false }} />
			<View
				style={[
					styles.topBar,
					{ paddingTop: insets.top + spacing.xs },
				]}
			>
				<Pressable
					onPress={() => router.back()}
					hitSlop={10}
					accessibilityRole="button"
					accessibilityLabel={yearInBooksCopy.back}
				>
					<Text style={styles.back}>{yearInBooksCopy.back}</Text>
				</Pressable>
				<View style={styles.yearNav}>
					<Pressable
						onPress={() =>
							setYear((y) => Math.max(bounds.minYear, y - 1))
						}
						disabled={year <= bounds.minYear}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Предыдущий год"
					>
						<Text
							style={[
								styles.yearBtn,
								year <= bounds.minYear && styles.yearBtnDisabled,
							]}
						>
							‹
						</Text>
					</Pressable>
					<Text style={styles.yearLabel}>{year}</Text>
					<Pressable
						onPress={() =>
							setYear((y) => Math.min(bounds.maxYear, y + 1))
						}
						disabled={year >= bounds.maxYear}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel="Следующий год"
					>
						<Text
							style={[
								styles.yearBtn,
								year >= bounds.maxYear && styles.yearBtnDisabled,
							]}
						>
							›
						</Text>
					</Pressable>
				</View>
				<Text style={styles.pager}>
					{index + 1}/{slides.length}
				</Text>
			</View>

			<FlatList
				ref={listRef}
				data={slides}
				keyExtractor={(s) => s.id}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				renderItem={renderSlide}
				onViewableItemsChanged={onViewableItemsChanged}
				viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
				getItemLayout={(_, i) => ({
					length: width,
					offset: width * i,
					index: i,
				})}
				extraData={{ model, loading, sharing }}
			/>

			<View style={[styles.dots, { paddingBottom: insets.bottom + 12 }]}>
				{slides.map((s, i) => (
					<View
						key={s.id}
						style={[styles.dot, i === index && styles.dotActive]}
					/>
				))}
			</View>
		</View>
	)
}

function SlideBody ({
	id,
	year,
	model,
	shareModel,
	shareCardRef,
	sharing,
	onShare,
}: {
	id: SlideId
	year: number
	model: YearInBooks | null
	shareModel: ReturnType<typeof buildYearShareCardModel> | null
	shareCardRef: RefObject<View | null>
	sharing: boolean
	onShare: () => void
}) {
	if (!model || !model.hasData) {
		if (id === 'cover') {
			return (
				<EmptyState
					icon="book-outline"
					title={yearInBooksCopy.emptyTitle(year)}
					description={yearInBooksCopy.emptyDescription}
				/>
			)
		}
		return null
	}

	if (id === 'cover') {
		return (
			<View style={styles.centerBlock}>
				<Text style={styles.kicker}>{yearInBooksCopy.brand}</Text>
				<Text style={styles.hero}>{yearInBooksCopy.coverTitle(year)}</Text>
				<Text style={styles.sub}>{yearInBooksCopy.coverSubtitle}</Text>
			</View>
		)
	}

	if (id === 'numbers') {
		return (
			<View style={styles.centerBlock}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.numbersTitle}</Text>
				{model.completedBooks > 0 ? (
					<Text style={styles.bigStat}>
						{formatBooksCount(model.completedBooks)}
					</Text>
				) : null}
				{model.pages.hasObservations && model.pages.value > 0 ? (
					<Text style={styles.bigStat}>
						{formatPagesCount(model.pages.value)}
					</Text>
				) : null}
				{model.readingTime.hasObservations && model.readingTime.value > 0 ? (
					<Text style={styles.bigStat}>
						{formatHoursCount(model.readingTime.value)}
					</Text>
				) : null}
				{model.activeDays > 0 ? (
					<Text style={styles.bigStat}>
						{formatDaysCount(model.activeDays)}
					</Text>
				) : null}
				{model.yearPrecisionBooks > 0 ? (
					<Text style={styles.hint}>
						{yearInBooksCopy.yearPrecisionHint(model.yearPrecisionBooks)}
					</Text>
				) : null}
			</View>
		)
	}

	if (id === 'pace') {
		return (
			<View style={styles.centerBlock}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.paceTitle}</Text>
				{model.averages.secondsPerActiveDay != null ? (
					<>
						<Text style={styles.bigStat}>
							{formatStatsDuration(model.averages.secondsPerActiveDay)}
						</Text>
						<Text style={styles.sub}>{yearInBooksCopy.avgPerActiveDay}</Text>
					</>
				) : null}
				{model.averages.pagesPerActiveDay != null ? (
					<>
						<Text style={styles.midStat}>
							{formatIntegerRu(model.averages.pagesPerActiveDay)} стр.
						</Text>
						<Text style={styles.sub}>{yearInBooksCopy.avgPagesPerDay}</Text>
					</>
				) : null}
				{model.sessions.count > 0 && model.sessions.maxSeconds != null ? (
					<>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.longestSession}
						</Text>
						<Text style={styles.midStat}>
							{formatStatsDuration(model.sessions.maxSeconds)}
						</Text>
						<Text style={styles.sub}>
							{yearInBooksCopy.sessionsTotal(model.sessions.count)}
						</Text>
					</>
				) : null}
			</View>
		)
	}

	if (id === 'month') {
		const primary =
			model.bestMonthByTime ?? model.bestMonthByPages
		const secondary =
			model.bestMonthByTime &&
			model.bestMonthByPages &&
			model.bestMonthByTime.monthIndex !== model.bestMonthByPages.monthIndex
				? model.bestMonthByPages
				: null
		return (
			<View style={styles.centerBlock}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.monthTitle}</Text>
				{primary ? (
					<>
						<Text style={styles.heroMonth}>{primary.label}</Text>
						<Text style={styles.sub}>
							{primary.criterion === 'time'
								? yearInBooksCopy.monthByTime
								: yearInBooksCopy.monthByPages}
						</Text>
						{primary.seconds > 0 ? (
							<Text style={styles.midStat}>
								{formatStatsDuration(primary.seconds)}
							</Text>
						) : null}
						{primary.pages > 0 ? (
							<Text style={styles.midStat}>
								{formatPagesCount(primary.pages)}
							</Text>
						) : null}
						{primary.booksExact > 0 ? (
							<Text style={styles.midStat}>
								{formatBooksCount(primary.booksExact)}
							</Text>
						) : null}
					</>
				) : null}
				{secondary ? (
					<Text style={styles.hint}>
						{yearInBooksCopy.monthSecondary(
							secondary.label,
							formatPagesCount(secondary.pages),
						)}
					</Text>
				) : null}
			</View>
		)
	}

	if (id === 'books') {
		return (
			<View style={styles.block}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.topBooksTitle}</Text>
				<Text style={styles.sub}>
					{model.topBooks[0]?.rankBy === 'pages'
						? yearInBooksCopy.topBooksByPages
						: yearInBooksCopy.topBooksByTime}
				</Text>
				{model.topBooks.map((book, i) => (
					<View key={book.libraryEntryId} style={styles.bookRow}>
						<CoverThumbnail
							title={book.title}
							coverUri={book.coverUri}
							size={48}
						/>
						<View style={styles.bookText}>
							<Text style={styles.bookTitle} numberOfLines={2}>
								{i + 1}. {book.title}
							</Text>
							<Text style={styles.sub} numberOfLines={1}>
								{book.rankBy === 'time'
									? formatStatsDuration(book.durationSeconds)
									: formatPagesCount(book.pagesInYear ?? 0)}
							</Text>
						</View>
					</View>
				))}
			</View>
		)
	}

	if (id === 'insights') {
		return (
			<View style={styles.block}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.insightsTitle}</Text>
				{model.topAuthor ? (
					<>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.topAuthor}
						</Text>
						<Text style={styles.midStat} numberOfLines={2}>
							{model.topAuthor.authorText}
						</Text>
						<Text style={styles.sub}>
							{formatBooksCount(model.topAuthor.bookCount)}
						</Text>
					</>
				) : null}
				{model.favoriteFormat ? (
					<>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.favoriteFormat}
						</Text>
						<Text style={styles.midStat}>{model.favoriteFormat.label}</Text>
						<Text style={styles.sub}>
							{formatBooksCount(model.favoriteFormat.count)}
						</Text>
					</>
				) : null}
				{model.ratings.average != null ? (
					<>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.avgRating}
						</Text>
						<Text style={styles.midStat}>
							{formatRatingRu(model.ratings.average)}
						</Text>
					</>
				) : null}
				{model.favoriteBook ? (
					<>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.highestRated}
						</Text>
						<Text style={styles.midStat} numberOfLines={2}>
							{model.favoriteBook.title}
						</Text>
						<Text style={styles.sub}>
							{formatRatingRu(model.favoriteBook.rating)}
						</Text>
					</>
				) : null}
				{model.longestBook ? (
					<>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.longestBook}
						</Text>
						<Text style={styles.midStat} numberOfLines={2}>
							{model.longestBook.title}
						</Text>
						<Text style={styles.sub}>
							{formatPagesCount(model.longestBook.pageCount)}
						</Text>
					</>
				) : null}
			</View>
		)
	}

	if (id === 'activity') {
		return (
			<View style={styles.block}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.activityTitle}</Text>
				{model.activeDays > 0 ? (
					<Text style={styles.bigStat}>
						{formatDaysCount(model.activeDays)}
					</Text>
				) : null}
				{model.bestStreakInYear > 0 ? (
					<Text style={styles.midStat}>
						{yearInBooksCopy.bestStreak(model.bestStreakInYear)}
					</Text>
				) : null}
				<YearActivityHeatmap year={year} days={model.activityDays} />
			</View>
		)
	}

	if (id === 'notes') {
		return (
			<View style={styles.block}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.notesTitle}</Text>
				{model.notes.QUOTE > 0 ? (
					<Text style={styles.midStat}>
						{yearInBooksCopy.quotes(model.notes.QUOTE)}
					</Text>
				) : null}
				{model.notes.THOUGHT > 0 ? (
					<Text style={styles.midStat}>
						{yearInBooksCopy.thoughts(model.notes.THOUGHT)}
					</Text>
				) : null}
				{model.notes.NOTE > 0 ? (
					<Text style={styles.midStat}>
						{yearInBooksCopy.notes(model.notes.NOTE)}
					</Text>
				) : null}
				{model.quoteSample ? (
					<View style={styles.quoteBox}>
						<Text style={styles.sectionLabel}>
							{yearInBooksCopy.quoteSample}
						</Text>
						<Text style={styles.quoteText}>«{model.quoteSample.text}»</Text>
						<Text style={styles.sub}>{model.quoteSample.bookTitle}</Text>
					</View>
				) : null}
			</View>
		)
	}

	if (id === 'share' && shareModel) {
		return (
			<View style={styles.block}>
				<Text style={styles.slideTitle}>{yearInBooksCopy.shareTitle}</Text>
				<YearShareCard ref={shareCardRef} model={shareModel} />
				<PrimaryButton
					label={sharing ? yearInBooksCopy.sharing : yearInBooksCopy.share}
					onPress={onShare}
					disabled={sharing}
					style={styles.shareBtn}
				/>
			</View>
		)
	}

	return null
}

const styles = StyleSheet.create({
	root: {
		flex: 1,
		backgroundColor: colors.background,
	},
	topBar: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		zIndex: 2,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.md,
		paddingBottom: spacing.xs,
	},
	back: {
		...typography.bodySmall,
		fontWeight: '700',
		color: colors.primary,
		minWidth: 64,
	},
	yearNav: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
	},
	yearBtn: {
		fontSize: 28,
		color: colors.primary,
		fontWeight: '600',
		paddingHorizontal: 4,
	},
	yearBtnDisabled: {
		opacity: 0.3,
	},
	yearLabel: {
		...typography.section,
		color: colors.text,
	},
	pager: {
		...typography.caption,
		color: colors.muted,
		minWidth: 40,
		textAlign: 'right',
	},
	slide: {
		flex: 1,
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xxl,
		justifyContent: 'center',
	},
	centerBlock: {
		gap: spacing.sm,
		alignItems: 'flex-start',
	},
	block: {
		gap: spacing.sm,
	},
	kicker: {
		...typography.caption,
		color: colors.primary,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	hero: {
		...typography.title,
		fontSize: 34,
		lineHeight: 40,
		color: colors.text,
	},
	heroMonth: {
		...typography.title,
		fontSize: 40,
		color: colors.primaryDark,
	},
	sub: {
		...typography.body,
		color: colors.textSecondary,
	},
	slideTitle: {
		...typography.section,
		color: colors.textSecondary,
		marginBottom: spacing.xs,
	},
	bigStat: {
		...typography.title,
		fontSize: 32,
		lineHeight: 38,
		color: colors.primaryDark,
	},
	midStat: {
		...typography.title,
		fontSize: 24,
		color: colors.text,
	},
	sectionLabel: {
		...typography.caption,
		color: colors.muted,
		marginTop: spacing.sm,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	hint: {
		...typography.bodySmall,
		color: colors.muted,
		marginTop: spacing.sm,
	},
	bookRow: {
		flexDirection: 'row',
		gap: spacing.sm,
		alignItems: 'center',
		marginTop: spacing.sm,
	},
	bookText: {
		flex: 1,
		gap: 2,
	},
	bookTitle: {
		...typography.body,
		fontWeight: '700',
		color: colors.text,
	},
	quoteBox: {
		marginTop: spacing.md,
		padding: spacing.md,
		borderRadius: radii.md,
		backgroundColor: colors.surfaceMuted,
		gap: spacing.xs,
	},
	quoteText: {
		...typography.body,
		fontStyle: 'italic',
		color: colors.text,
	},
	shareBtn: {
		marginTop: spacing.md,
	},
	dots: {
		flexDirection: 'row',
		justifyContent: 'center',
		gap: 6,
	},
	dot: {
		width: 7,
		height: 7,
		borderRadius: 4,
		backgroundColor: colors.border,
	},
	dotActive: {
		backgroundColor: colors.primary,
		width: 16,
	},
})
