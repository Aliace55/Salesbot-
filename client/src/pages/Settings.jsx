import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings as SettingsIcon, Download, Linkedin, Mail, Phone, Shield, Bell, Database, Zap, Check, AlertCircle, TrendingUp } from 'lucide-react';

export default function Settings() {
    const [warmupStatus, setWarmupStatus] = useState(null);
    const [emailHealth, setEmailHealth] = useState(null);
    const [linkedinStats, setLinkedinStats] = useState(null);
    const [exporting, setExporting] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [warmup, health, linkedin] = await Promise.all([
                axios.get('/api/email/warmup-status'),
                axios.get('/api/email/health'),
                axios.get('/api/linkedin/stats')
            ]);
            setWarmupStatus(warmup.data);
            setEmailHealth(health.data);
            setLinkedinStats(linkedin.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleExport = async (type) => {
        setExporting(type);
        try {
            const endpoint = `/api/export/${type}`;
            const response = await axios.get(endpoint, { responseType: 'blob' });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${type}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Export failed: ' + err.message);
        } finally {
            setExporting(null);
        }
    };

    const getHealthColor = (status) => {
        const colors = {
            HEALTHY: 'text-green-400 bg-green-500/10 border-green-500/30',
            WARNING: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
            CRITICAL: 'text-red-400 bg-red-500/10 border-red-500/30'
        };
        return colors[status] || 'text-slate-400';
    };

    return (
        <div>
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-slate-500 text-sm mt-1">Configure your SalesBot instance</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Email Warmup Status */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                    <div className="flex items-center space-x-2 mb-4">
                        <Mail size={18} className="text-purple-400" />
                        <h2 className="font-semibold text-white">Email Warmup</h2>
                    </div>

                    {warmupStatus ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Status</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${warmupStatus.status === 'WARMED_UP' ? 'bg-green-500/10 text-green-400' :
                                        warmupStatus.status === 'WARMING' ? 'bg-blue-500/10 text-blue-400' :
                                            'bg-slate-500/10 text-slate-400'
                                    }`}>
                                    {warmupStatus.status}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Day</span>
                                <span className="text-white font-medium">{warmupStatus.day}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Daily Limit</span>
                                <span className="text-white font-medium">{warmupStatus.maxSends} emails</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Sent Today</span>
                                <span className="text-white font-medium">{warmupStatus.sent} / {warmupStatus.maxSends}</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                                    style={{ width: `${warmupStatus.maxSends > 0 ? (warmupStatus.sent / warmupStatus.maxSends) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">Loading...</p>
                    )}
                </div>

                {/* Email Health */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                    <div className="flex items-center space-x-2 mb-4">
                        <Shield size={18} className="text-green-400" />
                        <h2 className="font-semibold text-white">Email Health</h2>
                    </div>

                    {emailHealth && !emailHealth.error ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-slate-400">Health Score</span>
                                <div className="flex items-center space-x-2">
                                    <span className="text-2xl font-bold text-white">{emailHealth.healthScore}</span>
                                    <span className={`px-2 py-0.5 rounded border text-xs ${getHealthColor(emailHealth.status)}`}>
                                        {emailHealth.status}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Open Rate</p>
                                    <p className="text-lg font-semibold text-white">{emailHealth.openRate}%</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Reply Rate</p>
                                    <p className="text-lg font-semibold text-white">{emailHealth.replyRate}%</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Bounce Rate</p>
                                    <p className={`text-lg font-semibold ${emailHealth.bounceRate > 2 ? 'text-red-400' : 'text-green-400'}`}>
                                        {emailHealth.bounceRate}%
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3">
                                    <p className="text-xs text-slate-500">Total Sent</p>
                                    <p className="text-lg font-semibold text-white">{emailHealth.totalSent}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">Loading...</p>
                    )}
                </div>

                {/* LinkedIn Stats */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                    <div className="flex items-center space-x-2 mb-4">
                        <Linkedin size={18} className="text-sky-400" />
                        <h2 className="font-semibold text-white">LinkedIn Automation</h2>
                    </div>

                    {linkedinStats && !linkedinStats.error ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500">Connections</p>
                                    <p className="text-lg font-semibold text-white">{linkedinStats.total?.connections || 0}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500">Messages</p>
                                    <p className="text-lg font-semibold text-white">{linkedinStats.total?.messages || 0}</p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                                    <p className="text-xs text-slate-500">Profile Views</p>
                                    <p className="text-lg font-semibold text-white">{linkedinStats.total?.profileViews || 0}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-400">Today's Connections</span>
                                <span className="text-white">{linkedinStats.today?.connections || 0} / {linkedinStats.limits?.connectionRequests || 20}</span>
                            </div>
                            <div className="w-full bg-slate-700 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-sky-500 to-blue-500 h-2 rounded-full"
                                    style={{ width: `${((linkedinStats.today?.connections || 0) / (linkedinStats.limits?.connectionRequests || 20)) * 100}%` }}
                                ></div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 text-sm">Loading...</p>
                    )}
                </div>

                {/* Data Export */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                    <div className="flex items-center space-x-2 mb-4">
                        <Download size={18} className="text-amber-400" />
                        <h2 className="font-semibold text-white">Export Data</h2>
                    </div>

                    <div className="space-y-3">
                        {['leads', 'messages', 'analytics', 'tasks'].map(type => (
                            <button
                                key={type}
                                onClick={() => handleExport(type)}
                                disabled={exporting === type}
                                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <div className="flex items-center space-x-3">
                                    <Database size={16} className="text-slate-500" />
                                    <span className="text-white capitalize">{type}</span>
                                </div>
                                {exporting === type ? (
                                    <div className="animate-spin w-4 h-4 border-2 border-slate-500 border-t-white rounded-full"></div>
                                ) : (
                                    <span className="text-xs text-slate-500">.CSV</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
