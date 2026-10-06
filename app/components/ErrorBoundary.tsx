'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getEnv } from '@/lib/utils/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Error logging handled by error boundary - no console pollution needed

    this.setState({
      error,
      errorInfo,
    });

    // Log to analytics or error reporting service
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'exception', {
        description: error.message,
        fatal: true,
        error_boundary: true,
      });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>
            We&apos;re sorry, but something unexpected happened. Please try refreshing the page.
          </p>

          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-gray-500 text-white rounded-sm hover:bg-gray-600 transition-colors"
            >
              Reload Page
            </button>
          </div>

          {getEnv('NODE_ENV') === 'development' && this.state.error && (
            <details className="mt-4 p-4 bg-gray-100 rounded-sm text-left">
              <summary className="cursor-pointer font-semibold">
                Error Details (Development)
              </summary>
              <pre className="mt-2 text-sm overflow-auto">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for different contexts
export function APIErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
            API Error
          </h3>
          <p className="text-yellow-600 dark:text-yellow-400">
            There was an issue loading data from the API. Please try again later.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Component Error
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            This component failed to load. Other parts of the page should still work.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
