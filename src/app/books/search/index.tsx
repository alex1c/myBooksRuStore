import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'

import { CoverThumbnail } from '@/components/library/CoverThumbnail'
import {
	EmptyState,
	Screen,
	SecondaryButton,
	SectionHeader,
	TextField,
} from '@/components/ui'
import { appCopy, searchCopy } from '@/constants/copy'
import { colors, radii, spacing, typography } from '@/constants/theme'
import {
	searchBooks,
	type NormalizedBookCandidate,
} from '@/services/bookSearch'
import { setPendingSearchCandidate } from '@/services/bookSearch/pendingCandidate'
import { isNetworkError } from '@/services/network/httpClient'

type SearchState =
	| { kind: 'initial' }
	| { kind: 'loading' }
	| { kind: 'results'; items: NormalizedBookCandidate[] }
	| { kind: 'empty' }
	| { kind: 'error'; message: string }

/**
 * External catalogue search with debounce, abort, and offline-friendly errors.
 */
export default function BookSearchScreen () {
	const [query, setQuery] = useState('')
	const [state, setState] = useState<SearchState>({ kind: 'initial' })
	const requestIdRef = useRef(0)
	const abortRef = useRef<AbortController | null>(null)

	useEffect(() => {
		const trimmed = query.trim()
		const timer = setTimeout(() => {
			if (trimmed.length < 2) {
				abortRef.current?.abort()
				setState({ kind: 'initial' })
				return
			}

			const requestId = requestIdRef.current + 1
			requestIdRef.current = requestId
			abortRef.current?.abort()
			const controller = new AbortController()
			abortRef.current = controller
			setState({ kind: 'loading' })

			void searchBooks(trimmed, controller.signal)
				.then((items) => {
					if (requestId !== requestIdRef.current) {
						return
					}
					if (items.length === 0) {
						setState({ kind: 'empty' })
					} else {
						setState({ kind: 'results', items })
					}
				})
				.catch((error) => {
					if (requestId !== requestIdRef.current) {
						return
					}
					if (isNetworkError(error) && error.kind === 'abort') {
						return
					}
					setState({
						kind: 'error',
						message: searchCopy.networkErrorHint,
					})
				})
		}, trimmed.length < 2 ? 0 : 400)

		return () => {
			clearTimeout(timer)
		}
	}, [query])

	useEffect(() => {
		return () => {
			abortRef.current?.abort()
		}
	}, [])

	const openPreview = (item: NormalizedBookCandidate) => {
		setPendingSearchCandidate(item, 'search')
		router.push('/books/search/preview')
	}

	const retry = () => {
		const trimmed = query.trim()
		if (trimmed.length < 2) {
			return
		}
		const requestId = requestIdRef.current + 1
		requestIdRef.current = requestId
		abortRef.current?.abort()
		const controller = new AbortController()
		abortRef.current = controller
		setState({ kind: 'loading' })
		void searchBooks(trimmed, controller.signal)
			.then((items) => {
				if (requestId !== requestIdRef.current) {
					return
				}
				setState(
					items.length === 0
						? { kind: 'empty' }
						: { kind: 'results', items },
				)
			})
			.catch(() => {
				if (requestId !== requestIdRef.current) {
					return
				}
				setState({ kind: 'error', message: searchCopy.networkErrorHint })
			})
	}

	return (
		<Screen contentStyle={styles.content}>
			<SectionHeader title={searchCopy.title} />
			<TextField
				placeholder={searchCopy.placeholder}
				value={query}
				onChangeText={setQuery}
				autoCapitalize="sentences"
				autoCorrect={false}
				returnKeyType="search"
				onSubmitEditing={retry}
			/>
			<View style={styles.actions}>
				<SecondaryButton
					label={searchCopy.hubScanTitle}
					onPress={() => router.push('/books/scan')}
					style={styles.actionBtn}
				/>
				<SecondaryButton
					label={searchCopy.manualAdd}
					onPress={() => router.push('/books/add/manual')}
					style={styles.actionBtn}
				/>
			</View>

			{state.kind === 'initial' ? (
				<View style={styles.center}>
					<EmptyState
						icon="search-outline"
						title={searchCopy.initialTitle}
						description={searchCopy.initialHint}
					/>
				</View>
			) : null}

			{state.kind === 'loading' ? (
				<View style={styles.center} accessibilityRole="progressbar">
					<ActivityIndicator size="large" color={colors.primary} />
					<Text style={styles.loading}>{searchCopy.loading}</Text>
				</View>
			) : null}

			{state.kind === 'empty' ? (
				<View style={styles.center}>
					<EmptyState
						icon="search-outline"
						title={searchCopy.emptyTitle}
						description={searchCopy.emptyHint}
						actionLabel={searchCopy.manualAdd}
						onAction={() => router.push('/books/add/manual')}
					/>
				</View>
			) : null}

			{state.kind === 'error' ? (
				<View style={styles.center}>
					<EmptyState
						icon="cloud-offline-outline"
						title={searchCopy.networkErrorTitle}
						description={state.message}
						actionLabel={searchCopy.retry}
						onAction={retry}
						secondaryActionLabel={searchCopy.manualAdd}
						onSecondaryAction={() => router.push('/books/add/manual')}
					/>
				</View>
			) : null}

			{state.kind === 'results' ? (
				<FlatList
					data={state.items}
					keyExtractor={(item) => item.resultId}
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={styles.list}
					renderItem={({ item }) => (
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`${item.title}, ${item.authorText || appCopy.authorUnknown}`}
							onPress={() => openPreview(item)}
							style={({ pressed }) => [
								styles.resultCard,
								pressed && styles.pressed,
							]}
						>
							<CoverThumbnail
								title={item.title}
								coverUri={item.coverUrl}
								size={52}
							/>
							<View style={styles.resultBody}>
								<Text style={styles.resultTitle} numberOfLines={2}>
									{item.title}
								</Text>
								<Text style={styles.resultAuthor} numberOfLines={1}>
									{item.authorText.trim() || appCopy.authorUnknown}
								</Text>
								<Text style={styles.resultMeta} numberOfLines={1}>
									{[
										item.publishedYear,
										item.pageCount ? `${item.pageCount} стр.` : null,
										item.publisher,
									]
										.filter(Boolean)
										.join(' · ')}
								</Text>
							</View>
							<Text style={styles.addHint}>{searchCopy.add}</Text>
						</Pressable>
					)}
					ListFooterComponent={
						<Text style={styles.attribution}>{searchCopy.attribution}</Text>
					}
				/>
			) : null}
		</Screen>
	)
}

