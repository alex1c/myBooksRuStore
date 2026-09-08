/**
 * Reusable banner slot — selects placement ID via central ads config.
 * Silent on failure; collapses reserved height when ad is unavailable.
 */

import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Dimensions, StyleSheet, View } from 'react-native'

import {
	ADS_BANNER_RESERVED_HEIGHT,
	ADS_BANNER_TOP_SPACING,
	type AdBannerGroup,
	resolveBannerAdUnitId,
} from '@/config/ads'
import { colors } from '@/constants/theme'

type BannerAdSizeLike = {
	width: number
	height: number
}

type BannerViewComponent = ComponentType<{
	size: BannerAdSizeLike
	adRequest: { adUnitId: string }
	onAdLoaded?: () => void
	onAdFailedToLoad?: () => void
	style?: object
}>

type YandexBannerModule = {
	BannerView: BannerViewComponent
	BannerAdSize: {
		stickySize: (width: number) => Promise<BannerAdSizeLike>
	}
}

function tryLoadBannerModule (): YandexBannerModule | null {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const mod = require('yandex-mobile-ads') as YandexBannerModule
		if (!mod?.BannerView || !mod?.BannerAdSize?.stickySize) {
			return null
		}
		return mod
	} catch {
		return null
	}
}

export interface AppBannerProps {
	/** Banner group from central config (never a raw R-M- id). */
	group: AdBannerGroup
	/** When false, render nothing (policy already decided). */
	visible?: boolean
	testID?: string
}

/**
 * Layout-safe sticky banner above the tab bar.
 * Does not overlay content; collapses when the ad fails or SDK is missing.
 */
export function AppBanner ({
	group,
	visible = true,
	testID = 'app-banner',
}: AppBannerProps) {
	const sdk = useMemo(() => tryLoadBannerModule(), [])
	const [adSize, setAdSize] = useState<BannerAdSizeLike | null>(null)
	const [loaded, setLoaded] = useState(false)
	const [failed, setFailed] = useState(false)

	useEffect(() => {
		if (!visible || !sdk) {
			return
		}
		let cancelled = false
		const width = Dimensions.get('window').width
		void sdk.BannerAdSize.stickySize(width)
			.then((size) => {
				if (!cancelled) {
					setAdSize(size)
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFailed(true)
				}
			})
		return () => {
			cancelled = true
		}
	}, [visible, group, sdk])

	if (!visible || !sdk || failed || !adSize) {
		return null
	}

	const BannerView = sdk.BannerView
	const adUnitId = resolveBannerAdUnitId(group)
	const reserved = Math.max(
		ADS_BANNER_RESERVED_HEIGHT,
		adSize.height || ADS_BANNER_RESERVED_HEIGHT,
	)

	return (
		<View
			testID={testID}
			style={[
				styles.wrap,
				{ minHeight: loaded ? reserved : ADS_BANNER_RESERVED_HEIGHT },
			]}
			// Ads have their own a11y tree; keep the shell out of primary navigation.
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
		>
			<BannerView
				size={adSize}
				adRequest={{ adUnitId }}
				onAdLoaded={() => setLoaded(true)}
				onAdFailedToLoad={() => {
					setFailed(true)
					setLoaded(false)
				}}
				style={styles.banner}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		width: '100%',
		marginTop: ADS_BANNER_TOP_SPACING,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.background,
		overflow: 'hidden',
	},
	banner: {
		alignSelf: 'center',
	},
})
