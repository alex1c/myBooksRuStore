import { useCallback, useEffect, useState } from 'react'

import { useDatabase } from '@/context/DatabaseContext'
import {
	getLibraryStatusCounts,
	listLibraryBooks,
	type LibraryQuery,
	type LibraryStatusFilter,
} from '@/domain/libraryService'
import type { LibrarySort } from '@/constants/domain'
import type { LibraryBookItem, LibraryStatusCounts } from '@/db/types'

const EMPTY_COUNTS: LibraryStatusCounts = {
	all: 0,
	WANT_TO_READ: 0,
	READING: 0,
	FINISHED: 0,
	PAUSED: 0,
	ABANDONED: 0,
}

/**
 * Loads library list with debounced search; keeps filter/sort independent.
 */
export function useLibraryList (initial?: Partial<LibraryQuery>) {
	const { executor } = useDatabase()
	const [searchInput, setSearchInput] = useState(initial?.search ?? '')
	const [debouncedSearch, setDebouncedSearch] = useState(initial?.search ?? '')
	const [status, setStatus] = useState<LibraryStatusFilter>(
		initial?.status ?? 'ALL',
	)
	const [sort, setSort] = useState<LibrarySort>(
		initial?.sort ?? 'RECENTLY_UPDATED',
	)
	const [shelfId, setShelfId] = useState<string | null>(
		initial?.shelfId ?? null,
	)
	const [items, setItems] = useState<LibraryBookItem[]>([])
	const [counts, setCounts] = useState<LibraryStatusCounts>(EMPTY_COUNTS)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [reloadToken, setReloadToken] = useState(0)

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearch(searchInput.trim())
		}, 250)
		return () => clearTimeout(timer)
	}, [searchInput])

	const reload = useCallback(() => {
		setReloadToken((value) => value + 1)
	}, [])

	useEffect(() => {
		let cancelled = false
		async function load () {
			try {
				setLoading(true)
				setError(null)
				const [list, nextCounts] = await Promise.all([
					listLibraryBooks(executor, {
						search: debouncedSearch,
						status,
						sort,
						shelfId,
					}),
					getLibraryStatusCounts(executor),
				])
				if (cancelled) {
					return
				}
				setItems(list)
				setCounts(nextCounts)
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : 'load_failed')
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}
		void load()
		return () => {
			cancelled = true
		}
	}, [executor, debouncedSearch, status, sort, shelfId, reloadToken])

	return {
		items,
		counts,
		loading,
		error,
		searchInput,
		setSearchInput,
		status,
		setStatus,
		sort,
		setSort,
		shelfId,
		setShelfId,
		reload,
	}
}
