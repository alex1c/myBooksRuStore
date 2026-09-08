/** @type {import('jest').Config} */
const config = {
	preset: 'jest-expo',
	testMatch: ['**/__tests__/**/*.test.ts'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/src/$1',
		'^@appmetrica/react-native-analytics$':
			'<rootDir>/__mocks__/@appmetrica/react-native-analytics.ts',
		'^yandex-mobile-ads$': '<rootDir>/__mocks__/yandex-mobile-ads.ts',
	},
	transformIgnorePatterns: [
		'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)',
	],
}

module.exports = config