const styles = StyleSheet.create({
	content: {
		flex: 1,
		paddingBottom: 0,
		gap: spacing.sm,
	},
	actions: {
		flexDirection: 'row',
		gap: spacing.xs,
	},
	actionBtn: {
		flex: 1,
	},
	center: {
		flex: 1,
		justifyContent: 'center',
		paddingVertical: spacing.lg,
	},
	loading: {
		...typography.body,
		color: colors.textSecondary,
		marginTop: spacing.sm,
		textAlign: 'center',
	},
	list: {
		paddingBottom: spacing.xl,
		gap: spacing.sm,
	},
	resultCard: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.sm,
		padding: spacing.sm,
		backgroundColor: colors.surface,
		borderRadius: radii.lg,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.border,
	},
	pressed: {
		backgroundColor: colors.surfaceMuted,
	},
	resultBody: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	resultTitle: {
		...typography.section,
		fontSize: 16,
		lineHeight: 22,
	},
	resultAuthor: {
		...typography.bodySmall,
		color: colors.textSecondary,
	},
	resultMeta: {
		...typography.caption,
		color: colors.muted,
	},
	addHint: {
		...typography.bodySmall,
		color: colors.primary,
		fontWeight: '700',
	},
	attribution: {
		...typography.caption,
		color: colors.muted,
		textAlign: 'center',
		marginTop: spacing.md,
	},
})
