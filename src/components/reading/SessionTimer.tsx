import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { colors, typography } from '@/constants/theme'
import {
	elapsedSecondsFromStart,
	formatSessionTimer,
} from '@/utils/sessionTimer'

interface SessionTimerProps {
	/** ISO timestamp — source of truth for elapsed time. */
	startedAt: string
	/** Tick interval in ms (UI only; does not write to DB). */
	tickMs?: number
}

/**
 * Isolated timer display so parent screens do not re-render every second.
 * Elapsed is always derived from wall-clock: now - startedAt.
 */
export function SessionTimer ({ startedAt, tickMs = 1000 }: SessionTimerProps) {
	const [nowMs, setNowMs] = useState(() => Date.now())

	useEffect(() => {
		const id = setInterval(() => {
			setNowMs(Date.now())
		}, tickMs)
		return () => clearInterval(id)
	}, [tickMs])

	const elapsed = elapsedSecondsFromStart(startedAt, nowMs)

	return (
		<View style={styles.wrap} accessibilityRole="timer">
			<Text style={styles.timer}>{formatSessionTimer(elapsed)}</Text>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	timer: {
		...typography.title,
		fontVariant: ['tabular-nums'],
		color: colors.primaryDark,
		letterSpacing: 1,
	},
})
