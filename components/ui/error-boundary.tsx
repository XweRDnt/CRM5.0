"use client";

import { AlertCircle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./button";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-red-200 bg-red-50 p-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500" aria-hidden="true" />
          <h3 className="mt-4 text-lg font-semibold text-red-900">Something went wrong</h3>
          <p className="mt-2 text-sm text-red-700">{this.state.error?.message ?? "Unknown error"}</p>
          <Button type="button" onClick={this.handleReset} className="mt-4">
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
