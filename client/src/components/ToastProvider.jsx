import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

const TOAST_ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
    ai: Sparkles
};

const TOAST_STYLES = {
    success: 'from-green-500/20 to-emerald-500/10 border-green-500/40 text-green-400',
    error: 'from-red-500/20 to-rose-500/10 border-red-500/40 text-red-400',
    warning: 'from-amber-500/20 to-yellow-500/10 border-amber-500/40 text-amber-400',
    info: 'from-blue-500/20 to-cyan-500/10 border-blue-500/40 text-blue-400',
    ai: 'from-purple-500/20 to-pink-500/10 border-purple-500/40 text-purple-400'
};

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();

        setToasts(prev => [...prev, { id, message, type }]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error'),
        warning: (msg) => addToast(msg, 'warning'),
        info: (msg) => addToast(msg, 'info'),
        ai: (msg) => addToast(msg, 'ai', 5000),
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}

            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map((t) => {
                    const Icon = TOAST_ICONS[t.type];
                    return (
                        <div
                            key={t.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-gradient-to-r backdrop-blur-xl shadow-xl animate-slide-in ${TOAST_STYLES[t.type]}`}
                        >
                            <Icon size={18} className="flex-shrink-0" />
                            <p className="text-sm font-medium flex-1">{t.message}</p>
                            <button
                                onClick={() => removeToast(t.id)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}

export default ToastProvider;
