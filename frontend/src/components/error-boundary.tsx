'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    // Log the error
    logger.error('Error Boundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      level: this.props.level || 'component',
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // In development, also log to console for debugging
    if (process.env.NODE_ENV === 'development') {
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI based on error level
      const { level = 'component' } = this.props;
      const { error } = this.state;

      if (level === 'critical') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Card className="w-full max-w-md mx-4">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <CardTitle className="text-red-600 dark:text-red-400">
                  Critical Error
                </CardTitle>
                <CardDescription>
                  The application has encountered a critical error and needs to be restarted.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {process.env.NODE_ENV === 'development' && error && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-3">
                    <p className="text-sm text-red-700 dark:text-red-300 font-mono">
                      {error.message}
                    </p>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button onClick={() => window.location.reload()} className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload Application
                  </Button>
                  <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                    <Home className="w-4 h-4 mr-2" />
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      if (level === 'page') {
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                <Bug className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Page Error
              </h2>
              <p className="text-gray-600 dark:text-gray-400 max-w-md">
                This page encountered an error and couldn't be displayed properly.
              </p>
            </div>
            
            {process.env.NODE_ENV === 'development' && error && (
              <Card className="w-full max-w-2xl">
                <CardHeader>
                  <CardTitle className="text-sm">Debug Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-auto max-h-40">
                    {error.stack}
                  </pre>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button onClick={this.handleRetry} variant="default">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={this.handleGoHome} variant="outline">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </div>
          </div>
        );
      }

      // Component level error (default)
      return (
        <div className="border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/10 rounded-md p-4 m-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Component Error
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                This component encountered an error and couldn't be displayed.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleRetry}
              className="ml-auto"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
          
          {process.env.NODE_ENV === 'development' && error && (
            <div className="mt-3 text-xs bg-yellow-100 dark:bg-yellow-900/20 p-2 rounded font-mono text-yellow-800 dark:text-yellow-200">
              {error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper components for different error levels
export const CriticalErrorBoundary = ({ children, ...props }: Omit<Props, 'level'>) => (
  <ErrorBoundary level="critical" {...props}>
    {children}
  </ErrorBoundary>
);

export const PageErrorBoundary = ({ children, ...props }: Omit<Props, 'level'>) => (
  <ErrorBoundary level="page" {...props}>
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary = ({ children, ...props }: Omit<Props, 'level'>) => (
  <ErrorBoundary level="component" {...props}>
    {children}
  </ErrorBoundary>
);

export default ErrorBoundary;