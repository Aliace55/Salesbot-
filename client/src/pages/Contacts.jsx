import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
    Search, Filter, Plus, Download, Upload, MoreHorizontal, Edit2, Trash2,
    Phone, Mail, Linkedin, Globe, MapPin, Building, User, Tag, Star,
    ChevronDown, X, Check, Eye, RefreshCw, SlidersHorizontal, ArrowUpDown,
    MessageSquare, Users, Briefcase, Hash, Calendar, ExternalLink, FileText,
    Clock, CheckCircle, XCircle, AlertCircle, Play, Pause, Send, Layout
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { CRMTable } from '../components/crm/CRMTable';
import { ActivityTimeline } from '../components/crm/ActivityTimeline';

// ========== CONFIGURATION ==========
const DEFAULT_COLUMNS = [
    { id: 'name', label: 'Name', width: '250px', render: (c) => <NameCell contact={c} /> },
    { id: 'email', label: 'Email', width: '200px' },
    { id: 'phone', label: 'Phone', width: '150px' },
    { id: 'job_title', label: 'Job Title', width: '180px' },
    { id: 'company', label: 'Company', width: '180px' },
    { id: 'status', label: 'Lead Status', width: '140px', render: (c) => <StatusBadge status={c.status} /> },
    { id: 'owner', label: 'Contact Owner', width: '150px' },
    { id: 'last_activity', label: 'Last Activity', width: '150px', render: (c) => <DateCell date={c.last_activity} /> },
    { id: 'created_at', label: 'Create Date', width: '150px', render: (c) => <DateCell date={c.created_at} /> },
];

