import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
    Send, User, AlertCircle, MessageSquare, Search, Phone, Mail, MoreVertical,
    Plus, Sparkles, Info, X, ChevronDown, Filter, Star, Archive, Trash2,
    Clock, CheckCheck, Linkedin, Hash, Tag, Calendar, TrendingUp, Eye,
    RefreshCw, Volume2, PhoneCall, PhoneOff, MessageCircle
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';

export default function Inbox() {
    const [leads, setLeads] = useState([]);
    const [filteredLeads, setFilteredLeads] = useState([]);
    const [activeLead, setActiveLead] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showContactPanel, setShowContactPanel] = useState(true);
    const [filter, setFilter] = useState('all'); // all, unread, starred, archived
    const [showFilters, setShowFilters] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [starredLeads, setStarredLeads] = useState(new Set());
    const [classification, setClassification] = useState(null);
    const [classifying, setClassifying] = useState(false);
    const messagesEndRef = useRef(null);
    const location = useLocation();
    const toast = useToast();
    const messageInputRef = useRef(null);

    useEffect(() => {
        fetchLeads();
    }, []);

    useEffect(() => {
        // Filter leads based on search and filter type
        let result = leads;

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(lead =>
                (lead.name && lead.name.toLowerCase().includes(q)) ||
                (lead.phone && lead.phone.includes(q)) ||
                (lead.email && lead.email.toLowerCase().includes(q)) ||
                (lead.company && lead.company.toLowerCase().includes(q)) ||
                (lead.product_interest && lead.product_interest.toLowerCase().includes(q))
            );
        }

        if (filter === 'unread') {
            result = result.filter(l => l.status === 'MANUAL_INTERVENTION');
        } else if (filter === 'starred') {
            result = result.filter(l => starredLeads.has(l.id));
        }

        setFilteredLeads(result);
    }, [searchQuery, leads, filter, starredLeads]);

    const fetchLeads = async () => {
        try {
            const res = await axios.get('/api/leads');
            const sorted = res.data.sort((a, b) => {
                if (a.status === 'MANUAL_INTERVENTION' && b.status !== 'MANUAL_INTERVENTION') return -1;
                if (a.status !== 'MANUAL_INTERVENTION' && b.status === 'MANUAL_INTERVENTION') return 1;
                return new Date(b.last_contacted_at || b.created_at) - new Date(a.last_contacted_at || a.created_at);
            });
            setLeads(sorted);
            setFilteredLeads(sorted);

            if (location.state?.leadId) {
                const target = sorted.find(l => l.id === location.state.leadId);
                if (target) setActiveLead(target);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        if (!activeLead) return;
        fetchMessages(activeLead.id);
        const interval = setInterval(() => fetchMessages(activeLead.id), 3000);
        return () => clearInterval(interval);
    }, [activeLead]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchMessages = async (leadId) => {
        try {
            const res = await axios.get(`/api/messages/${leadId}`);
            setMessages(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleGenerateAI = async () => {
        if (!activeLead) return;
        setIsTyping(true);
        try {
            const res = await axios.post('/api/ai/generate', { leadId: activeLead.id });
            setNewMessage(res.data.draft);
            toast.success('Draft generated');
            messageInputRef.current?.focus();
        } catch (err) {
            toast.error('Failed to generate draft');
        } finally {
            setIsTyping(false);
        }
    };

    const handleClassifyLast = async () => {
        const lastInbound = messages.filter(m => m.direction === 'INBOUND').pop();
        if (!lastInbound) return;

        setClassifying(true);
        try {
            const res = await axios.post('/api/ai/classify', {
                message: lastInbound.content,
                messageId: lastInbound.id
            });
            setClassification(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setClassifying(false);
        }
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeLead) return;

        try {
            await axios.post('/api/messages', {
                leadId: activeLead.id,
                content: newMessage
            });
            setNewMessage('');
            fetchMessages(activeLead.id);
            toast.success('Message sent');
        } catch (err) {
            toast.error('Failed to send message');
        }
    };

    const handleCall = async () => {
        if (!activeLead) return;
        try {
            await axios.post('/api/calls/initiate', { leadId: activeLead.id });
            toast.success(`Calling ${activeLead.name || activeLead.phone}...`);
        } catch (err) {
            toast.error('Call failed to initiate');
            // Fallback to tel link if API fails
            window.location.href = `tel:${activeLead.phone}`;
        }
    };

    const handleEmail = () => {
        if (!activeLead) return;
        // Focus input and set placeholder/draft
        messageInputRef.current?.focus();
        if (!newMessage) {
            setNewMessage(`Hi ${activeLead.name ? activeLead.name.split(' ')[0] : ''}, `);
        }
    };

    const handleLinkedIn = () => {
        if (!activeLead?.linkedin_url) {
            toast.info('No LinkedIn URL for this contact');
            return;
        }
        window.open(activeLead.linkedin_url, '_blank');
    };

    const toggleStar = (leadId) => {
        setStarredLeads(prev => {
            const newSet = new Set(prev);
            if (newSet.has(leadId)) {
                newSet.delete(leadId);
            } else {
                newSet.add(leadId);
            }
            return newSet;
        });
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return format(d, 'h:mm a');
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return format(d, 'EEE');
        return format(d, 'MMM d');
    };

    const getMessageIcon = (type) => {
        const icons = {
            SMS: <MessageSquare size={12} className="text-blue-400" />,
            EMAIL: <Mail size={12} className="text-purple-400" />,
            CALL: <Phone size={12} className="text-green-400" />,
            LINKEDIN: <Linkedin size={12} className="text-sky-400" />,
            VOICEMAIL: <Volume2 size={12} className="text-amber-400" />
        };
        return icons[type] || <MessageCircle size={12} className="text-slate-400" />;
    };

    const getClassificationBadge = (classification) => {
        const badges = {
            INTERESTED: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Interested' },
            NOT_INTERESTED: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Not Interested' },
            MEETING_REQUEST: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Meeting Request' },
            OOO: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Out of Office' },
            UNSUBSCRIBE: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Unsubscribe' },
            QUESTION: { color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', label: 'Question' }
        };
        return badges[classification] || { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: classification };
    };

    return (
        <div className="h-[calc(100vh-5rem)] flex overflow-hidden rounded-xl border border-slate-700/50 bg-[#0f172a]">

            {/* Left Panel - Conversation List */}
            <div className="w-80 border-r border-slate-700/50 flex flex-col bg-[#111827]">
                {/* Header with Actions */}
                <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
                    <button className="flex items-center space-x-2 px-3 py-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
                        <Plus size={16} />
                        <span className="text-sm font-medium">New</span>
                    </button>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:bg-slate-800'}`}
                        >
                            <Filter size={16} />
                        </button>
                        <button
                            onClick={fetchLeads}
                            className="p-2 text-slate-500 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>

                {/* Filter Tabs */}
                {showFilters && (
                    <div className="px-3 py-2 border-b border-slate-700/50 flex space-x-1">
                        {[
                            { id: 'all', label: 'All', icon: <MessageSquare size={14} /> },
                            { id: 'unread', label: 'Unread', icon: <AlertCircle size={14} /> },
                            { id: 'starred', label: 'Starred', icon: <Star size={14} /> }
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
                                    ${filter === f.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-800'
                                    }`}
                            >
                                {f.icon}
                                <span>{f.label}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Search */}
                <div className="p-3 border-b border-slate-700/50">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, phone, email..."
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-800/50 border border-slate-700 rounded-full text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Conversation Count */}
                <div className="px-4 py-2 border-b border-slate-700/50 text-xs text-slate-500">
                    {filteredLeads.length} conversation{filteredLeads.length !== 1 ? 's' : ''}
                    {searchQuery && ` matching "${searchQuery}"`}
                </div>

                {/* Conversation List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredLeads.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">
                            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
                            {searchQuery ? 'No contacts found' : 'No conversations yet'}
                        </div>
                    ) : (
                        filteredLeads.map(lead => (
                            <div
                                key={lead.id}
                                onClick={() => setActiveLead(lead)}
                                className={`relative flex items-start px-4 py-3 cursor-pointer border-b border-slate-700/30 transition-all
                                    ${activeLead?.id === lead.id
                                        ? 'bg-blue-600/10 border-l-4 border-l-blue-500'
                                        : 'hover:bg-slate-800/50 border-l-4 border-l-transparent'
                                    }`}
                            >
                                {/* Star Button */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStar(lead.id); }}
                                    className={`absolute top-3 right-3 p-1 rounded transition-colors
                                        ${starredLeads.has(lead.id) ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                    <Star size={14} fill={starredLeads.has(lead.id) ? 'currentColor' : 'none'} />
                                </button>

                                {/* Avatar */}
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 mr-3 text-sm font-semibold
                                    ${lead.status === 'MANUAL_INTERVENTION'
                                        ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
                                        : 'bg-gradient-to-br from-slate-600 to-slate-700 text-slate-300'
                                    }`}
                                >
                                    {lead.name ? lead.name.charAt(0).toUpperCase() : <User size={18} />}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0 pr-6">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className={`font-medium text-sm truncate ${lead.status === 'MANUAL_INTERVENTION' ? 'text-white' : 'text-slate-200'
                                            }`}>
                                            {lead.name || 'Unknown'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate mb-1">
                                        {lead.phone}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-[10px] text-slate-600">
                                            {formatTime(lead.last_contacted_at || lead.created_at)}
                                        </span>
                                        {lead.status === 'MANUAL_INTERVENTION' && (
                                            <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded">
                                                <AlertCircle size={10} />
                                                <span>Needs Reply</span>
                                            </span>
                                        )}
                                        {lead.product_interest && (
                                            <span className="px-1.5 py-0.5 bg-slate-700/50 text-slate-500 text-[10px] rounded truncate max-w-[80px]">
                                                {lead.product_interest}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Center Panel - Message View */}
            <div className="flex-1 flex flex-col bg-[#0c1222]">
                {activeLead ? (
                    <>
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-slate-700/50 flex items-center justify-between bg-[#111827]">
                            <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold
                                    ${activeLead.status === 'MANUAL_INTERVENTION'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
                                    }`}
                                >
                                    {activeLead.name ? activeLead.name.charAt(0).toUpperCase() : <User size={18} />}
                                </div>
                                <div>
                                    <div className="flex items-center space-x-2">
                                        <h3 className="font-semibold text-white">{activeLead.name || 'Unknown'}</h3>
                                        {classification && (
                                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getClassificationBadge(classification.classification).color}`}>
                                                {getClassificationBadge(classification.classification).label}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500">{activeLead.phone} • {activeLead.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={handleCall}
                                    className="p-2.5 hover:bg-green-500/10 text-green-400 rounded-full transition-colors"
                                    title="Call"
                                >
                                    <Phone size={18} />
                                </button>
                                <button
                                    onClick={handleClassifyLast}
                                    disabled={classifying}
                                    className="p-2.5 hover:bg-purple-500/10 text-purple-400 rounded-full transition-colors"
                                    title="Classify Last Reply"
                                >
                                    {classifying ? <RefreshCw size={18} className="animate-spin" /> : <Tag size={18} />}
                                </button>
                                <button
                                    onClick={() => setShowContactPanel(!showContactPanel)}
                                    className={`p-2.5 rounded-full transition-colors ${showContactPanel ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-800'
                                        }`}
                                    title="Contact Info"
                                >
                                    <Info size={18} />
                                </button>
                                <button className="p-2.5 hover:bg-slate-800 text-slate-400 rounded-full transition-colors">
                                    <MoreVertical size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Empty State Greeting */}
                        {messages.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 text-white text-3xl font-bold">
                                    {activeLead.name ? activeLead.name.charAt(0).toUpperCase() : '?'}
                                </div>
                                <h2 className="text-2xl font-semibold text-white mb-2">
                                    Hi {activeLead.name ? activeLead.name.split(' ')[0] : 'there'}!
                                </h2>
                                <p className="text-slate-500 text-sm mb-6">You're all caught up</p>
                                <button
                                    onClick={() => document.querySelector('input[placeholder*="Type"]')?.focus()}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                                >
                                    Start Conversation
                                </button>
                            </div>
                        )}

                        {/* Messages */}
                        {messages.length > 0 && (
                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {messages.map((msg, idx) => {
                                    const isOutbound = msg.direction === 'OUTBOUND';
                                    const showDate = idx === 0 ||
                                        format(new Date(messages[idx - 1].created_at), 'MMM d') !== format(new Date(msg.created_at), 'MMM d');

                                    return (
                                        <React.Fragment key={msg.id}>
                                            {showDate && (
                                                <div className="flex items-center justify-center my-4">
                                                    <span className="px-3 py-1 bg-slate-800 text-slate-500 text-xs rounded-full">
                                                        {format(new Date(msg.created_at), 'EEEE, MMMM d')}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[75%] ${isOutbound ? 'order-2' : 'order-1'}`}>
                                                    {/* Message Type Badge */}
                                                    <div className={`flex items-center space-x-1 mb-1 text-[10px] text-slate-500 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                                        {getMessageIcon(msg.type)}
                                                        <span>{msg.type}</span>
                                                    </div>

                                                    {/* Message Bubble */}
                                                    <div className={`rounded-2xl px-4 py-3 ${isOutbound
                                                        ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md'
                                                        : 'bg-slate-700 text-slate-100 rounded-bl-md'
                                                        }`}>
                                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                                    </div>

                                                    {/* Time & Status */}
                                                    <div className={`flex items-center space-x-1 mt-1 text-[10px] ${isOutbound ? 'justify-end text-blue-300' : 'text-slate-500'}`}>
                                                        <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                                                        {isOutbound && <CheckCheck size={12} />}
                                                        {msg.classification && (
                                                            <span className={`ml-2 px-1.5 py-0.5 rounded ${getClassificationBadge(msg.classification).color}`}>
                                                                {msg.classification}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                                {isTyping && (
                                    <div className="flex justify-end">
                                        <div className="bg-slate-700 rounded-2xl px-4 py-3 text-slate-400 text-sm">
                                            <span className="flex space-x-1">
                                                <span className="animate-bounce">.</span>
                                                <span className="animate-bounce delay-100">.</span>
                                                <span className="animate-bounce delay-200">.</span>
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}

                        {/* Input */}
                        <form onSubmit={handleSend} className="p-4 border-t border-slate-700/50 bg-[#111827]">
                            <div className="flex items-end space-x-2">
                                <div className="flex-1 relative">
                                    <textarea
                                        ref={messageInputRef}
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend(e);
                                            }
                                        }}
                                        placeholder="Type a message... (Shift+Enter for new line)"
                                        rows={1}
                                        className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                                        style={{ minHeight: '48px', maxHeight: '120px' }}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerateAI}
                                    disabled={isTyping}
                                    className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 text-white rounded-full transition-all shadow-lg shadow-purple-500/25"
                                    title="Generate with AI"
                                >
                                    <Sparkles size={18} />
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-colors"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                            <MessageSquare size={40} className="opacity-30" />
                        </div>
                        <p className="text-xl font-medium text-white mb-2">Select a conversation</p>
                        <p className="text-sm">Choose from your contacts on the left</p>
                    </div>
                )}
            </div>

            {/* Right Panel - Contact Details */}
            {activeLead && showContactPanel && (
                <div className="w-80 border-l border-slate-700/50 bg-[#111827] flex flex-col">
                    {/* Contact Header */}
                    <div className="p-6 border-b border-slate-700/50 text-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold shadow-lg shadow-blue-500/25">
                            {activeLead.name ? activeLead.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <h3 className="text-lg font-semibold text-white">{activeLead.name || 'Unknown'}</h3>
                        <p className="text-sm text-slate-500 mt-1">{activeLead.company || 'No company'}</p>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center justify-center space-x-2 mt-4">
                            <button
                                onClick={handleCall}
                                className="p-3 bg-green-600 hover:bg-green-500 text-white rounded-full transition-colors"
                                title="Call"
                            >
                                <Phone size={18} />
                            </button>
                            <button
                                onClick={handleEmail}
                                className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors"
                                title="Email"
                            >
                                <Mail size={18} />
                            </button>
                            <button
                                onClick={handleLinkedIn}
                                className={`p-3 rounded-full transition-colors ${activeLead.linkedin_url ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                                title="LinkedIn"
                            >
                                <Linkedin size={18} />
                            </button>
                            <button
                                onClick={() => toggleStar(activeLead.id)}
                                className={`p-3 rounded-full transition-colors ${starredLeads.has(activeLead.id)
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    }`}
                                title="Star"
                            >
                                <Star size={18} fill={starredLeads.has(activeLead.id) ? 'currentColor' : 'none'} />
                            </button>
                        </div>
                    </div>

                    {/* Contact Details */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Contact Info</h4>

                        {activeLead.phone && (
                            <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
                                <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
                                    <Phone size={16} className="text-green-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-500">Phone</p>
                                    <p className="text-sm text-white truncate">{activeLead.phone}</p>
                                </div>
                            </div>
                        )}

                        {activeLead.email && (
                            <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer">
                                <div className="w-9 h-9 rounded-full bg-purple-500/10 flex items-center justify-center">
                                    <Mail size={16} className="text-purple-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-slate-500">Email</p>
                                    <p className="text-sm text-white truncate">{activeLead.email}</p>
                                </div>
                            </div>
                        )}

                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 mt-6">Details</h4>

                        <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl">
                            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <TrendingUp size={16} className="text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Status</p>
                                <p className={`text-sm font-medium ${activeLead.status === 'MANUAL_INTERVENTION' ? 'text-red-400' :
                                    activeLead.status === 'ACTIVE' ? 'text-green-400' :
                                        activeLead.status === 'COMPLETED' ? 'text-blue-400' : 'text-slate-300'
                                    }`}>
                                    {activeLead.status?.replace(/_/g, ' ')}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl">
                            <div className="w-9 h-9 rounded-full bg-cyan-500/10 flex items-center justify-center">
                                <Hash size={16} className="text-cyan-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Sequence Step</p>
                                <p className="text-sm text-white">Step {activeLead.step || 0}</p>
                            </div>
                        </div>

                        {activeLead.product_interest && (
                            <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl">
                                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                                    <Sparkles size={16} className="text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Interest</p>
                                    <p className="text-sm text-white">{activeLead.product_interest}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl">
                            <div className="w-9 h-9 rounded-full bg-slate-500/10 flex items-center justify-center">
                                <Calendar size={16} className="text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Last Contact</p>
                                <p className="text-sm text-white">
                                    {activeLead.last_contacted_at
                                        ? formatDistanceToNow(new Date(activeLead.last_contacted_at), { addSuffix: true })
                                        : 'Never'
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl">
                            <div className="w-9 h-9 rounded-full bg-slate-500/10 flex items-center justify-center">
                                <Clock size={16} className="text-slate-400" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500">Added</p>
                                <p className="text-sm text-white">
                                    {activeLead.created_at
                                        ? format(new Date(activeLead.created_at), 'MMM d, yyyy')
                                        : 'Unknown'
                                    }
                                </p>
                            </div>
                        </div>

                        {activeLead.source && (
                            <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-xl">
                                <div className="w-9 h-9 rounded-full bg-slate-500/10 flex items-center justify-center">
                                    <Eye size={16} className="text-slate-400" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500">Source</p>
                                    <p className="text-sm text-white">{activeLead.source}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
