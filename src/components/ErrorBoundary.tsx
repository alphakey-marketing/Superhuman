import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack)
  }

  handleReload = () => {
    // Clear state and attempt re-render; if the error persists, the boundary
    // will catch it again and the reload button will remain.
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-gray-900 border border-red-900/50 rounded-2xl p-6 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <div>
              <h2 className="text-white font-semibold text-lg">Something went wrong</h2>
              <p className="text-gray-400 text-sm mt-1">
                An unexpected error occurred. Your data is safe — this is a display issue only.
              </p>
            </div>
            {this.state.error && (
              <p className="text-red-400/70 text-xs font-mono bg-red-950/30 rounded-xl px-3 py-2 text-left break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-xl font-medium transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 border border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white text-sm rounded-xl transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
