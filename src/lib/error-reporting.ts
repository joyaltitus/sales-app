import type { ErrorInfo } from 'react'

export interface ErrorReporter {
  capture(error: Error, context: { componentStack?: string | null }): void
}

let reporter: ErrorReporter | null = null

/** Install the application's monitoring adapter at bootstrap time. */
export function setErrorReporter(next: ErrorReporter | null) {
  reporter = next
}

export function reportComponentError(error: Error, errorInfo: ErrorInfo) {
  try {
    reporter?.capture(error, { componentStack: errorInfo.componentStack })
  } catch {
    // Error reporting is best-effort and must never escape an error boundary.
  }
}
