"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null; componentStack: string | null };

export class PortalErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[PortalErrorBoundary] error:", error.message);
    console.error("[PortalErrorBoundary] componentStack:", info.componentStack);
    this.setState({ error, componentStack: info.componentStack });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="min-h-screen bg-[#1a1a1a] px-4 py-6 text-white">
          <pre className="text-xs whitespace-pre-wrap text-red-400">
            {this.state.error.message}
            {"\n\n"}
            {this.state.componentStack}
          </pre>
        </main>
      );
    }
    return this.props.children;
  }
}
