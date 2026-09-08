/**
 * Jest mock for Yandex Mobile Ads — no Android runtime required.
 */

import React from 'react'
import { View } from 'react-native'

export const MobileAds = {
	initialize: jest.fn(async () => undefined),
	enableLogging: jest.fn(),
	pluginVersion: 'mock',
}

export class InterstitialAdLoader {
	static async create () {
		return new InterstitialAdLoader()
	}

	async loadAd (_params: { adUnitId: string }) {
		return {
			show: jest.fn(),
			onAdShown: null as (() => void) | null,
			onAdFailedToShow: null as ((error?: unknown) => void) | null,
			onAdDismissed: null as (() => void) | null,
		}
	}
}

export const BannerAdSize = {
	async stickySize (width: number) {
		return { width, height: 50, initialWidth: width, initialHeight: 50 }
	},
	async inlineSize (width: number, height: number) {
		return { width, height, initialWidth: width, initialHeight: height }
	},
}

export default function BannerView () {
	return React.createElement(View, { testID: 'mock-yandex-banner' })
}

export { BannerView }
