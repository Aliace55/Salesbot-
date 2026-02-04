import React, { useState, useEffect } from 'react';
import { Cpu, Brain, Zap, CheckCircle, Loader2 } from 'lucide-react';

/**
 * AI Status Indicator - Shows real-time AI activity in the header
 */
export function AIStatusIndicator() {
    const [status, setStatus] = useState({ state: 'idle', message: 'Monitoring' });
    const [recentActivity, setRecentActivity] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Poll for AI activity
    useEffect(() => {
        const fetchActivity = async () => {
            try {
                const res = await fetch('/api/brain/feed');
                const data = await res.json();

                if (data.length > 0) {
                    const latest = data[0];
                    const timeDiff = Date.now() - new Date(latest.created_at).getTime();

                    // If activity within last 30 seconds, show as active
                    if (timeDiff < 30000) {
                        setStatus({
                            state: 'active',
                            message: latest.title?.substring(0, 30) || 'Processing...'
                        });
                    } else {
                        setStatus({ state: 'idle', message: 'Monitoring' });
                    }

                    setRecentActivity(data.slice(0, 5));
                }
            } catch (err) {
                setStatus({ state: 'idle', message: 'Monitoring' });
            }
        };

        fetchActivity();
        const interval = setInterval(fetchActivity, 5000);
        return () => clearInterval(interval);
    }, []);

    const stateStyles = {
        idle: {
            bg: 'bg-slate-500/10',
            border: 'border-slate-500/30',
            text: 'text-slate-400',
            dot: 'bg-slate-400'
        },
        active: {
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/30',
            text: 'text-purple-400',
            dot: 'bg-purple-400 animate-pulse'
        },
        processing: {
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/30',
            text: 'text-blue-400',
            dot: 'bg-blue-400 animate-pulse'
        }
    };

    const style = stateStyles[status.state];

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all hover:brightness-110 ${style.bg} ${style.border}`}
            >
                <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                <Brain size={14} className={style.text} />
                <span className={`text-xs font-medium ${style.text} max-w-[100px] truncate`}>
                    {status.message}
                </span>
                {status.state === 'active' && (
                    <Loader2 size={12} className={`${style.text} animate-spin`} />
                )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Cpu size={16} className="text-purple-400" />
                                <span className="text-sm font-semibold text-white">AI Brain</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                                {status.state === 'idle' ? 'Standby' : 'Active'}
                            </span>
                        </div>

                        <div className="max-h-64 overflow-y-auto">
                            {recentActivity.length === 0 ? (
                                <div className="px-4 py-6 text-center text-slate-500 text-sm">
                                    No recent activity
                                </div>
                            ) : (
                                <div className="py-2">
                                    {recentActivity.map((item, i) => (
                                        <div
                                            key={item.id || i}
                                            className="px-4 py-2 hover:bg-slate-700/50 transition-colors"
                                        >
                                            <div className="flex items-start gap-2">
                                                {item.severity === 'ACTION' ? (
                                                    <Zap size={12} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                                ) : (
                                                    <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-white truncate">{item.title}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                                        {new Date(item.created_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <a
                            href="/brain"
                            className="block px-4 py-2 text-center text-xs text-purple-400 hover:bg-slate-700/50 border-t border-slate-700 transition-colors"
                        >
                            Open Command Center →
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}

export default AIStatusIndicator;
