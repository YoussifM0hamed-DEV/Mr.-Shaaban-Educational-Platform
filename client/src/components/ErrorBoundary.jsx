import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Catches a render error anywhere below it and shows a readable screen instead
 * of a blank page, so a single broken component never hides the whole platform.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the detail in the console for whoever is debugging.
    console.error('Unhandled UI error:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-5 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-8 shadow-card">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </span>

          <h1 className="mt-5 text-xl font-bold text-ink-900">This page could not be displayed</h1>
          <p className="mt-2 text-sm text-ink-600">
            Something went wrong while drawing this screen. Your work is safe. Try reloading, and
            if it keeps happening, tell whoever maintains the platform what you were doing.
          </p>

          {isDev ? (
            <pre className="mt-4 max-h-48 overflow-auto rounded-xl bg-ink-900 p-3 text-xs text-rose-300">
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Reload the page
            </button>
            <a href="/" className="btn-secondary">
              <Home className="h-4 w-4" />
              Go to the home page
            </a>
          </div>
        </div>
      </div>
    );
  }
}
