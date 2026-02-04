import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import {
    Sparkles, Zap, Mail, MessageSquare, Phone, Linkedin, Plus, Trash2,
    GripVertical, Edit3, Save, Play, Wand2, Flame, Snowflake, ChevronRight,
    CheckCircle, X, MoreVertical, Copy, Power, PowerOff, Clock, Users,
    ArrowUp, ArrowDown, Target, TrendingUp, Activity, AlertCircle, RefreshCw,
    ChevronDown, Settings, Eye, EyeOff, Voicemail
} from 'lucide-react';

// Step type configuration
const STEP_CONFIG = {
    SMS: { icon: MessageSquare, color: 'blue', label: 'SMS', gradient: 'from-blue-500 to-indigo-500' },
    EMAIL: { icon: Mail, color: 'purple', label: 'Email', gradient: 'from-purple-500 to-pink-500' },
    CALL: { icon: Phone, color: 'green', label: 'Call', gradient: 'from-green-500 to-emerald-500' },
    RVM: { icon: Voicemail, color: 'amber', label: 'Ringless VM', gradient: 'from-amber-500 to-orange-500' },
    LINKEDIN: { icon: Linkedin, color: 'sky', label: 'LinkedIn', gradient: 'from-sky-500 to-blue-500' }
};

export default function Campaigns() {
    const [sequences, setSequences] = useState([]);
    const [selectedSequence, setSelectedSequence] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [showGenerator, setShowGenerator] = useState(false);
    const [leadTypeTab, setLeadTypeTab] = useState('OUTBOUND');
    const [showNewModal, setShowNewModal] = useState(false);
    const [showStepModal, setShowStepModal] = useState(false);
    const [editingStep, setEditingStep] = useState(null);
    const [newSequenceName, setNewSequenceName] = useState('');
    const [expandedSteps, setExpandedSteps] = useState({});
    const [generatorParams, setGeneratorParams] = useState({
        industry: '',
        product: 'Fleet GPS Tracking',
        painPoints: '',
        tone: 'professional',
        steps: 5,
        channels: ['SMS', 'EMAIL', 'CALL']
    });

    useEffect(() => {
        fetchSequences();
    }, [leadTypeTab]);

    // Memoized sequence stats
    const sequenceStats = useMemo(() => {
        const activeCount = sequences.filter(s => s.is_active).length;
        const totalSteps = sequences.reduce((acc, s) => acc + (s.steps?.length || 0), 0);
        return { total: sequences.length, active: activeCount, totalSteps };
    }, [sequences]);

    const fetchSequences = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/sequences?lead_type=${leadTypeTab}`);
            setSequences(res.data);
            // Auto-select first sequence if none selected
            if (res.data.length > 0) {
                const currentExists = selectedSequence && res.data.find(s => s.id === selectedSequence.id);
                if (!currentExists) {
                    setSelectedSequence(res.data[0]);
                }
            } else {
                setSelectedSequence(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [leadTypeTab]);

    const handleGenerateSequence = useCallback(async () => {
        if (!selectedSequence) return;
        setGenerating(true);
        try {
            const res = await axios.post('/api/ai/generate-sequence', {
                ...generatorParams,
                leadType: leadTypeTab // Pass lead type for context
            });
            if (res.data.success && res.data.sequence) {
                await axios.put(`/api/sequences/${selectedSequence.id}`, {
                    steps: res.data.sequence
                });
                setSelectedSequence(prev => ({ ...prev, steps: res.data.sequence }));
                setShowGenerator(false);
                await fetchSequences();
            }
        } catch (err) {
            alert('Generation failed: ' + (err.response?.data?.error || err.message));
        } finally {
            setGenerating(false);
        }
    }, [selectedSequence, generatorParams, leadTypeTab, fetchSequences]);

    const handleSaveSequence = useCallback(async () => {
        if (!selectedSequence) return;
        setSaving(true);
        try {
            await axios.put(`/api/sequences/${selectedSequence.id}`, {
                steps: selectedSequence.steps,
                name: selectedSequence.name,
                description: selectedSequence.description
            });
            // Update local state
            setSequences(prev => prev.map(s => s.id === selectedSequence.id ? selectedSequence : s));
        } catch (err) {
            alert('Save failed: ' + err.message);
        } finally {
            setSaving(false);
            setTimeout(() => setSaving(false), 500);
        }
    }, [selectedSequence]);

    const handleCreateSequence = useCallback(async () => {
        if (!newSequenceName.trim()) return;
        try {
            const res = await axios.post('/api/sequences', {
                name: newSequenceName,
                lead_type: leadTypeTab,
                description: `${leadTypeTab === 'INBOUND' ? 'Hot' : 'Cold'} lead sequence`,
                steps: []
            });
            setShowNewModal(false);
            setNewSequenceName('');
            await fetchSequences();
            const newSeq = await axios.get(`/api/sequences/${res.data.id}`);
            setSelectedSequence(newSeq.data);
        } catch (err) {
            alert('Failed to create sequence');
        }
    }, [newSequenceName, leadTypeTab, fetchSequences]);

    const handleDuplicateSequence = useCallback(async (seq) => {
        try {
            const res = await axios.post('/api/sequences', {
                name: `${seq.name} (Copy)`,
                lead_type: seq.lead_type,
                description: seq.description,
                steps: seq.steps
            });
            await fetchSequences();
            const newSeq = await axios.get(`/api/sequences/${res.data.id}`);
            setSelectedSequence(newSeq.data);
        } catch (err) {
            alert('Failed to duplicate');
        }
    }, [fetchSequences]);

    const handleToggleActive = useCallback(async (seq) => {
        try {
            await axios.put(`/api/sequences/${seq.id}`, {
                is_active: seq.is_active ? 0 : 1
            });
            await fetchSequences();
            if (selectedSequence?.id === seq.id) {
                setSelectedSequence(prev => ({ ...prev, is_active: prev.is_active ? 0 : 1 }));
            }
        } catch (err) {
            alert('Failed to toggle status');
        }
    }, [fetchSequences, selectedSequence]);

    const handleDeleteSequence = useCallback(async (id) => {
        if (!confirm('Delete this sequence? This cannot be undone.')) return;
        try {
            await axios.delete(`/api/sequences/${id}`);
            if (selectedSequence?.id === id) {
                setSelectedSequence(null);
            }
            await fetchSequences();
        } catch (err) {
            alert('Failed to delete');
        }
    }, [selectedSequence, fetchSequences]);

    const handleMoveStep = useCallback((index, direction) => {
        if (!selectedSequence) return;
        const newSteps = [...selectedSequence.steps];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newSteps.length) return;

        [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
        setSelectedSequence(prev => ({ ...prev, steps: newSteps }));
    }, [selectedSequence]);

    const handleDeleteStep = useCallback((index) => {
        if (!selectedSequence) return;
        const newSteps = selectedSequence.steps.filter((_, i) => i !== index);
        setSelectedSequence(prev => ({ ...prev, steps: newSteps }));
    }, [selectedSequence]);

    const handleAddStep = useCallback((type) => {
        if (!selectedSequence) return;
        const newStep = {
            id: Date.now(),
            type,
            delayDays: selectedSequence.steps?.length || 0,
            content: '',
            subject: type === 'EMAIL' ? '' : undefined
        };
        setSelectedSequence(prev => ({
            ...prev,
            steps: [...(prev.steps || []), newStep]
        }));
        setShowStepModal(false);
    }, [selectedSequence]);

    const toggleStepExpand = useCallback((index) => {
        setExpandedSteps(prev => ({ ...prev, [index]: !prev[index] }));
    }, []);

    // Update a step's property
    const handleUpdateStep = useCallback((index, field, value) => {
        if (!selectedSequence) return;
        const newSteps = [...selectedSequence.steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSelectedSequence(prev => ({ ...prev, steps: newSteps }));
    }, [selectedSequence]);

    // Update variant content
    const handleUpdateVariant = useCallback((stepIndex, variantIndex, value) => {
        if (!selectedSequence) return;
        const newSteps = [...selectedSequence.steps];
        const newVariants = [...newSteps[stepIndex].variants];
        newVariants[variantIndex] = { ...newVariants[variantIndex], content: value };
        newSteps[stepIndex] = { ...newSteps[stepIndex], variants: newVariants };
        setSelectedSequence(prev => ({ ...prev, steps: newSteps }));
    }, [selectedSequence]);

    // Render helpers
    const getStepIcon = (type) => {
        const config = STEP_CONFIG[type];
        if (!config) return <Zap size={16} className="text-slate-400" />;
        const Icon = config.icon;
        return <Icon size={16} className={`text-${config.color}-400`} />;
    };

    const getStepColor = (type) => {
        const config = STEP_CONFIG[type];
        return config ? `border-${config.color}-500/30 bg-${config.color}-500/5` : 'border-slate-500/30 bg-slate-500/5';
    };

    return (
        <div className="flex h-full">
            {/* Left Panel - Sequence List */}
            <div className="w-80 bg-slate-900/50 border-r border-slate-700/50 flex flex-col">
                {/* Lead Type Tabs */}
                <div className="p-4 border-b border-slate-700/50">
                    <div className="flex items-center bg-slate-800/80 rounded-xl p-1 mb-3">
                        <button
                            onClick={() => { setLeadTypeTab('INBOUND'); setSelectedSequence(null); }}
                            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${leadTypeTab === 'INBOUND'
                                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Flame size={16} />
                            <span>Inbound</span>
                        </button>
                        <button
                            onClick={() => { setLeadTypeTab('OUTBOUND'); setSelectedSequence(null); }}
                            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-lg text-sm font-medium transition-all ${leadTypeTab === 'OUTBOUND'
                                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-500/25'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <Snowflake size={16} />
                            <span>Outbound</span>
                        </button>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-white">{sequenceStats.total}</div>
                            <div className="text-[10px] text-slate-500 uppercase">Sequences</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-green-400">{sequenceStats.active}</div>
                            <div className="text-[10px] text-slate-500 uppercase">Active</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                            <div className="text-lg font-bold text-purple-400">{sequenceStats.totalSteps}</div>
                            <div className="text-[10px] text-slate-500 uppercase">Steps</div>
                        </div>
                    </div>
                </div>

                {/* Sequence List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw size={24} className="animate-spin text-slate-500" />
                        </div>
                    ) : sequences.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            {leadTypeTab === 'INBOUND' ? (
                                <Flame size={40} className="mx-auto mb-3 text-orange-500/30" />
                            ) : (
                                <Snowflake size={40} className="mx-auto mb-3 text-blue-500/30" />
                            )}
                            <p className="text-sm mb-1">No {leadTypeTab.toLowerCase()} sequences</p>
                            <p className="text-xs text-slate-600">Create one to get started</p>
                        </div>
                    ) : (
                        sequences.map(seq => (
                            <div
                                key={seq.id}
                                onClick={() => setSelectedSequence(seq)}
                                className={`group relative p-3 rounded-xl border cursor-pointer transition-all ${selectedSequence?.id === seq.id
                                    ? leadTypeTab === 'INBOUND'
                                        ? 'bg-orange-500/10 border-orange-500/40 shadow-lg shadow-orange-500/10'
                                        : 'bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/10'
                                    : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/60'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center space-x-2">
                                        {seq.is_active ? (
                                            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-slate-600" />
                                        )}
                                        <span className="font-medium text-white text-sm truncate max-w-[160px]">{seq.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDuplicateSequence(seq); }}
                                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white"
                                            title="Duplicate"
                                        >
                                            <Copy size={12} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleActive(seq); }}
                                            className={`p-1 hover:bg-slate-700 rounded ${seq.is_active ? 'text-green-400' : 'text-slate-500'}`}
                                            title={seq.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            {seq.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-xs text-slate-500">{seq.steps?.length || 0} steps</span>
                                        {seq.steps?.length > 0 && (
                                            <div className="flex items-center -space-x-1">
                                                {[...new Set(seq.steps.map(s => s.type))].slice(0, 4).map((type, i) => (
                                                    <div key={i} className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center border border-slate-600">
                                                        {getStepIcon(type)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {seq.updated_at && (
                                        <span className="text-[10px] text-slate-600">
                                            {formatDistanceToNow(new Date(seq.updated_at), { addSuffix: true })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* New Sequence Button */}
                <div className="p-3 border-t border-slate-700/50">
                    <button
                        onClick={() => setShowNewModal(true)}
                        className={`w-full flex items-center justify-center space-x-2 py-3 rounded-xl font-medium text-sm transition-all ${leadTypeTab === 'INBOUND'
                            ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 text-orange-400 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10'
                            : 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 text-blue-400 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10'
                            }`}
                    >
                        <Plus size={16} />
                        <span>New Sequence</span>
                    </button>
                </div>
            </div>

            {/* Right Panel - Sequence Editor */}
            <div className="flex-1 flex flex-col bg-slate-900/30">
                {selectedSequence ? (
                    <>
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 bg-slate-800/30">
                            <div className="flex items-center space-x-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${leadTypeTab === 'INBOUND'
                                    ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/25'
                                    : 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25'
                                    }`}>
                                    {leadTypeTab === 'INBOUND' ? <Flame size={24} className="text-white" /> : <Snowflake size={24} className="text-white" />}
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h1 className="text-lg font-bold text-white">{selectedSequence.name}</h1>
                                        {selectedSequence.is_active ? (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 rounded-full">ACTIVE</span>
                                        ) : (
                                            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded-full">INACTIVE</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-500">{selectedSequence.steps?.length || 0} steps • {leadTypeTab}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setShowGenerator(!showGenerator)}
                                    className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all"
                                >
                                    <Wand2 size={16} />
                                    <span>AI Generate</span>
                                </button>
                                <button
                                    onClick={handleSaveSequence}
                                    disabled={saving}
                                    className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${saving
                                        ? 'bg-green-500 text-white'
                                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                                        }`}
                                >
                                    {saving ? <CheckCircle size={16} /> : <Save size={16} />}
                                    <span>{saving ? 'Saved!' : 'Save'}</span>
                                </button>
                                <button
                                    onClick={() => handleDeleteSequence(selectedSequence.id)}
                                    className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>

                        {/* AI Generator Panel */}
                        {showGenerator && (
                            <div className="m-4 p-5 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center space-x-2">
                                        <Sparkles size={20} className="text-purple-400" />
                                        <h2 className="font-semibold text-white">AI Sequence Generator</h2>
                                    </div>
                                    <button onClick={() => setShowGenerator(false)} className="text-slate-400 hover:text-white">
                                        <X size={18} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5">Target Industry</label>
                                        <input
                                            type="text"
                                            value={generatorParams.industry}
                                            onChange={(e) => setGeneratorParams(p => ({ ...p, industry: e.target.value }))}
                                            placeholder="e.g., Construction"
                                            className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5">Product/Service</label>
                                        <input
                                            type="text"
                                            value={generatorParams.product}
                                            onChange={(e) => setGeneratorParams(p => ({ ...p, product: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5">Number of Steps</label>
                                        <select
                                            value={generatorParams.steps}
                                            onChange={(e) => setGeneratorParams(p => ({ ...p, steps: parseInt(e.target.value) }))}
                                            className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm"
                                        >
                                            {[3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n} steps</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1.5">Tone</label>
                                        <select
                                            value={generatorParams.tone}
                                            onChange={(e) => setGeneratorParams(p => ({ ...p, tone: e.target.value }))}
                                            className="w-full px-3 py-2.5 bg-slate-800/80 border border-slate-700 rounded-lg text-white text-sm"
                                        >
                                            <option value="professional">Professional</option>
                                            <option value="casual">Casual</option>
                                            <option value="urgent">Urgent</option>
                                            <option value="friendly">Friendly</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        {['SMS', 'EMAIL', 'CALL', 'LINKEDIN'].map(ch => (
                                            <label key={ch} className="flex items-center space-x-1.5 text-sm text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={generatorParams.channels.includes(ch)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setGeneratorParams(p => ({ ...p, channels: [...p.channels, ch] }));
                                                        } else {
                                                            setGeneratorParams(p => ({ ...p, channels: p.channels.filter(c => c !== ch) }));
                                                        }
                                                    }}
                                                    className="rounded bg-slate-700 border-slate-600 text-purple-500"
                                                />
                                                <span>{ch}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleGenerateSequence}
                                        disabled={generating}
                                        className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 shadow-lg shadow-purple-500/25"
                                    >
                                        {generating ? (
                                            <><RefreshCw size={16} className="animate-spin" /><span>Generating...</span></>
                                        ) : (
                                            <><Sparkles size={16} /><span>Generate Sequence</span></>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Sequence Steps */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {selectedSequence.steps?.length === 0 ? (
                                <div className="text-center py-16 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                                    <Zap size={56} className="mx-auto text-slate-600 mb-4" />
                                    <p className="text-slate-400 mb-2 text-lg">No steps yet</p>
                                    <p className="text-slate-600 text-sm mb-6">Use AI to generate a sequence or add steps manually</p>
                                    <div className="flex items-center justify-center space-x-3">
                                        <button
                                            onClick={() => setShowGenerator(true)}
                                            className="px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-500 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <Wand2 size={16} />
                                                <span>AI Generate</span>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => setShowStepModal(true)}
                                            className="px-5 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-medium hover:bg-slate-600 transition-colors"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <Plus size={16} />
                                                <span>Add Step</span>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedSequence.steps.map((step, index) => {
                                        const config = STEP_CONFIG[step.type] || {};
                                        const Icon = config.icon || Zap;
                                        const isExpanded = expandedSteps[index];

                                        return (
                                            <div
                                                key={step.id || index}
                                                className={`rounded-xl border transition-all ${isExpanded
                                                    ? `border-${config.color || 'slate'}-500/40 bg-${config.color || 'slate'}-500/10`
                                                    : 'border-slate-700/50 bg-slate-800/30 hover:border-slate-600'
                                                    }`}
                                            >
                                                {/* Step Header */}
                                                <div
                                                    className="flex items-center justify-between p-4 cursor-pointer"
                                                    onClick={() => toggleStepExpand(index)}
                                                >
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex items-center space-x-2">
                                                            <GripVertical size={16} className="text-slate-600 cursor-grab" />
                                                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${config.gradient || 'from-slate-500 to-slate-600'} flex items-center justify-center shadow-lg`}>
                                                                <span className="text-xs font-bold text-white">{index + 1}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center space-x-2">
                                                                <Icon size={16} className={`text-${config.color || 'slate'}-400`} />
                                                                <span className="font-medium text-white">{step.type}</span>
                                                                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded">
                                                                    Day +{step.delayDays || 0}
                                                                </span>
                                                                {step.variants && (
                                                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full">A/B</span>
                                                                )}
                                                            </div>
                                                            {step.subject && (
                                                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-md">{step.subject}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 'up'); }}
                                                            disabled={index === 0}
                                                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white disabled:opacity-30"
                                                        >
                                                            <ArrowUp size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 'down'); }}
                                                            disabled={index === selectedSequence.steps.length - 1}
                                                            className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white disabled:opacity-30"
                                                        >
                                                            <ArrowDown size={14} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteStep(index); }}
                                                            className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                        <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>

                                                {/* Step Content (Expanded) - EDITABLE */}
                                                {isExpanded && (
                                                    <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
                                                        {/* Cadence / Delay */}
                                                        <div className="flex items-center space-x-4">
                                                            <div className="flex items-center space-x-2">
                                                                <Clock size={14} className="text-slate-500" />
                                                                <span className="text-xs text-slate-400">Wait</span>
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max="30"
                                                                    value={step.delayDays || 0}
                                                                    onChange={(e) => handleUpdateStep(index, 'delayDays', parseInt(e.target.value) || 0)}
                                                                    className="w-16 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                />
                                                                <span className="text-xs text-slate-400">days before sending</span>
                                                            </div>
                                                        </div>

                                                        {/* Subject (for Email) */}
                                                        {step.type === 'EMAIL' && (
                                                            <div>
                                                                <label className="block text-xs text-slate-400 mb-1.5">Subject Line</label>
                                                                <input
                                                                    type="text"
                                                                    value={step.subject || ''}
                                                                    onChange={(e) => handleUpdateStep(index, 'subject', e.target.value)}
                                                                    placeholder="Enter email subject..."
                                                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                                />
                                                            </div>
                                                        )}

                                                        {/* Ringless Voicemail Specific UI */}
                                                        {step.type === 'RVM' ? (
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <label className="block text-xs text-slate-400 mb-1.5">Audio File</label>
                                                                    <div className="flex items-center space-x-2">
                                                                        <select
                                                                            value={step.audioFile || ''}
                                                                            onChange={(e) => handleUpdateStep(index, 'audioFile', e.target.value)}
                                                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                                                        >
                                                                            <option value="">Select a recording...</option>
                                                                            <option value="intro_vm.mp3">Intro Voicemail (0:45)</option>
                                                                            <option value="followup_vm.mp3">Follow-up Voicemail (0:30)</option>
                                                                            <option value="offer_vm.mp3">Special Offer (1:00)</option>
                                                                        </select>
                                                                        <button className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors">
                                                                            <Upload size={16} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs text-slate-400 mb-1.5">Voicemail Script (Reference)</label>
                                                                    <textarea
                                                                        value={step.content || ''}
                                                                        onChange={(e) => handleUpdateStep(index, 'content', e.target.value)}
                                                                        placeholder="Type the script here for reference..."
                                                                        rows={3}
                                                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Standard Content / Message for details other than RVM */
                                                            step.variants ? (
                                                                <div className="space-y-3">
                                                                    <label className="block text-xs text-slate-400">A/B Test Variants</label>
                                                                    {step.variants.map((v, vi) => (
                                                                        <div key={vi} className="space-y-1">
                                                                            <div className="flex items-center space-x-2">
                                                                                <span className="px-2 py-0.5 text-xs font-bold bg-purple-500/20 text-purple-400 rounded">Variant {v.name}</span>
                                                                            </div>
                                                                            <textarea
                                                                                value={v.content || ''}
                                                                                onChange={(e) => handleUpdateVariant(index, vi, e.target.value)}
                                                                                placeholder={`Enter ${step.type} content for variant ${v.name}...`}
                                                                                rows={3}
                                                                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <label className="block text-xs text-slate-400 mb-1.5">
                                                                        {step.type === 'CALL' ? 'Call Script / Notes' :
                                                                            step.type === 'LINKEDIN' ? 'Connection Message' : 'Message Content'}
                                                                    </label>
                                                                    <textarea
                                                                        value={step.content || ''}
                                                                        onChange={(e) => handleUpdateStep(index, 'content', e.target.value)}
                                                                        placeholder={`Enter ${step.type.toLowerCase()} content... Use {{firstName}}, {{company}} for personalization`}
                                                                        rows={step.type === 'EMAIL' ? 6 : 4}
                                                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                    />
                                                                    <p className="text-[10px] text-slate-600 mt-1">
                                                                        Placeholders: {'{'}firstName{'}'}, {'{'}lastName{'}'}, {'{'}company{'}'}, {'{'}industry{'}'}
                                                                    </p>
                                                                </div>
                                                            )

                                                        )}

                                                        {/* Description for manual steps */}
                                                        {(step.type === 'CALL' || step.type === 'LINKEDIN') && (
                                                            <div>
                                                                <label className="block text-xs text-slate-400 mb-1.5">Task Description (optional)</label>
                                                                <input
                                                                    type="text"
                                                                    value={step.description || ''}
                                                                    onChange={(e) => handleUpdateStep(index, 'description', e.target.value)}
                                                                    placeholder="e.g., Follow up on demo request"
                                                                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Add Step Button */}
                                    <button
                                        onClick={() => setShowStepModal(true)}
                                        className="w-full py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-500 hover:text-white hover:border-slate-500 transition-colors flex items-center justify-center space-x-2"
                                    >
                                        <Plus size={18} />
                                        <span>Add Step</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center">
                            {leadTypeTab === 'INBOUND' ? (
                                <Flame size={64} className="mx-auto mb-4 text-orange-500/20" />
                            ) : (
                                <Snowflake size={64} className="mx-auto mb-4 text-blue-500/20" />
                            )}
                            <p className="text-slate-500 mb-2">Select a sequence to edit</p>
                            <p className="text-slate-600 text-sm">or create a new one from the sidebar</p>
                        </div>
                    </div>
                )}
            </div>

            {/* New Sequence Modal */}
            {showNewModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowNewModal(false)}>
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center space-x-3 mb-5">
                            {leadTypeTab === 'INBOUND' ? (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                                    <Flame size={20} className="text-white" />
                                </div>
                            ) : (
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                                    <Snowflake size={20} className="text-white" />
                                </div>
                            )}
                            <h3 className="text-lg font-semibold text-white">
                                New {leadTypeTab === 'INBOUND' ? 'Inbound' : 'Outbound'} Sequence
                            </h3>
                        </div>
                        <input
                            type="text"
                            value={newSequenceName}
                            onChange={(e) => setNewSequenceName(e.target.value)}
                            placeholder="e.g., Google Ads Follow-up, Cold Email V2..."
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateSequence()}
                        />
                        <div className="flex justify-end space-x-3">
                            <button onClick={() => setShowNewModal(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                            <button
                                onClick={handleCreateSequence}
                                disabled={!newSequenceName.trim()}
                                className={`px-6 py-2.5 text-white rounded-xl font-medium disabled:opacity-50 ${leadTypeTab === 'INBOUND'
                                    ? 'bg-gradient-to-r from-orange-500 to-red-500'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                    }`}
                            >
                                Create Sequence
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Step Modal */}
            {showStepModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowStepModal(false)}>
                    <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-white mb-5">Add Step</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(STEP_CONFIG).map(([type, config]) => {
                                const Icon = config.icon;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => handleAddStep(type)}
                                        className={`p-4 rounded-xl border border-${config.color}-500/30 bg-${config.color}-500/10 hover:bg-${config.color}-500/20 hover:border-${config.color}-500/50 transition-all text-left`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-2`}>
                                            <Icon size={20} className="text-white" />
                                        </div>
                                        <span className="font-medium text-white">{config.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <button onClick={() => setShowStepModal(false)} className="w-full mt-4 py-2 text-slate-400 hover:text-white text-sm">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}
