import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from './Button'
import { reportComponentError } from '../lib/error-reporting'

type Props = {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKey?: unknown
}

type State = {
  hasError: boolean
  error: Error | null
}

/**
 * Production-grade error boundary that prevents a rendering error in one
 * view from crashing the whole sales application.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    reportComponentError(error, errorInfo)
    try {
      this.props.onError?.(error, errorInfo)
    } catch {
      // A consumer callback is reporting infrastructure too; keep fallback alive.
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset)
      }
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-border bg-surface p-6 text-center shadow-elev-1"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-danger-subtle text-danger">
            <AlertCircle aria-hidden size={20} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-fg">Something went wrong</h3>
          <p className="mt-1 max-w-sm text-xs text-fg-muted">
            An unexpected error occurred while displaying this section.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={this.reset}
            className="mt-4 gap-1.5"
          >
            <RotateCcw aria-hidden size={14} />
            Try again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
