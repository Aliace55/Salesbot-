import React, { useState, useEffect, useRef } from 'react';
import { Activity, Terminal, Shield, Zap, RefreshCw, Server, Database, Mail, Search } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const CommandCenter = () => {
    const [activities, setActivities] = useState([]);
    const [stats, setStats] = useState({
        lastSync: null,
        dbStatus: 'Online',
        brainStatus: 'Online'
    });
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    // Fetch Feed
    const fetchFeed = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/brain/feed`);
            const data = await res.json();
            setActivities(data);
        } catch (err) {
            console.error('Failed to fetch feed:', err);
        }
    };

    // Fetch Status
    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/sync/status`);
            const data = await res.json();
            setStats(prev => ({ ...prev, lastSync: data.lastSync }));
        } catch (err) {
            console.error('Failed to fetch status:', err);
        }
    };

    useEffect(() => {
        fetchFeed();
        fetchStatus();
        const interval = setInterval(() => {
            fetchFeed();
            fetchStatus();
        }, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll to top (newest)
    useEffect(() => {
        if (scrollRef.current) {
            // usually we want to see the top if it's reverse chrono
        }
    }, [activities]);

    const handleManualSync = async () => {
        setLoading(true);
        try {
            await fetch(`${API_BASE_URL}/api/sync/sheets`, { method: 'POST' });
            fetchFeed(); // Refresh immediately
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getActivityColor = (type, severity) => {
        if (severity === 'HIGH' || severity === 'CRITICAL') return 'text-red-400 border-red-900 bg-red-900/20';
        if (type === 'RESEARCH') return 'text-blue-400 border-blue-900 bg-blue-900/20';
        if (type === 'SYNC') return 'text-purple-400 border-purple-900 bg-purple-900/20';
        if (type === 'INSIGHT') return 'text-green-400 border-green-900 bg-green-900/20';
        return 'text-gray-300 border-gray-700 bg-gray-800/50';
    };

    const getIcon = (type) => {
        if (type === 'RESEARCH') return <Search size={16} />;
        if (type === 'SYNC') return <RefreshCw size={16} />;
        if (type === 'INSIGHT') return <Zap size={16} />;
        return <Terminal size={16} />;
    };

    return (
        <div className="p-6 h-screen flex flex-col gap-6 text-gray-100 font-mono">
            {/* Header / Status Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                {/* System Health */}
                <div className="bg-black/40 border border-green-500/30 p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    <div className="relative">
                        <div className="absolute inset-0 bg-green-500 rounded-full blur animate-pulse opacity-50"></div>
                        <Shield className="relative text-green-400" size={24} />
                    </div>
                    <div>
                        <div className="text-xs text-green-500/80 uppercase tracking-widest">System Status</div>
                        <div className="text-sm font-bold text-green-400">OPERATIONAL</div>
                    </div>
                </div>

                {/* Database Status */}
                <div className="bg-black/40 border border-blue-500/30 p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm">
                    <Database className="text-blue-400" size={24} />
                    <div>
                        <div className="text-xs text-blue-500/80 uppercase tracking-widest">Database</div>
                        <div className="text-sm font-bold text-blue-400">{stats.dbStatus}</div>
                    </div>
                </div>

                {/* Last Sync */}
                <div className="bg-black/40 border border-purple-500/30 p-4 rounded-lg flex items-center gap-3 backdrop-blur-sm">
                    <RefreshCw className="text-purple-400" size={24} />
                    <div>
                        <div className="text-xs text-purple-500/80 uppercase tracking-widest">Last Sync</div>
                        <div className="text-xs font-bold text-purple-400">
                            {stats.lastSync ? new Date(stats.lastSync).toLocaleTimeString() : 'Pending...'}
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={handleManualSync}
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-purple-900/20 disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        {loading ? 'SYNCING...' : 'SYNC ALL'}
                    </button>
                </div>
            </div>

            {/* Main Terminal Feed */}
            <div className="flex-1 bg-black/80 border border-gray-800 rounded-lg p-4 overflow-hidden flex flex-col shadow-2xl relative">
                {/* Scan line effect */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20"></div>

                <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <div className="flex items-center gap-2 text-green-500">
                        <Terminal size={18} />
                        <span className="text-sm font-bold tracking-widest">&gt;/ BRAIN_ACTIVITY_LOG</span>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                        <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500"></div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent" ref={scrollRef}>
                    {activities.length === 0 ? (
                        <div className="text-gray-600 italic text-center mt-10">Initializing neural interface...</div>
                    ) : (
                        activities.map((act) => (
                            <div key={act.id} className={`p-3 rounded border-l-2 text-xs md:text-sm font-mono transition-all hover:bg-white/5 ${getActivityColor(act.type, act.severity)}`}>
                                <div className="flex justify-between items-start mb-1 opacity-70">
                                    <span className="uppercase font-bold flex items-center gap-2">
                                        {act.type}
                                    </span>
                                    <span>{new Date(act.created_at).toLocaleTimeString()}</span>
                                </div>
                                <div className="font-bold mb-1">{act.title}</div>
                                <div className="opacity-80 break-words">{act.description}</div>
                                {act.metadata && Object.keys(act.metadata).length > 0 && (
                                    <div className="mt-2 text-[10px] text-gray-500 bg-black/30 p-2 rounded overflow-x-auto">
                                        {JSON.stringify(act.metadata)}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default CommandCenter;
