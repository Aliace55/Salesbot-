import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
    Play, MessageSquare, Phone, Linkedin, CheckCircle, Search, Filter, MoreHorizontal,
    AlertCircle, Clock, User, Mail, Sparkles, Plus, Upload, Download, Trash2,
    ChevronDown, Grid, List, LayoutGrid, RefreshCw, Edit2, X, Check, Send,
    Eye, Star, Tag, ArrowUpDown, SlidersHorizontal, Users, Target, TrendingUp,
    Activity, Zap, Building, Calendar, ChevronRight, ExternalLink, MoreVertical,
    Lock, Unlock, Bot, Hand, ArrowRight, Trophy, XCircle, Percent, GripVertical,
    Flame, Snowflake, Globe
} from 'lucide-react';

// Funnel stage configuration
const FUNNEL_CONFIG = {
    LEAD: { label: 'Lead', color: 'slate', icon: Plus, description: 'New contact' },
    CONTACTED: { label: 'Contacted', color: 'blue', icon: Send, description: 'First outreach sent' },
    ENGAGED: { label: 'Engaged', color: 'cyan', icon: MessageSquare, description: 'Lead replied' },
    QUALIFIED: { label: 'Qualified', color: 'purple', icon: Target, description: 'Shows interest' },
    PROPOSAL: { label: 'Proposal', color: 'amber', icon: Mail, description: 'Sent pricing' },
    NEGOTIATION: { label: 'Negotiation', color: 'orange', icon: Activity, description: 'Active talks' },
    WON: { label: 'Won', color: 'green', icon: Trophy, description: 'Converted!' },
    LOST: { label: 'Lost', color: 'red', icon: XCircle, description: 'Closed/Opted out' }
};

// Lead source display config
const SOURCE_CONFIG = {
    google: { label: 'Google Ads', icon: '🔍', color: 'blue' },
    facebook: { label: 'Facebook', icon: '📘', color: 'indigo' },
    website: { label: 'Website', icon: '🌐', color: 'green' },
    referral: { label: 'Referral', icon: '🤝', color: 'purple' },
    cold_email: { label: 'Cold Email', icon: '📧', color: 'slate' },
    linkedin: { label: 'LinkedIn', icon: '💼', color: 'sky' },
    cold_call: { label: 'Cold Call', icon: '📞', color: 'slate' },
    unknown: { label: 'Unknown', icon: '❓', color: 'slate' }
};

