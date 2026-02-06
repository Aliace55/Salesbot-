import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Search, Filter, Plus, Download, MoreHorizontal, Edit2, Trash2,
    Building2, Globe, MapPin, Phone, Users, ExternalLink, X
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { CRMTable } from '../components/crm/CRMTable';
import { ActivityTimeline } from '../components/crm/ActivityTimeline';
import { EditableProperty } from '../components/crm/EditableProperty';

// ========== CONFIGURATION ==========
const DEFAULT_COLUMNS = [
    { id: 'name', label: 'Company Name', width: '250px', render: (c) => <NameCell company={c} /> },
    { id: 'domain', label: 'Domain', width: '180px' },
    { id: 'phone', label: 'Phone', width: '150px' },
    { id: 'industry', label: 'Industry', width: '180px' },
    { id: 'lead_count', label: 'Contacts', width: '100px', render: (c) => <Badge count={c.lead_count} /> },
    { id: 'city', label: 'City', width: '150px' },
    { id: 'created_at', label: 'Create Date', width: '150px', render: (c) => <DateCell date={c.created_at} /> },
];

export default function Companies() {
    const navigate = useNavigate();
    const toast = useToast();

    // State
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Detail View State
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [companyActivity, setCompanyActivity] = useState([]);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, [sortBy, sortOrder]);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/companies?sort=${sortBy}&order=${sortOrder}`);
            setCompanies(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load companies");
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyActivity = async (companyId) => {
        // In a real app, this would fetch activity associated with the company
        // For now, we'll try to fetch leads and their activity or leave empty
        setCompanyActivity([]);
    };

    const openCompanyDetail = (company) => {
        setSelectedCompany(company);
        setShowDetailPanel(true);
        fetchCompanyActivity(company.id);
    };

    const closeDetailPanel = () => {
        setShowDetailPanel(false);
        setSelectedCompany(null);
    };

    const handleSort = (colId) => {
        if (sortBy === colId) {
            setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(colId);
            setSortOrder('desc');
        }
    };

    const handleCreateNote = async (content) => {
        // Placeholder for company note creation
        toast.success("Note added to company");
    };

    const handleUpdateCompany = async (key, value) => {
        if (!selectedCompany) return;
        try {
            const updates = { [key]: value };
            // Optimistic update
            const updatedCompany = { ...selectedCompany, ...updates };
            setSelectedCompany(updatedCompany);

            // Update in list
            setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? updatedCompany : c));

            // Assuming /api/companies/:id supports PUT
            await axios.put(`/api/companies/${selectedCompany.id}`, updates);
            toast.success("Company updated");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update company");
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] overflow-hidden">
            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${showDetailPanel ? 'mr-[450px]' : ''}`}>
                {/* Header Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-[#0f172a]">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-xl font-bold text-white flex items-center gap-2">
                            <Building2 className="text-blue-400" />
                            Companies
                        </h1>
                        <span className="text-slate-500 text-sm">
                            {companies.length} records
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
                                placeholder="Search companies..."
                                className="pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white w-64 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                            onClick={() => setShowAddModal(true)}
                        >
                            Create Company
                        </button>
                    </div>
                </div>

                {/* Table Component */}
                <div className="flex-1 p-6 overflow-hidden">
                    <CRMTable
                        data={companies}
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
                        onRowClick={openCompanyDetail}
                        loading={loading}
                    />
                </div>
            </div>

            {/* Slide-over Detail Panel */}
            <div
                className={`fixed top-[64px] right-0 bottom-0 w-[600px] bg-[#0f172a] border-l border-slate-700 shadow-2xl transform transition-transform duration-300 z-50 flex flex-col
                ${showDetailPanel ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {selectedCompany && (
                    <>
                        {/* Detail Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-800/30">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-white font-bold text-lg">
                                    {selectedCompany.name?.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selectedCompany.name}</h2>
                                    <div className="flex items-center space-x-2 text-sm text-slate-400">
                                        <Globe size={12} />
                                        <span>{selectedCompany.domain || 'No domain'}</span>
                                    </div>
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
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Company Details</h4>
                                        <div className="space-y-3">
                                            <EditableProperty label="Domain" value={selectedCompany.domain} name="domain" onSave={handleUpdateCompany} icon={Globe} isLink external />
                                            <EditableProperty label="Phone" value={selectedCompany.phone} name="phone" onSave={handleUpdateCompany} icon={Phone} />
                                            <EditableProperty label="Industry" value={selectedCompany.industry} name="industry" onSave={handleUpdateCompany} />
                                            <EditableProperty label="City" value={selectedCompany.city} name="city" onSave={handleUpdateCompany} icon={MapPin} />
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Metrics</h4>
                                        <div className="space-y-3">
                                            <EditableProperty label="Total Contacts" value={selectedCompany.lead_count} name="lead_count" onSave={() => { }} />
                                            {/* Note: lead_count is likely read-only from backend aggregation, so maybe keep onSave empty or handle gracefully */}
                                        </div>
                                    </section>
                                </div>
                            </div>

                            {/* Center Content (Timeline) */}
                            <div className="flex-1 bg-slate-900">
                                <ActivityTimeline
                                    activities={companyActivity}
                                    onCreateNote={handleCreateNote}
                                    entityType="company"
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

function NameCell({ company }) {
    return (
        <div className="flex items-center space-x-3 group">
            <span className="text-blue-400 font-medium group-hover:underline cursor-pointer">
                {company.name || 'Unknown'}
            </span>
        </div>
    );
}

function Badge({ count }) {
    return (
        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs">
            {count || 0}
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

function Property({ label, value, icon: Icon, isLink, external }) {
    if (!value) return null;
    return (
        <div className="group">
            <div className="text-[10px] text-slate-500 mb-0.5">{label}</div>
            <div className="flex items-center text-slate-300">
                {Icon && <Icon size={12} className="mr-1.5 text-slate-500" />}
                {isLink ? (
                    <a
                        href={external ? (value.startsWith('http') ? value : `https://${value}`) : `mailto:${value}`}
                        target={external ? "_blank" : undefined}
                        className="text-blue-400 hover:underline truncate"
                        rel="noreferrer wbr"
                    >
                        {value}
                        {external && <ExternalLink size={10} className="ml-1 inline" />}
                    </a>
                ) : (
                    <span className="truncate block w-full">{value}</span>
                )}
            </div>
        </div>
    );
}