export default function Contacts() {
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();

    // State
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [filters, setFilters] = useState({});

    // Detail View State
    const [selectedContact, setSelectedContact] = useState(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activity, setActivity] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [newContact, setNewContact] = useState({});

    useEffect(() => {
        fetchContacts();
    }, [sortBy, sortOrder]);

    // Handle opening contact from navigation state (e.g. from Dashboard)
    useEffect(() => {
        if (location.state?.leadId && contacts.length > 0) {
            const lead = contacts.find(c => c.id === location.state.leadId);
            if (lead) openContactDetail(lead);
        }
    }, [location.state, contacts]);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/leads`);
            setContacts(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load contacts");
        } finally {
            setLoading(false);
        }
    };

    const fetchActivity = async (contactId) => {
        setLoadingActivity(true);
        try {
            const res = await axios.get(`/api/contacts/${contactId}/activity`);
            setActivity(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingActivity(false);
        }
    };

    const openContactDetail = (contact) => {
        setSelectedContact(contact);
        setShowDetailPanel(true);
        fetchActivity(contact.id);
    };

    const closeDetailPanel = () => {
        setShowDetailPanel(false);
        setSelectedContact(null);
    };

    const handleSort = (colId) => {
        if (sortBy === colId) {
            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(colId);
            setSortOrder('desc'); // Default to desc for new sort
        }
    };

    const handleCreateNote = async (content) => {
        if (!selectedContact) return;
        try {
            await axios.post(`/api/contacts/${selectedContact.id}/notes`, { note: content });
            toast.success("Note added");
            fetchActivity(selectedContact.id);
        } catch (err) {
            toast.error("Failed to add note");
        }
    };

    // Filter Logic
    const filteredContacts = contacts.sort((a, b) => {
        const aVal = a[sortBy] || '';
        const bVal = b[sortBy] || '';
        if (sortBy.includes('date') || sortBy.includes('_at')) {
            return sortOrder === 'asc'
                ? new Date(aVal) - new Date(bVal)
                : new Date(bVal) - new Date(aVal);
        }
        return sortOrder === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
    });

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden">
            {/* Main Content Area (Table) - Hidden on mobile if detail is open */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${showDetailPanel ? 'mr-[450px]' : ''}`}>
                {/* Header Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#0f172a]">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users className="text-blue-400" />
                            Contacts
                        </h1>
                        <span className="text-slate-500 text-sm">
                            {filteredContacts.length} records
                        </span>
                        <div className="h-6 w-px bg-slate-700/50 mx-2" />
                        <button className="flex items-center space-x-1 text-slate-400 hover:text-white text-sm">
                            <Filter size={14} />
                            <span>Advanced Filters</span>
                        </button>
                    </div>

                    <div className="flex items-center space-x-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search contacts..."
                                className="pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white w-64 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-orange-500/20"
                            onClick={() => setShowAddModal(true)}
                        >
                            Create Contact
                        </button>
                    </div>
                </div>

                {/* Table Component */}
                <div className="flex-1 p-6 overflow-hidden">
                    <CRMTable
                        data={filteredContacts}
                        columns={DEFAULT_COLUMNS}
                        selectedIds={selectedIds}
                        onSelect={(id) => {
                            const newSet = new Set(selectedIds);
                            if (newSet.has(id)) newSet.delete(id);
                            else newSet.add(id);
                            setSelectedIds(newSet);
                        }}
                        onSelectAll={(ids) => setSelectedIds(new Set(ids))}
                        onSort={handleSort}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onRowClick={openContactDetail}
                        loading={loading}
                    />
                </div>
            </div>

            {/* Slide-over Detail Panel */}
            <div
                className={`fixed top-[64px] right-0 bottom-0 w-[600px] bg-[#0f172a] border-l border-slate-700 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col
                ${showDetailPanel ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {selectedContact && (
                    <>
                        {/* Detail Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg">
                                    {selectedContact.name?.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selectedContact.name}</h2>
                                    <h3 className="text-sm text-slate-400">{selectedContact.job_title} at {selectedContact.company}</h3>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                                    <MoreHorizontal size={20} />
                                </button>
                                <button onClick={closeDetailPanel} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Detail Body (Split) */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Sidebar (Properties) */}
                            <div className="w-1/3 border-r border-slate-700/50 overflow-y-auto p-4 bg-slate-900/50 text-sm">
                                <div className="space-y-6">
                                    <section>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">About this contact</h4>
                                        <div className="space-y-3">
                                            <Property label="Email" value={selectedContact.email} icon={Mail} isLink />
                                            <Property label="Phone" value={selectedContact.phone} icon={Phone} />
                                            <Property label="Lifecycle Stage" value={selectedContact.status} badge />
                                            <Property label="Owner" value={selectedContact.owner} />
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Professional Info</h4>
                                        <div className="space-y-3">
                                            <Property label="Job Title" value={selectedContact.job_title} />
                                            <Property label="Department" value={selectedContact.department} />
                                            <Property label="LinkedIn" value={selectedContact.linkedin_url} isLink external />
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Location</h4>
                                        <div className="space-y-3">
                                            <Property label="City" value={selectedContact.city} />
                                            <Property label="State" value={selectedContact.state} />
                                            <Property label="Country" value={selectedContact.country} />
                                        </div>
                                    </section>
                                </div>
                            </div>

                            {/* Center Content (Timeline) */}
                            <div className="flex-1 bg-slate-900">
                                <ActivityTimeline
                                    activities={activity}
                                    onCreateNote={handleCreateNote}
                                    entityType="contact"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ========== SUBCOMPONENTS ==========

function NameCell({ contact }) {
    return (
        <div className="flex items-center space-x-3 group">
            <span className="text-blue-400 font-medium group-hover:underline cursor-pointer">
                {contact.name || 'Unknown'}
            </span>
        </div>
    );
}

function StatusBadge({ status }) {
    const colors = {
        'NEW': 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        'ACTIVE': 'text-green-400 bg-green-400/10 border-green-400/20',
        'COMPLETED': 'text-slate-400 bg-slate-400/10 border-slate-400/20',
        'OPTED_OUT': 'text-red-400 bg-red-400/10 border-red-400/20',
    };
    const style = colors[status] || colors['NEW'];

    return (
        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${style}`}>
            {status?.replace(/_/g, ' ') || 'NEW'}
        </span>
    );
}

function DateCell({ date }) {
    if (!date) return <span className="text-slate-600">-</span>;
    return (
        <span className="text-slate-400 text-xs">
            {new Date(date).toLocaleDateString()}
        </span>
    );
}

function Property({ label, value, icon: Icon, isLink, external, badge }) {
    if (!value) return null;
    return (
        <div className="group">
            <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
            <div className="flex items-center text-slate-300">
                {Icon && <Icon size={12} className="mr-1.5 text-slate-500" />}
                {isLink ? (
                    <a
                        href={external ? value : `mailto:${value}`}
                        target={external ? "_blank" : undefined}
                        className="text-blue-400 hover:underline truncate"
                        rel="noreferrer wbr"
                    >
                        {value}
                        {external && <ExternalLink size={10} className="ml-1 inline" />}
                    </a>
                ) : badge ? (
                    <StatusBadge status={value} />
                ) : (
                    <span className="truncate block w-full">{value}</span>
                )}
            </div>
        </div>
    );
}