const STAGE_ORDER = ['LEAD', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

export default function Pipeline() {
    const navigate = useNavigate();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('funnel'); // funnel, table
    const [funnelStats, setFunnelStats] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [draggedLead, setDraggedLead] = useState(null);
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState([]);
    const [processingAI, setProcessingAI] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', company: '', source: '' });
    const [leadTypeFilter, setLeadTypeFilter] = useState('all'); // all, INBOUND, OUTBOUND

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [leadsRes, statsRes] = await Promise.all([
                axios.get('/api/funnel/leads'),
                axios.get('/api/funnel/stats')
            ]);
            setLeads(leadsRes.data);
            setFunnelStats(statsRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Lead type stats
    const leadTypeStats = useMemo(() => {
        const inbound = leads.filter(l => l.lead_type === 'INBOUND');
        const outbound = leads.filter(l => l.lead_type === 'OUTBOUND' || !l.lead_type);
        return { inbound: inbound.length, outbound: outbound.length };
    }, [leads]);

    // Filtered leads (by search AND lead type)
    const filteredLeads = useMemo(() => {
        let result = leads;

        // Filter by lead type
        if (leadTypeFilter !== 'all') {
            result = result.filter(l => (l.lead_type || 'OUTBOUND') === leadTypeFilter);
        }

        // Filter by search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(l =>
                l.name?.toLowerCase().includes(term) ||
                l.email?.toLowerCase().includes(term) ||
                l.company?.toLowerCase().includes(term)
            );
        }

        return result;
    }, [leads, searchTerm, leadTypeFilter]);

    // Group leads by stage (uses filtered leads)
    const leadsByStage = useMemo(() => {
        const grouped = {};
        STAGE_ORDER.forEach(stage => {
            grouped[stage] = filteredLeads.filter(l => (l.funnel_stage || 'LEAD') === stage);
        });
        return grouped;
    }, [filteredLeads]);

    // Move lead to new stage (drag & drop or manual)
    const moveLeadToStage = async (leadId, newStage, lock = false) => {
        try {
            await axios.put(`/api/leads/${leadId}/stage`, { stage: newStage, lock });
            await fetchData();
            setSelectedLead(null);
        } catch (err) {
            console.error(err);
            alert('Failed to move lead');
        }
    };

    // Toggle stage lock
    const toggleStageLock = async (leadId, currentLocked) => {
        try {
            await axios.put(`/api/leads/${leadId}/lock-stage`, { locked: !currentLocked });
            await fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    // Run AI analysis
    const runAIAnalysis = async () => {
        setProcessingAI(true);
        try {
            const res = await axios.post('/api/funnel/batch-analyze');
            setAiSuggestions(res.data.changes || []);
            setShowAIPanel(true);
            await fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setProcessingAI(false);
        }
    };

    // Add new lead
    const handleAddLead = async () => {
        if (!newLead.phone && !newLead.email) {
            alert('Phone or email is required');
            return;
        }
        try {
            await axios.post('/api/leads', { ...newLead, funnel_stage: 'LEAD' });
            setShowAddModal(false);
            setNewLead({ name: '', phone: '', email: '', company: '' });
            await fetchData();
        } catch (err) {
            alert('Failed to add lead');
        }
    };

    // Drag handlers
    const handleDragStart = (e, lead) => {
        setDraggedLead(lead);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetStage) => {
        e.preventDefault();
        if (draggedLead && draggedLead.funnel_stage !== targetStage) {
            await moveLeadToStage(draggedLead.id, targetStage);
        }
        setDraggedLead(null);
    };

    const getAvatarGradient = (name) => {
        const gradients = [
            'from-blue-500 to-cyan-500',
            'from-purple-500 to-pink-500',
            'from-green-500 to-emerald-500',
            'from-orange-500 to-red-500',
            'from-indigo-500 to-purple-500'
        ];
        return gradients[(name?.charCodeAt(0) || 0) % gradients.length];
    };

    const getStageColor = (stage) => {
        const config = FUNNEL_CONFIG[stage] || FUNNEL_CONFIG.LEAD;
        return config.color;
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Target className="text-blue-400" size={28} />
                        Sales Pipeline
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Move leads through your funnel • AI-powered stage detection
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    {/* View Toggle */}
                    <div className="flex items-center bg-slate-800 rounded-xl p-1">
                        <button
                            onClick={() => setViewMode('funnel')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'funnel' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            title="Funnel View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            title="Table View"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-white rounded-lg transition-colors"
                    >
                        <Plus size={16} />
                        <span>Add Lead</span>
                    </button>

                    <button
                        onClick={runAIAnalysis}
                        disabled={processingAI}
                        className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                    >
                        <Bot size={16} className={processingAI ? 'animate-pulse' : ''} />
                        <span>{processingAI ? 'Analyzing...' : 'Run AI'}</span>
                    </button>
                </div>
            </div>

            {/* Funnel Stats Banner */}
            {funnelStats && (
                <div className="grid grid-cols-5 gap-4">
                    <StatCard icon={Users} label="Total Leads" value={funnelStats.totalLeads} color="blue" />
                    <StatCard icon={Activity} label="Active" value={funnelStats.activeLeads} color="cyan" />
                    <StatCard icon={Trophy} label="Won" value={funnelStats.wonLeads} color="green" />
                    <StatCard icon={XCircle} label="Lost" value={funnelStats.lostLeads} color="red" />
                    <StatCard icon={Percent} label="Conversion" value={`${funnelStats.conversionRate}%`} color="purple" />
                </div>
            )}

            {/* Lead Type Tabs */}
            <div className="flex items-center space-x-2 bg-slate-800/50 rounded-xl p-1.5">
                <button
                    onClick={() => setLeadTypeFilter('all')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${leadTypeFilter === 'all'
                        ? 'bg-slate-700 text-white shadow-lg'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <Users size={14} />
                    <span>All</span>
                    <span className="px-1.5 py-0.5 text-xs bg-slate-600 text-slate-300 rounded-full">{leads.length}</span>
                </button>
                <button
                    onClick={() => setLeadTypeFilter('INBOUND')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${leadTypeFilter === 'INBOUND'
                        ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <Flame size={14} className={leadTypeFilter === 'INBOUND' ? 'text-white' : 'text-orange-400'} />
                    <span>Inbound</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${leadTypeFilter === 'INBOUND' ? 'bg-white/20 text-white' : 'bg-orange-500/20 text-orange-400'}`}>
                        {leadTypeStats.inbound}
                    </span>
                </button>
                <button
                    onClick={() => setLeadTypeFilter('OUTBOUND')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${leadTypeFilter === 'OUTBOUND'
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                        }`}
                >
                    <Snowflake size={14} className={leadTypeFilter === 'OUTBOUND' ? 'text-white' : 'text-blue-400'} />
                    <span>Outbound</span>
                    <span className={`px-1.5 py-0.5 text-xs rounded-full ${leadTypeFilter === 'OUTBOUND' ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-400'}`}>
                        {leadTypeStats.outbound}
                    </span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="flex items-center space-x-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[#1e293b] border border-slate-700/50 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <button onClick={fetchData} disabled={loading} className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-white">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* AI Suggestions Panel */}
            {showAIPanel && aiSuggestions.length > 0 && (
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                            <Bot className="text-purple-400" size={18} />
                            <h3 className="font-semibold text-purple-300">AI Made {aiSuggestions.length} Stage Changes</h3>
                        </div>
                        <button onClick={() => setShowAIPanel(false)} className="text-slate-500 hover:text-white">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {aiSuggestions.slice(0, 5).map((change, i) => (
                            <div key={i} className="flex items-center space-x-2 px-3 py-1.5 bg-slate-800/50 rounded-lg text-sm">
                                <span className="text-white font-medium">{change.name}</span>
                                <span className="text-slate-500">{change.from}</span>
                                <ArrowRight size={12} className="text-purple-400" />
                                <span className="text-purple-400">{change.to}</span>
                                <span className="text-xs text-slate-600">({change.confidence}%)</span>
                            </div>
                        ))}
                        {aiSuggestions.length > 5 && (
                            <span className="text-sm text-slate-500">+{aiSuggestions.length - 5} more</span>
                        )}
                    </div>
                </div>
            )}

            {/* Funnel View */}
            {viewMode === 'funnel' && (
                <div className="flex space-x-3 overflow-x-auto pb-4">
                    {STAGE_ORDER.map((stage, index) => {
                        const config = FUNNEL_CONFIG[stage];
                        const stageLeads = searchTerm
                            ? filteredLeads.filter(l => (l.funnel_stage || 'LEAD') === stage)
                            : leadsByStage[stage] || [];
                        const Icon = config.icon;

                        // Determine column width based on funnel position (narrower at ends)
                        const isEndStage = stage === 'WON' || stage === 'LOST';
                        const columnWidth = isEndStage ? 'w-56' : 'w-72';

                        return (
                            <div
                                key={stage}
                                className={`flex-shrink-0 ${columnWidth} flex flex-col`}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, stage)}
                            >
                                {/* Stage Header */}
                                <div className={`bg-${config.color}-500/10 border border-${config.color}-500/30 rounded-t-xl p-3`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Icon size={16} className={`text-${config.color}-400`} />
                                            <span className="font-semibold text-white">{config.label}</span>
                                        </div>
                                        <span className={`px-2 py-0.5 text-xs font-medium bg-${config.color}-500/20 text-${config.color}-400 rounded-full`}>
                                            {stageLeads.length}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-1">{config.description}</p>
                                </div>

                                {/* Stage Content */}
                                <div className={`flex-1 bg-slate-800/30 border-x border-b border-slate-700/50 rounded-b-xl p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-450px)] overflow-y-auto ${draggedLead ? 'ring-2 ring-blue-500/30' : ''}`}>
                                    {stageLeads.map(lead => (
                                        <FunnelCard
                                            key={lead.id}
                                            lead={lead}
                                            onDragStart={handleDragStart}
                                            onClick={() => setSelectedLead(lead)}
                                            onLockToggle={() => toggleStageLock(lead.id, lead.stage_locked)}
                                            getAvatarGradient={getAvatarGradient}
                                            navigate={navigate}
                                        />
                                    ))}
                                    {stageLeads.length === 0 && (
                                        <div className="flex flex-col items-center justify-center py-8 text-slate-600">
                                            <Icon size={24} className="mb-2 opacity-30" />
                                            <p className="text-xs">Drop leads here</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
                <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-slate-800/50">
                            <tr className="text-xs text-slate-500 uppercase tracking-wider">
                                <th className="text-left py-4 px-4 font-semibold">Lead</th>
                                <th className="text-left py-4 px-4 font-semibold">Stage</th>
                                <th className="text-left py-4 px-4 font-semibold">Company</th>
                                <th className="text-left py-4 px-4 font-semibold">AI Confidence</th>
                                <th className="text-left py-4 px-4 font-semibold">Last Activity</th>
                                <th className="text-center py-4 px-4 font-semibold">Lock</th>
                                <th className="text-right py-4 px-4 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {loading ? (
                                <tr><td colSpan="7" className="py-16 text-center text-slate-400"><RefreshCw className="animate-spin mx-auto" size={24} /></td></tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr><td colSpan="7" className="py-16 text-center text-slate-500">No leads found</td></tr>
                            ) : (
                                filteredLeads.map(lead => {
                                    const config = FUNNEL_CONFIG[lead.funnel_stage || 'LEAD'];
                                    return (
                                        <tr key={lead.id} className="hover:bg-slate-800/30 group">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarGradient(lead.name)} flex items-center justify-center text-white font-medium text-sm`}>
                                                        {lead.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{lead.name}</p>
                                                        <p className="text-xs text-slate-500">{lead.email || lead.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <select
                                                    value={lead.funnel_stage || 'LEAD'}
                                                    onChange={(e) => moveLeadToStage(lead.id, e.target.value)}
                                                    disabled={lead.stage_locked}
                                                    className={`bg-${config.color}-500/20 text-${config.color}-400 border border-${config.color}-500/30 rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50`}
                                                >
                                                    {STAGE_ORDER.map(s => (
                                                        <option key={s} value={s}>{FUNNEL_CONFIG[s].label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-3 px-4 text-sm text-slate-400">{lead.company || '—'}</td>
                                            <td className="py-3 px-4">
                                                {lead.ai_confidence ? (
                                                    <div className="flex items-center space-x-2">
                                                        <Bot size={12} className="text-purple-400" />
                                                        <span className="text-sm text-purple-400">{lead.ai_confidence}%</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-600">Manual</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-xs text-slate-500">
                                                {lead.last_activity ? formatDistanceToNow(new Date(lead.last_activity), { addSuffix: true }) : 'Never'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => toggleStageLock(lead.id, lead.stage_locked)}
                                                    className={`p-1.5 rounded-lg ${lead.stage_locked ? 'bg-amber-500/20 text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                                                >
                                                    {lead.stage_locked ? <Lock size={14} /> : <Unlock size={14} />}
                                                </button>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100">
                                                    <button onClick={() => navigate('/inbox', { state: { leadId: lead.id } })} className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg">
                                                        <MessageSquare size={14} />
                                                    </button>
                                                    <button onClick={() => setSelectedLead(lead)} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg">
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Lead Detail Slide-out */}
            {selectedLead && (
                <LeadDetailPanel
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                    onStageChange={moveLeadToStage}
                    onLockToggle={toggleStageLock}
                    getAvatarGradient={getAvatarGradient}
                    navigate={navigate}
                />
            )}

            {/* Add Lead Modal */}
            {showAddModal && (
                <Modal onClose={() => setShowAddModal(false)}>
                    <div className="p-6">
                        <h3 className="text-xl font-semibold text-white mb-6">Add New Lead</h3>
                        <div className="space-y-4">
                            <InputField label="Name" value={newLead.name} onChange={v => setNewLead({ ...newLead, name: v })} />
                            <div className="grid grid-cols-2 gap-4">
                                <InputField label="Phone *" value={newLead.phone} onChange={v => setNewLead({ ...newLead, phone: v })} />
                                <InputField label="Email" value={newLead.email} onChange={v => setNewLead({ ...newLead, email: v })} />
                            </div>
                            <InputField label="Company" value={newLead.company} onChange={v => setNewLead({ ...newLead, company: v })} />
                        </div>
                        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-700">
                            <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                            <button onClick={handleAddLead} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">Add Lead</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ========== COMPONENTS ==========

function StatCard({ icon: Icon, label, value, color }) {
    return (
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-4 hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl bg-${color}-500/20 flex items-center justify-center`}>
                    <Icon size={20} className={`text-${color}-400`} />
                </div>
            </div>
        </div>
    );
}

function FunnelCard({ lead, onDragStart, onClick, onLockToggle, getAvatarGradient, navigate }) {
    const config = FUNNEL_CONFIG[lead.funnel_stage || 'LEAD'];

    return (
        <div
            draggable={!lead.stage_locked}
            onDragStart={(e) => onDragStart(e, lead)}
            onClick={onClick}
            className={`bg-[#1e293b] rounded-xl border border-slate-700/50 p-3 cursor-grab hover:border-slate-600 transition-all group ${lead.stage_locked ? 'opacity-75' : ''} ${lead.warning ? 'border-amber-500/50' : ''}`}
        >
            <div className="flex items-center space-x-2 mb-2">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${getAvatarGradient(lead.name)} flex items-center justify-center text-white font-medium text-sm shadow-lg`}>
                    {lead.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{lead.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{lead.company || lead.email || lead.phone}</p>
                </div>
                {lead.stage_locked && <Lock size={12} className="text-amber-400" />}
                {lead.ai_confidence && !lead.stage_locked && (
                    <div className="flex items-center space-x-1" title={`AI: ${lead.last_ai_reason}`}>
                        <Bot size={10} className="text-purple-400" />
                        <span className="text-[10px] text-purple-400">{lead.ai_confidence}%</span>
                    </div>
                )}
            </div>

            {/* Warning badge */}
            {lead.warning && (
                <div className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] mb-2 ${lead.warning.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    <AlertCircle size={10} />
                    <span>{lead.warning.message}</span>
                </div>
            )}

            {/* Quick actions */}
            <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center space-x-1">
                    <button
                        onClick={(e) => { e.stopPropagation(); navigate('/inbox', { state: { leadId: lead.id } }); }}
                        className="p-1 hover:bg-blue-500/20 text-blue-400 rounded"
                    >
                        <MessageSquare size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onLockToggle(); }}
                        className={`p-1 rounded ${lead.stage_locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {lead.stage_locked ? <Lock size={12} /> : <Unlock size={12} />}
                    </button>
                </div>
                <GripVertical size={12} className="text-slate-600" />
            </div>
        </div>
    );
}

function LeadDetailPanel({ lead, onClose, onStageChange, onLockToggle, getAvatarGradient, navigate }) {
    const [history, setHistory] = useState([]);
    const config = FUNNEL_CONFIG[lead.funnel_stage || 'LEAD'];

    useEffect(() => {
        axios.get(`/api/leads/${lead.id}/stage-history`).then(res => setHistory(res.data)).catch(() => { });
    }, [lead.id]);

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-[#1e293b] border-l border-slate-700 shadow-2xl z-50 flex flex-col">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white">Lead Details</h3>
                <button onClick={onClose} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded-lg"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* Lead Info */}
                <div className="text-center mb-6">
                    <div className={`w-16 h-16 mx-auto rounded-xl bg-gradient-to-br ${getAvatarGradient(lead.name)} flex items-center justify-center text-white text-2xl font-bold shadow-xl`}>
                        {lead.name?.charAt(0) || '?'}
                    </div>
                    <h2 className="text-lg font-bold text-white mt-3">{lead.name}</h2>
                    <p className="text-slate-400 text-sm">{lead.company}</p>
                </div>

                {/* Stage Selector */}
                <div className="mb-6">
                    <label className="text-xs text-slate-500 uppercase tracking-wide block mb-2">Current Stage</label>
                    <div className="flex items-center space-x-2">
                        <select
                            value={lead.funnel_stage || 'LEAD'}
                            onChange={(e) => onStageChange(lead.id, e.target.value)}
                            disabled={lead.stage_locked}
                            className={`flex-1 bg-${config.color}-500/20 text-${config.color}-400 border border-${config.color}-500/30 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50`}
                        >
                            {STAGE_ORDER.map(s => (
                                <option key={s} value={s}>{FUNNEL_CONFIG[s].label}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => onLockToggle(lead.id, lead.stage_locked)}
                            className={`p-2 rounded-lg border ${lead.stage_locked ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'border-slate-700 text-slate-500'}`}
                            title={lead.stage_locked ? 'Unlock for AI' : 'Lock stage'}
                        >
                            {lead.stage_locked ? <Lock size={16} /> : <Unlock size={16} />}
                        </button>
                    </div>
                </div>

                {/* AI Info */}
                {lead.ai_confidence && (
                    <div className="mb-6 p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                        <div className="flex items-center space-x-2 mb-1">
                            <Bot size={14} className="text-purple-400" />
                            <span className="text-sm font-medium text-purple-400">AI Decision</span>
                        </div>
                        <p className="text-xs text-slate-400">{lead.last_ai_reason}</p>
                        <p className="text-xs text-purple-400 mt-1">Confidence: {lead.ai_confidence}%</p>
                    </div>
                )}

                {/* Stage History */}
                <div>
                    <h4 className="text-xs text-slate-500 uppercase tracking-wide mb-2">Stage History</h4>
                    <div className="space-y-2">
                        {history.slice(0, 10).map((h, i) => (
                            <div key={i} className="flex items-center space-x-2 text-xs p-2 bg-slate-800/50 rounded-lg">
                                {h.changed_by === 'AI' ? <Bot size={12} className="text-purple-400" /> : <Hand size={12} className="text-blue-400" />}
                                <span className="text-slate-500">{h.from_stage}</span>
                                <ArrowRight size={10} className="text-slate-600" />
                                <span className="text-white">{h.to_stage}</span>
                                <span className="text-slate-600 ml-auto">{format(new Date(h.created_at), 'MMM d')}</span>
                            </div>
                        ))}
                        {history.length === 0 && <p className="text-xs text-slate-600">No stage changes yet</p>}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={() => navigate('/inbox', { state: { leadId: lead.id } })}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl font-medium"
                >
                    <MessageSquare size={16} />
                    <span>Open Conversation</span>
                </button>
            </div>
        </div>
    );
}

function Modal({ children, onClose }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text' }) {
    return (
        <div>
            <label className="block text-sm text-slate-400 mb-1.5">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500/50 placeholder-slate-600"
            />
        </div>
    );
}
