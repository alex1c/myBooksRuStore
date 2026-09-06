/** @type {import('eslint').Linter.Config[]} */
const expoConfig = require('eslint-config-expo/flat')

module.exports = [
	...expoConfig,
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'.expo/**',
			'android/**',
			'ios/**',
			'scripts/**',
		],
	},
	{
		rules: {
			// Screens intentionally use StyleSheet with centralized design tokens.
			'react/display-name': 'off',
		},
	},
]
