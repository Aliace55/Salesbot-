import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center h-screen bg-slate-900 text-white p-4">
                    <div className="max-w-xl bg-slate-800 p-6 rounded-lg border border-red-500/50 shadow-xl">
                        <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
                        <p className="mb-4 text-slate-300">The application encountered an unexpected error.</p>
                        {this.state.error && (
                            <pre className="bg-slate-950 p-4 rounded text-xs text-red-300 overflow-auto max-h-60 mb-4">
                                {this.state.error.toString()}
                            </pre>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
