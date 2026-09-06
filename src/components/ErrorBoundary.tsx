import { Component, ErrorInfo, ReactNode } from 'react'

import { ErrorState } from '@/components/ui'
import { logger } from '@/services/logging'

interface Props {
	children: ReactNode
}

interface State {
	hasError: boolean
}

/**
 * Catches unexpected render errors and shows a recoverable Russian fallback.
 */
export class AppErrorBoundary extends Component<Props, State> {
	state: State = { hasError: false }

	static getDerivedStateFromError (): State {
		return { hasError: true }
	}

	componentDidCatch (error: Error, info: ErrorInfo) {
		logger.error('Unhandled render error', error, {
			componentStack: info.componentStack,
		})
	}

	private handleRetry = () => {
		this.setState({ hasError: false })
	}

	render () {
		if (this.state.hasError) {
			return (
				<ErrorState
					title="Что-то пошло не так"
					message="Произошла непредвиденная ошибка. Попробуйте продолжить работу."
					actionLabel="Продолжить"
					onRetry={this.handleRetry}
				/>
			)
		}

		return this.props.children
	}
}
