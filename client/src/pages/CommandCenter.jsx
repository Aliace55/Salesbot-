import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Brain, Zap, MessageSquare, AlertTriangle, CheckCircle, XCircle,
    Activity, ArrowRight, Play, Settings, RefreshCw, Cpu
} from 'lucide-react';

export default function CommandCenter() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [simulating, setSimulating] = useState(false);

    // Poll for updates every 5 seconds
    useEffect(() => {
        fetchActivities();
        const interval = setInterval(fetchActivities, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchActivities = async () => {
        try {
            const res = await axios.get('/api/brain/feed');
            setActivities(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch AI feed:', err);
        }
    };

    const handleAction = async (id, decision) => {
        try {
            await axios.post('/api/brain/action', { id, decision });
            // Optimistic update
            setActivities(prev => prev.map(a =>
                a.id === id ? { ...a, status: decision } : a
            ));
            fetchActivities(); // Refresh to be sure
        } catch (err) {
            console.error('Failed to execute decision:', err);
        }
    };

    const simulateEvent = async (type) => {
        setSimulating(true);
        try {
            const events = {
                'INSIGHT': { title: 'New Market Trend Detected', description: 'Logistics sector keywords are trending up. Recommended campaign adjustment.' },
                'ACTION_REQUIRED': { title: 'Drafted Reply to CEO', description: 'Priority lead responded positively. I generated a meeting invite draft.', metadata: { leadId: 101 } },
                'SYSTEM_LOG': { title: 'Lead Database Sanitization', description: 'Removed 12 invalid emails and corrected 5 phone format errors.' }
            };

            await axios.post('/api/brain/simulate', {
                type,
                ...events[type]
            });
            fetchActivities();
        } catch (err) {
            console.error(err);
        } finally {
            setSimulating(false);
        }
    };

    // Helper: Get Icon based on type
    const getActivityIcon = (type) => {
        switch (type) {
            case 'INSIGHT': return <Brain size={20} className="text-purple-400" />;
            case 'ACTION_REQUIRED': return <Zap size={20} className="text-amber-400" />;
            case 'SYSTEM_LOG': return <Activity size={20} className="text-blue-400" />;
            case 'DECISION': return <CheckCircle size={20} className="text-green-400" />;
            default: return <MessageSquare size={20} className="text-slate-400" />;
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'HIGH': return 'border-red-500/50 bg-red-500/10';
            case 'MEDIUM': return 'border-amber-500/50 bg-amber-500/10';
            default: return 'border-slate-700/50 bg-slate-800/30';
        }
    };

    return (
        <div className="flex h-[calc(100vh-2rem)] space-x-6">
            {/* Feed Section */}
            <div className="flex-1 flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Cpu size={24} className="text-purple-400" />
                            </div>
                            System Intelligence
                        </h1>
                        <p className="text-slate-400 text-sm mt-1">Real-time decisions and insights from the AI Core</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className="flex items-center text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                            <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            Online & Monitoring
                        </span>
                        <button onClick={fetchActivities} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                {/* The Stream */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {loading ? (
                        <div className="text-center py-20 text-slate-500">Connecting to Neural Interface...</div>
                    ) : activities.length === 0 ? (
                        <div className="text-center py-20 text-slate-500">System idle. No recent activities.</div>
                    ) : (
                        activities.map((activity) => (
                            <div
                                key={activity.id}
                                className={`p-5 rounded-xl border transition-all ${getSeverityColor(activity.severity)} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-4">
                                        <div className="mt-1 p-2 bg-slate-900/50 rounded-lg border border-slate-700/30">
                                            {getActivityIcon(activity.type)}
                                        </div>
                                        <div>
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900/50 text-slate-300 border border-slate-700/30">
                                                    {activity.type.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-semibold text-white">{activity.title}</h3>
                                            <p className="text-slate-300 text-sm mt-1 leading-relaxed">{activity.description}</p>
                                        </div>
                                    </div>

                                    {/* Action Buttons for Pending Decisions */}
                                    {activity.status === 'PENDING' && activity.type === 'ACTION_REQUIRED' && (
                                        <div className="flex flex-col space-y-2 ml-4">
                                            <button
                                                onClick={() => handleAction(activity.id, 'APPROVED')}
                                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-purple-900/20 transition-all flex items-center justify-center"
                                            >
                                                <CheckCircle size={14} className="mr-1.5" /> Approve
                                            </button>
                                            <button
                                                onClick={() => handleAction(activity.id, 'REJECTED')}
                                                className="px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center"
                                            >
                                                <XCircle size={14} className="mr-1.5" /> Dismiss
                                            </button>
                                        </div>
                                    )}

                                    {/* Status Badge for Completed Items */}
                                    {activity.status !== 'PENDING' && (
                                        <div className={`px-3 py-1 rounded-lg text-xs font-bold border ${activity.status === 'APPROVED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                activity.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                    'bg-slate-800 text-slate-500 border-slate-700'
                                            }`}>
                                            {activity.status}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Simulator / Controls */}
            <div className="w-80 bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col space-y-6">
                <div>
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center">
                        <Settings size={18} className="mr-2 text-slate-400" /> Simulation Controls
                    </h2>
                    <p className="text-xs text-slate-500 mb-4">Manually trigger AI events to test the operating system's response logic.</p>

                    <div className="space-y-3">
                        <button
                            onClick={() => simulateEvent('INSIGHT')}
                            disabled={simulating}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50 rounded-xl text-left transition-all group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-white group-hover:text-purple-300">New Insight</span>
                                <Brain size={16} className="text-slate-500 group-hover:text-purple-400" />
                            </div>
                            <p className="text-[10px] text-slate-500">Simulate market data analysis</p>
                        </button>

                        <button
                            onClick={() => simulateEvent('ACTION_REQUIRED')}
                            disabled={simulating}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-white group-hover:text-amber-300">Pending Action</span>
                                <Zap size={16} className="text-slate-500 group-hover:text-amber-400" />
                            </div>
                            <p className="text-[10px] text-slate-500">Trigger manual approval request</p>
                        </button>

                        <button
                            onClick={() => simulateEvent('SYSTEM_LOG')}
                            disabled={simulating}
                            className="w-full p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 rounded-xl text-left transition-all group"
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-semibold text-white group-hover:text-blue-300">System Event</span>
                                <Activity size={16} className="text-slate-500 group-hover:text-blue-400" />
                            </div>
                            <p className="text-[10px] text-slate-500">Log routine maintenance task</p>
                        </button>
                    </div>
                </div>

                <div className="mt-auto pt-6 border-t border-slate-800">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20">
                        <h3 className="text-sm font-bold text-white mb-2">System Status</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Model</span>
                                <span className="text-purple-300">Gemini 1.5 Pro</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Latency</span>
                                <span className="text-green-400">45ms</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Daily Ops</span>
                                <span className="text-white">1,240</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
