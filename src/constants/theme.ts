/**
 * Design tokens for «Дневник чтения».
 * Calm reading-friendly palette: soft sage, clean surfaces, low visual noise.
 * Theme tokens are centralized so a future dark mode can swap values without
 * touching screen-level magic numbers.
 */

export const colors = {
	primary: '#2F6F5E',
	primaryDark: '#245649',
	primarySoft: '#E4F0EB',
	secondary: '#4F6B8A',
	background: '#F5F7F6',
	surface: '#FFFFFF',
	surfaceMuted: '#EEF2F0',
	border: '#D9E0DC',
	text: '#1C2430',
	textSecondary: '#5C6670',
	textInverse: '#FFFFFF',
	success: '#2F9E6B',
	warning: '#C4922A',
	danger: '#C04545',
	muted: '#8A9590',
	overlay: 'rgba(28, 36, 48, 0.45)',
	focus: '#2F6F5E',
} as const

export const spacing = {
	xxs: 4,
	xs: 8,
	sm: 12,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
} as const

export const radii = {
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	full: 999,
} as const

export const typography = {
	title: {
		fontSize: 28,
		lineHeight: 34,
		fontWeight: '700' as const,
		color: colors.text,
	},
	subtitle: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: '500' as const,
		color: colors.textSecondary,
	},
	section: {
		fontSize: 18,
		lineHeight: 24,
		fontWeight: '600' as const,
		color: colors.text,
	},
	body: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: '400' as const,
		color: colors.text,
	},
	bodySmall: {
		fontSize: 14,
		lineHeight: 20,
		fontWeight: '400' as const,
		color: colors.textSecondary,
	},
	caption: {
		fontSize: 12,
		lineHeight: 16,
		fontWeight: '500' as const,
		color: colors.muted,
	},
	button: {
		fontSize: 16,
		lineHeight: 20,
		fontWeight: '600' as const,
	},
} as const

/** Minimum comfortable touch target size (Android accessibility). */
export const touchTarget = {
	min: 48,
} as const

export const shadows = {
	card: {
		shadowColor: '#1C2430',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.05,
		shadowRadius: 3,
		elevation: 1,
	},
} as const

export type AppColors = typeof colors
