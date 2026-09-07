/**
 * OCR engine selection notes (Phase 11) — imported by docs/tests if needed.
 *
 * Package: react-native-executorch@0.9.3 (+ expo resource fetcher 0.9.1)
 * Why: ML Kit on-device has no Cyrillic; OCR_RUSSIAN covers RU + Latin glyphs.
 * Photos stay on-device; first launch may download model binaries (not images).
 * Requires custom native / EAS / prebuild (not Expo Go).
 */

export const OCR_ENGINE_INFO = {
	packageName: 'react-native-executorch',
	packageVersion: '0.9.3',
	resourceFetcher: 'react-native-executorch-expo-resource-fetcher@0.9.1',
	model: 'OCR_RUSSIAN',
	localInference: true,
	cloudPhotoUpload: false,
	russianSupport: true,
	englishSupport: true,
	expoSdk57: true,
	requiresNativeRebuild: true,
	expoGoSupported: false,
} as const
