import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { TrendingUp, Send, Users, Mail, Phone, MessageSquare, Linkedin, BarChart3, Zap, Download, Calendar, Flame, Snowflake, ArrowRight, Activity, Copy, Globe } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function Analytics() {
    const [stats, setStats] = useState({
        totalLeads: 0,
        activeLeads: 0,
        responseRate: 0,
        totalSent: 0,
        channels: null,
        channelsByLeadType: null,
        leadTypeCounts: { inbound: 0, outbound: 0 },
        intentData: { highIntent: [], mediumIntent: [] }
    });
    const [showTracking, setShowTracking] = useState(false);
    const [timeRange, setTimeRange] = useState('7d');
    const [leadTypeView, setLeadTypeView] = useState('both'); // 'both', 'INBOUND', 'OUTBOUND'

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/analytics');
            setStats(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    // Mock trend data (would come from API in production)
    const trendData = [
        { name: 'Mon', sent: 12, replies: 3, opens: 8 },
        { name: 'Tue', sent: 19, replies: 5, opens: 14 },
        { name: 'Wed', sent: 15, replies: 4, opens: 11 },
        { name: 'Thu', sent: 22, replies: 7, opens: 18 },
        { name: 'Fri', sent: 18, replies: 6, opens: 15 },
        { name: 'Sat', sent: 8, replies: 2, opens: 5 },
        { name: 'Sun', sent: 5, replies: 1, opens: 3 },
    ];

    const channelPieData = stats.channels ? Object.entries(stats.channels).map(([name, data]) => ({
        name,
        value: data.sent || data.completed || 0
    })) : [];

    const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#06b6d4'];

    const StatCard = ({ title, value, subtitle, icon: Icon, color = 'blue', trend = null }) => {
        const colors = {
            blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
            green: 'from-green-500 to-emerald-600 shadow-green-500/20',
            purple: 'from-purple-500 to-violet-600 shadow-purple-500/20',
            amber: 'from-amber-500 to-orange-600 shadow-amber-500/20',
            cyan: 'from-cyan-500 to-teal-600 shadow-cyan-500/20',
            orange: 'from-orange-500 to-red-600 shadow-orange-500/20'
        };

        return (
            <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5 hover:border-slate-600 transition-all">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-400">{title}</p>
                        <p className="text-3xl font-bold text-white mt-1">{value}</p>
                        {subtitle && (
                            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                        )}
                        {trend && (
                            <p className={`text-xs mt-1 ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% vs last week
                            </p>
                        )}
                    </div>
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${colors[color]} shadow-lg`}>
                        <Icon size={20} className="text-white" />
                    </div>
                </div>
            </div>
        );
    };

    // Channel comparison row for inbound vs outbound
    const ChannelComparisonRow = ({ channel, inboundData, outboundData }) => {
        const channelConfig = {
            EMAIL: { icon: <Mail size={16} />, color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'Email' },
            SMS: { icon: <MessageSquare size={16} />, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'SMS' },
            CALL: { icon: <Phone size={16} />, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Call' },
            LINKEDIN: { icon: <Linkedin size={16} />, color: 'text-sky-400', bg: 'bg-sky-500/10', label: 'LinkedIn' }
        };

        const config = channelConfig[channel] || { icon: <Send size={16} />, color: 'text-slate-400', bg: 'bg-slate-500/10', label: channel };

        const inboundVolume = inboundData?.sent || inboundData?.completed || 0;
        const outboundVolume = outboundData?.sent || outboundData?.completed || 0;
        const inboundReplies = inboundData?.replies || 0;
        const outboundReplies = outboundData?.replies || 0;

        const inboundRate = inboundVolume > 0 ? ((inboundReplies / inboundVolume) * 100).toFixed(1) : 0;
        const outboundRate = outboundVolume > 0 ? ((outboundReplies / outboundVolume) * 100).toFixed(1) : 0;

        return (
            <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-all">
                {/* Channel Header */}
                <div className="flex items-center space-x-3 mb-4">
                    <div className={`p-2.5 ${config.bg} rounded-lg ${config.color}`}>
                        {config.icon}
                    </div>
                    <span className="font-semibold text-white text-lg">{config.label}</span>
                </div>

                {/* Comparison Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Inbound Column */}
                    <div className="p-3 bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg">
                        <div className="flex items-center space-x-1.5 mb-2">
                            <Flame size={14} className="text-orange-400" />
                            <span className="text-xs font-medium text-orange-400">INBOUND</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-xs text-slate-500">Sent</span>
                                <span className="text-sm font-medium text-white">{inboundVolume}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-slate-500">Replies</span>
                                <span className="text-sm font-medium text-white">{inboundReplies}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-orange-500/20">
                                <span className="text-xs text-slate-500">Rate</span>
                                <span className={`text-sm font-bold ${parseFloat(inboundRate) > 10 ? 'text-green-400' : 'text-slate-400'}`}>
                                    {inboundRate}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Outbound Column */}
                    <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg">
                        <div className="flex items-center space-x-1.5 mb-2">
                            <Snowflake size={14} className="text-blue-400" />
                            <span className="text-xs font-medium text-blue-400">OUTBOUND</span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-xs text-slate-500">Sent</span>
                                <span className="text-sm font-medium text-white">{outboundVolume}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-xs text-slate-500">Replies</span>
                                <span className="text-sm font-medium text-white">{outboundReplies}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-blue-500/20">
                                <span className="text-xs text-slate-500">Rate</span>
                                <span className={`text-sm font-bold ${parseFloat(outboundRate) > 5 ? 'text-green-400' : 'text-slate-400'}`}>
                                    {outboundRate}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Reports</h1>
                    <p className="text-slate-500 text-sm mt-1">Track your outreach performance across all channels</p>
                </div>
                <div className="flex items-center space-x-2">
                    {['7d', '30d', '90d'].map(range => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                ${timeRange === range
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                    <button
                        onClick={() => setShowTracking(!showTracking)}
                        className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
                    >
                        <Globe size={14} />
                        <span className="text-sm">Web Tracking</span>
                    </button>
                    <button className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors">
                        <Download size={14} />
                        <span className="text-sm">Export</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid with Inbound/Outbound */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <StatCard
                    title="Total Contacts"
                    value={stats.totalLeads}
                    subtitle="In your database"
                    icon={Users}
                    color="blue"
                    trend={12}
                />
                <StatCard
                    title="🔥 Inbound Leads"
                    value={stats.leadTypeCounts?.inbound || 0}
                    subtitle="Hot leads from ads/website"
                    icon={Flame}
                    color="orange"
                />
                <StatCard
                    title="❄️ Outbound Leads"
                    value={stats.leadTypeCounts?.outbound || 0}
                    subtitle="Cold outreach leads"
                    icon={Snowflake}
                    color="cyan"
                />
                <StatCard
                    title="Messages Sent"
                    value={stats.totalSent}
                    subtitle="Across all channels"
                    icon={Send}
                    color="purple"
                    trend={8}
                />
                <StatCard
                    title="Response Rate"
                    value={`${stats.responseRate}%`}
                    subtitle="Replied to outreach"
                    icon={TrendingUp}
                    color="green"
                    trend={-3}
                />
            </div>

            {/* Two Channel Performance Tables - Inbound & Outbound */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Inbound Channel Performance Table */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
                    <div className="flex items-center space-x-3 p-4 border-b border-slate-700/50 bg-gradient-to-r from-orange-500/10 to-red-500/10">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                            <Flame size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">🔥 Inbound Channel Performance</h2>
                            <p className="text-xs text-slate-500">Hot leads from ads, website, referrals</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left py-3 px-4 font-medium">Channel</th>
                                    <th className="text-center py-3 px-4 font-medium">Sent</th>
                                    <th className="text-center py-3 px-4 font-medium">Opened</th>
                                    <th className="text-center py-3 px-4 font-medium">Clicked</th>
                                    <th className="text-center py-3 px-4 font-medium">Bounced</th>
                                    <th className="text-center py-3 px-4 font-medium">Replied</th>
                                    <th className="text-center py-3 px-4 font-medium">No Reply</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {[
                                    { name: 'EMAIL', icon: <Mail size={16} />, color: 'purple', label: 'Email' },
                                    { name: 'SMS', icon: <MessageSquare size={16} />, color: 'blue', label: 'SMS' },
                                    { name: 'CALL', icon: <Phone size={16} />, color: 'green', label: 'Call' },
                                    { name: 'LINKEDIN', icon: <Linkedin size={16} />, color: 'sky', label: 'LinkedIn' }
                                ].map(channel => {
                                    const data = stats.channelsByLeadType?.INBOUND?.[channel.name] || {};
                                    const sent = data.sent || data.completed || 0;
                                    const opened = data.opens || 0;
                                    const clicked = data.clicks || 0;
                                    const bounced = data.bounced || 0;
                                    const replied = data.replies || 0;
                                    const noReply = Math.max(0, sent - replied);

                                    return (
                                        <tr key={channel.name} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className={`p-1.5 bg-${channel.color}-500/10 rounded text-${channel.color}-400`}>
                                                        {channel.icon}
                                                    </div>
                                                    <span className="font-medium text-slate-200">{channel.label}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="text-blue-400 font-semibold">{sent}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={opened > 0 ? "text-purple-400 font-semibold" : "text-slate-600"}>
                                                    {channel.name === 'EMAIL' ? opened : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={clicked > 0 ? "text-cyan-400 font-semibold" : "text-slate-600"}>
                                                    {['EMAIL', 'SMS'].includes(channel.name) ? clicked : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={bounced > 0 ? "text-red-400 font-semibold" : "text-slate-600"}>
                                                    {bounced || 0}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={replied > 0 ? "text-green-400 font-semibold" : "text-slate-600"}>
                                                    {replied}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="text-slate-500">{noReply}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Outbound Channel Performance Table */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
                    <div className="flex items-center space-x-3 p-4 border-b border-slate-700/50 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                            <Snowflake size={18} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-white">❄️ Outbound Channel Performance</h2>
                            <p className="text-xs text-slate-500">Cold outreach to prospected leads</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left py-3 px-4 font-medium">Channel</th>
                                    <th className="text-center py-3 px-4 font-medium">Sent</th>
                                    <th className="text-center py-3 px-4 font-medium">Opened</th>
                                    <th className="text-center py-3 px-4 font-medium">Clicked</th>
                                    <th className="text-center py-3 px-4 font-medium">Bounced</th>
                                    <th className="text-center py-3 px-4 font-medium">Replied</th>
                                    <th className="text-center py-3 px-4 font-medium">No Reply</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {[
                                    { name: 'EMAIL', icon: <Mail size={16} />, color: 'purple', label: 'Email' },
                                    { name: 'SMS', icon: <MessageSquare size={16} />, color: 'blue', label: 'SMS' },
                                    { name: 'CALL', icon: <Phone size={16} />, color: 'green', label: 'Call' },
                                    { name: 'LINKEDIN', icon: <Linkedin size={16} />, color: 'sky', label: 'LinkedIn' }
                                ].map(channel => {
                                    const data = stats.channelsByLeadType?.OUTBOUND?.[channel.name] || {};
                                    const sent = data.sent || data.completed || 0;
                                    const opened = data.opens || 0;
                                    const clicked = data.clicks || 0;
                                    const bounced = data.bounced || 0;
                                    const replied = data.replies || 0;
                                    const noReply = Math.max(0, sent - replied);

                                    return (
                                        <tr key={channel.name} className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className={`p-1.5 bg-${channel.color}-500/10 rounded text-${channel.color}-400`}>
                                                        {channel.icon}
                                                    </div>
                                                    <span className="font-medium text-slate-200">{channel.label}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="text-blue-400 font-semibold">{sent}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={opened > 0 ? "text-purple-400 font-semibold" : "text-slate-600"}>
                                                    {channel.name === 'EMAIL' ? opened : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={clicked > 0 ? "text-cyan-400 font-semibold" : "text-slate-600"}>
                                                    {['EMAIL', 'SMS'].includes(channel.name) ? clicked : '-'}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={bounced > 0 ? "text-red-400 font-semibold" : "text-slate-600"}>
                                                    {bounced || 0}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={replied > 0 ? "text-green-400 font-semibold" : "text-slate-600"}>
                                                    {replied}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="text-slate-500">{noReply}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Inbound vs Outbound Channel Performance Cards */}
            {stats.channelsByLeadType && (
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Channel Performance by Lead Type</h2>
                            <p className="text-xs text-slate-500">Compare inbound (hot) vs outbound (cold) engagement</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg">
                                <Flame size={14} className="text-orange-400" />
                                <span className="text-xs font-medium text-orange-400">Inbound</span>
                            </div>
                            <ArrowRight size={14} className="text-slate-600" />
                            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg">
                                <Snowflake size={14} className="text-blue-400" />
                                <span className="text-xs font-medium text-blue-400">Outbound</span>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {['EMAIL', 'SMS', 'CALL', 'LINKEDIN'].map(channel => (
                            <ChannelComparisonRow
                                key={channel}
                                channel={channel}
                                inboundData={stats.channelsByLeadType.INBOUND?.[channel]}
                                outboundData={stats.channelsByLeadType.OUTBOUND?.[channel]}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Engagement Trend - Area Chart */}
                <div className="lg:col-span-2 bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-white">Engagement Trend</h2>
                        <div className="flex items-center space-x-4 text-xs">
                            <span className="flex items-center space-x-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span><span className="text-slate-400">Sent</span></span>
                            <span className="flex items-center space-x-1"><span className="w-2 h-2 bg-purple-500 rounded-full"></span><span className="text-slate-400">Opens</span></span>
                            <span className="flex items-center space-x-1"><span className="w-2 h-2 bg-green-500 rounded-full"></span><span className="text-slate-400">Replies</span></span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                labelStyle={{ color: '#f1f5f9' }}
                            />
                            <Area type="monotone" dataKey="sent" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSent)" />
                            <Area type="monotone" dataKey="opens" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorOpens)" />
                            <Area type="monotone" dataKey="replies" stroke="#22c55e" fillOpacity={1} fill="url(#colorReplies)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Channel Distribution - Pie Chart */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                    <h2 className="font-semibold text-white mb-4">Channel Distribution</h2>
                    <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                            <Pie
                                data={channelPieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {channelPieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                        {channelPieData.map((entry, index) => (
                            <div key={entry.name} className="flex items-center space-x-1 text-xs">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                                <span className="text-slate-400">{entry.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tracking Script Modal */}
            {showTracking && (
                <div className="mb-6 bg-slate-800/50 rounded-xl border border-blue-500/30 p-5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Globe size={100} className="text-blue-500" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold text-white mb-2">Website Traffic Monitoring</h2>
                        <p className="text-sm text-slate-400 mb-4 max-w-2xl">
                            Install this snippet on <strong>trackmytruck.us</strong> to monitor visitor traffic and improved intent scoring.
                            Copy and paste this code just before the closing <code>&lt;/body&gt;</code> tag.
                        </p>

                        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700 font-mono text-xs text-slate-300 relative group">
                            <pre className="whitespace-pre-wrap break-all">
                                {`<script src="${window.location.protocol}//${window.location.hostname}:3000/api/tracking/script.js" async></script>`}
                            </pre>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`<script src="${window.location.protocol}//${window.location.hostname}:3000/api/tracking/script.js" async></script>`);
                                    alert('Copied to clipboard');
                                }}
                                className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Intent Radar - High Intent Leads */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold text-white">🔥 High Intent Radar</h2>
                        <p className="text-xs text-slate-500">Leads with highest engagement signals</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Score based on: Replies, Clicks, Opens, & Meetings</span>
                    </div>
                </div>

                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wider">
                                <tr>
                                    <th className="text-left py-3 px-4 font-medium">Lead Name</th>
                                    <th className="text-left py-3 px-4 font-medium">Company</th>
                                    <th className="text-center py-3 px-4 font-medium">Intent Score</th>
                                    <th className="text-center py-3 px-4 font-medium">Signals</th>
                                    <th className="text-center py-3 px-4 font-medium">Status</th>
                                    <th className="text-right py-3 px-4 font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-700/50">
                                {(!stats.intentData?.highIntent || stats.intentData.highIntent.length === 0) ? (
                                    <tr>
                                        <td colSpan="6" className="py-8 text-center text-slate-500">
                                            No high intent signals detected yet.
                                        </td>
                                    </tr>
                                ) : (
                                    stats.intentData.highIntent.map((lead, idx) => (
                                        <tr key={lead.id} className="hover:bg-slate-800/30 transition-colors group">
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-white">{lead.name}</div>
                                            </td>
                                            <td className="py-3 px-4 text-slate-400">
                                                {lead.company || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r ${idx < 3 ? 'from-orange-500/20 to-red-500/20 text-orange-400 border border-orange-500/30' : 'from-blue-500/20 to-cyan-500/20 text-blue-400'}`}>
                                                    <Activity size={12} className="mr-1" />
                                                    {lead.score}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="text-slate-300">{lead.signalCount || 0}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs ${lead.status === 'MEETING_BOOKED' ? 'bg-purple-500/20 text-purple-400' :
                                                        lead.status === 'INTERESTED' ? 'bg-green-500/20 text-green-400' :
                                                            'bg-slate-700 text-slate-400'
                                                    }`}>
                                                    {lead.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button className="text-blue-400 hover:text-blue-300 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                    View Lead →
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Team Leaderboard */}
                <TeamLeaderboard />

                {/* Best Time Analysis */}
                <BestTimeAnalysis />
            </div>
        </div>
    );
}

// Team Leaderboard Component
function TeamLeaderboard() {
    const [teamStats, setTeamStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTeamStats();
    }, []);

    const fetchTeamStats = async () => {
        try {
            const res = await axios.get('/api/team/stats');
            setTeamStats(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRankBadge = (index) => {
        if (index === 0) return <span className="text-lg">🥇</span>;
        if (index === 1) return <span className="text-lg">🥈</span>;
        if (index === 2) return <span className="text-lg">🥉</span>;
        return <span className="text-slate-500 font-medium w-6 text-center">{index + 1}</span>;
    };

    return (
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-semibold text-white">Team Leaderboard</h2>
                    <p className="text-xs text-slate-500">Performance by rep</p>
                </div>
                <Users size={18} className="text-slate-500" />
            </div>

            {loading ? (
                <div className="py-8 text-center text-slate-500">Loading...</div>
            ) : teamStats.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                    <Users size={24} className="mx-auto mb-2 opacity-30" />
                    No team data yet
                </div>
            ) : (
                <div className="space-y-3">
                    {teamStats.map((rep, idx) => (
                        <div key={rep.rep_name} className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors">
                            <div className="flex items-center justify-center w-8">
                                {getRankBadge(idx)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{rep.rep_name}</p>
                                <p className="text-xs text-slate-500">{rep.total_leads} leads • {rep.messages_sent} msgs</p>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-green-400">{rep.completed}</p>
                                <p className="text-xs text-slate-500">closed</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Best Time Analysis Component
function BestTimeAnalysis() {
    const [bestTimes, setBestTimes] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBestTimes();
    }, []);

    const fetchBestTimes = async () => {
        try {
            const res = await axios.get('/api/analytics/best-times');
            setBestTimes(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatHour = (hour) => {
        if (hour === 0) return '12 AM';
        if (hour === 12) return '12 PM';
        return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
    };

    return (
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-semibold text-white">Best Send Times</h2>
                    <p className="text-xs text-slate-500">When leads reply most</p>
                </div>
                <Calendar size={18} className="text-slate-500" />
            </div>

            {loading ? (
                <div className="py-8 text-center text-slate-500">Loading...</div>
            ) : !bestTimes ? (
                <div className="py-8 text-center text-slate-500">
                    <Calendar size={24} className="mx-auto mb-2 opacity-30" />
                    Not enough data
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Recommendation */}
                    <div className="p-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg">
                        <p className="text-green-400 font-medium text-sm">{bestTimes.recommendation}</p>
                    </div>

                    {/* Best Hours */}
                    {bestTimes.bestHours && bestTimes.bestHours.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Top Hours</p>
                            <div className="flex flex-wrap gap-2">
                                {bestTimes.bestHours.map((h, idx) => (
                                    <div key={idx} className={`px-3 py-1.5 rounded-lg text-sm font-medium
                                        ${idx === 0 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                        {formatHour(h.hour)} ({h.reply_count})
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Best Days */}
                    {bestTimes.bestDays && bestTimes.bestDays.length > 0 && (
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Top Days</p>
                            <div className="flex flex-wrap gap-2">
                                {bestTimes.bestDays.map((d, idx) => (
                                    <div key={idx} className={`px-3 py-1.5 rounded-lg text-sm font-medium
                                        ${idx === 0 ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-800 text-slate-400'}`}>
                                        {d.dayName} ({d.reply_count})
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
