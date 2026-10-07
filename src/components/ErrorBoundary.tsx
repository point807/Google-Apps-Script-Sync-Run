/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary: catches render/lifecycle errors in the tree below
 * and shows a recovery screen instead of a blank page.
 */
export class ErrorBoundary extends React.Component<
  React.PropsWithChildren<object>,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
          <h1 className="text-lg font-bold text-white">
            Что-то пошло не так · Something went wrong
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            В интерфейсе произошла непредвиденная ошибка. Данные в localStorage не затронуты.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto text-left text-xs text-rose-300 bg-slate-950 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap break-words">
            {error.message}
          </pre>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition cursor-pointer"
            >
              Попробовать снова · Try again
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer"
            >
              Перезагрузить · Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
