import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
    Search, Plus, Building, Building2, Users, Globe, MapPin, Phone, Mail,
    Edit2, Trash2, ChevronRight, X, Check, RefreshCw, ArrowUpDown,
    MessageSquare, Briefcase, ExternalLink, Linkedin, SlidersHorizontal,
    UserPlus, MoreHorizontal, Filter, Eye, Download, TrendingUp, Target,
    Clock, DollarSign, Send, Activity, Star, StarOff, ChevronDown,
    LayoutGrid, List, PieChart, Calendar, Zap, AlertCircle
} from 'lucide-react';

export default function Companies() {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyLeads, setCompanyLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('lead_count');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
    const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [editingLead, setEditingLead] = useState(null);
    const [activeTab, setActiveTab] = useState('leads'); // 'leads', 'activity', 'deals'
    const [companyActivity, setCompanyActivity] = useState([]);
    const [filterIndustry, setFilterIndustry] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const emptyCompany = {
        name: '', domain: '', industry: '', company_size: '', website: '',
        street_address: '', city: '', state: '', zip_code: '', country: '', phone: '', notes: ''
    };

    const emptyLead = {
        name: '', first_name: '', last_name: '', email: '', phone: '',
        job_title: '', department: '', linkedin_url: ''
    };

    const [newCompany, setNewCompany] = useState({ ...emptyCompany });
    const [newLead, setNewLead] = useState({ ...emptyLead });

    // Stats
    const [stats, setStats] = useState({
        totalCompanies: 0,
        totalLeads: 0,
        activeCompanies: 0,
        avgLeadsPerCompany: 0
    });

    useEffect(() => {
        fetchCompanies();
    }, [sortBy, sortOrder]);

    useEffect(() => {
        if (companies.length > 0) {
            const totalLeads = companies.reduce((sum, c) => sum + (c.lead_count || 0), 0);
            const activeCompanies = companies.filter(c => c.lead_count > 0).length;
            setStats({
                totalCompanies: companies.length,
                totalLeads,
                activeCompanies,
                avgLeadsPerCompany: activeCompanies > 0 ? (totalLeads / activeCompanies).toFixed(1) : 0
            });
        }
    }, [companies]);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/companies?sort=${sortBy}&order=${sortOrder}`);
            setCompanies(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchCompanyLeads = async (companyId) => {
        setLoadingLeads(true);
        try {
            const res = await axios.get(`/api/companies/${companyId}/leads`);
            setCompanyLeads(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingLeads(false);
        }
    };

    const fetchCompanyActivity = async (companyId) => {
        try {
            // Aggregate activity from all leads
            const leads = companyLeads.length > 0 ? companyLeads :
                (await axios.get(`/api/companies/${companyId}/leads`)).data;

            let allActivity = [];
            for (const lead of leads.slice(0, 5)) { // Limit to first 5 leads for performance
                try {
                    const res = await axios.get(`/api/contacts/${lead.id}/activity`);
                    allActivity = [...allActivity, ...res.data.map(a => ({ ...a, leadName: lead.name }))];
                } catch (e) { }
            }

            // Sort by date
            allActivity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setCompanyActivity(allActivity.slice(0, 20)); // Latest 20
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectCompany = async (company) => {
        setSelectedCompany(company);
        setActiveTab('leads');
        await fetchCompanyLeads(company.id);
    };

    const handleSaveCompany = async () => {
        try {
            if (editingCompany) {
                await axios.put(`/api/companies/${editingCompany.id}`, newCompany);
            } else {
                await axios.post('/api/companies', newCompany);
            }
            setShowAddCompanyModal(false);
            setEditingCompany(null);
            setNewCompany({ ...emptyCompany });
            fetchCompanies();
            if (selectedCompany && editingCompany?.id === selectedCompany.id) {
                const res = await axios.get(`/api/companies/${selectedCompany.id}`);
                setSelectedCompany(res.data);
            }
        } catch (err) {
            alert('Failed to save company: ' + err.message);
        }
    };

    const handleDeleteCompany = async (id) => {
        if (!confirm('Delete this company? Leads will be unlinked but not deleted.')) return;
        try {
            await axios.delete(`/api/companies/${id}`);
            if (selectedCompany?.id === id) {
                setSelectedCompany(null);
                setCompanyLeads([]);
            }
            fetchCompanies();
        } catch (err) {
            alert('Failed to delete company');
        }
    };

    const handleSaveLead = async () => {
        try {
            const fullName = `${newLead.first_name} ${newLead.last_name}`.trim() || newLead.name;
            const payload = { ...newLead, name: fullName };

            if (editingLead) {
                await axios.put(`/api/contacts/${editingLead.id}`, payload);
            } else {
                await axios.post(`/api/companies/${selectedCompany.id}/leads`, payload);
            }
            setShowAddLeadModal(false);
            setEditingLead(null);
            setNewLead({ ...emptyLead });
            fetchCompanyLeads(selectedCompany.id);
            fetchCompanies();
        } catch (err) {
            alert('Failed to save lead: ' + err.message);
        }
    };

    const handleDeleteLead = async (id) => {
        if (!confirm('Delete this lead?')) return;
        try {
            await axios.delete(`/api/leads/${id}`);
            fetchCompanyLeads(selectedCompany.id);
            fetchCompanies();
        } catch (err) {
            alert('Failed to delete lead');
        }
    };

    const openEditCompany = (company) => {
        setNewCompany({
            name: company.name || '',
            domain: company.domain || '',
            industry: company.industry || '',
            company_size: company.company_size || '',
            website: company.website || '',
            street_address: company.street_address || '',
            city: company.city || '',
            state: company.state || '',
            zip_code: company.zip_code || '',
            country: company.country || '',
            phone: company.phone || '',
            notes: company.notes || ''
        });
        setEditingCompany(company);
        setShowAddCompanyModal(true);
    };

    const openEditLead = (lead) => {
        setNewLead({
            name: lead.name || '',
            first_name: lead.first_name || lead.name?.split(' ')[0] || '',
            last_name: lead.last_name || lead.name?.split(' ').slice(1).join(' ') || '',
            email: lead.email || '',
            phone: lead.phone || '',
            job_title: lead.job_title || '',
            department: lead.department || '',
            linkedin_url: lead.linkedin_url || ''
        });
        setEditingLead(lead);
        setShowAddLeadModal(true);
    };

    const handleExportCompanies = () => {
        const headers = ['Name', 'Domain', 'Industry', 'Size', 'Lead Count', 'City', 'State'];
        const rows = filteredCompanies.map(c => [
            c.name, c.domain, c.industry || '', c.company_size || '', c.lead_count, c.city || '', c.state || ''
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'companies_export.csv';
        a.click();
    };

    // Get unique industries for filter
    const industries = [...new Set(companies.map(c => c.industry).filter(Boolean))];

    // Filter companies
    const filteredCompanies = companies.filter(c => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            if (!c.name?.toLowerCase().includes(term) &&
                !c.domain?.toLowerCase().includes(term) &&
                !c.industry?.toLowerCase().includes(term)) return false;
        }
        if (filterIndustry && c.industry !== filterIndustry) return false;
        return true;
    });

    const getStatusBadge = (status) => {
        const styles = {
            'NEW': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            'ACTIVE': 'bg-green-500/20 text-green-400 border-green-500/30',
            'MANUAL_TASK_DUE': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            'COMPLETED': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
            'OPTED_OUT': 'bg-red-500/20 text-red-400 border-red-500/30'
        };
        return styles[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    };

    const getCompanyGradient = (name) => {
        const gradients = [
            'from-blue-500 to-cyan-500',
            'from-purple-500 to-pink-500',
            'from-green-500 to-emerald-500',
            'from-orange-500 to-red-500',
            'from-indigo-500 to-purple-500',
            'from-teal-500 to-green-500'
        ];
        const index = (name?.charCodeAt(0) || 0) % gradients.length;
        return gradients[index];
    };

    return (
        <div className="h-[calc(100vh-120px)]">
            {/* Header with Stats */}
            <div className="mb-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Building2 className="text-blue-400" size={28} />
                            Companies
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Manage your accounts and contacts by company hierarchy</p>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={handleExportCompanies}
                            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm border border-slate-700"
                        >
                            <Download size={14} />
                            <span>Export</span>
                        </button>
                        <button
                            onClick={() => { setNewCompany({ ...emptyCompany }); setEditingCompany(null); setShowAddCompanyModal(true); }}
                            className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
                        >
                            <Plus size={16} />
                            <span>Add Company</span>
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <StatCard icon={Building} label="Total Companies" value={stats.totalCompanies} color="blue" />
                    <StatCard icon={Users} label="Total Contacts" value={stats.totalLeads} color="green" />
                    <StatCard icon={Activity} label="Active Accounts" value={stats.activeCompanies} color="purple" />
                    <StatCard icon={Target} label="Avg Leads/Company" value={stats.avgLeadsPerCompany} color="amber" />
                </div>
            </div>

            {/* Main Split Panel */}
            <div className="flex gap-4 h-[calc(100%-180px)]">
                {/* Left Panel - Companies List */}
                <div className="w-[380px] bg-[#1e293b] rounded-xl border border-slate-700/50 flex flex-col overflow-hidden">
                    {/* Search & Filters */}
                    <div className="p-3 border-b border-slate-700/50 space-y-2">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search companies..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-300"
                                >
                                    <option value="lead_count">Lead Count</option>
                                    <option value="name">Name</option>
                                    <option value="created_at">Created</option>
                                    <option value="last_activity">Activity</option>
                                </select>
                                <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
                                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded">
                                    <ArrowUpDown size={12} />
                                </button>
                                <button onClick={() => setShowFilters(!showFilters)}
                                    className={`p-1.5 rounded border ${showFilters ? 'text-blue-400 bg-blue-600/20 border-blue-500/30' : 'text-slate-400 hover:text-white bg-slate-800 border-slate-700'}`}>
                                    <Filter size={12} />
                                </button>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded ${viewMode === 'list' ? 'text-blue-400 bg-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
                                    <List size={14} />
                                </button>
                                <button onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded ${viewMode === 'grid' ? 'text-blue-400 bg-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
                                    <LayoutGrid size={14} />
                                </button>
                                <button onClick={fetchCompanies} className="p-1.5 text-slate-400 hover:text-white">
                                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                                </button>
                            </div>
                        </div>

                        {/* Filter Panel */}
                        {showFilters && (
                            <div className="pt-2 border-t border-slate-700/50">
                                <label className="text-[10px] text-slate-500 uppercase tracking-wide">Industry</label>
                                <select
                                    value={filterIndustry}
                                    onChange={(e) => setFilterIndustry(e.target.value)}
                                    className="w-full mt-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-300"
                                >
                                    <option value="">All Industries</option>
                                    {industries.map(ind => (
                                        <option key={ind} value={ind}>{ind}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Companies List */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">
                                <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                                Loading companies...
                            </div>
                        ) : filteredCompanies.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">
                                <Building size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="font-medium">No companies found</p>
                                <p className="text-xs mt-1">Import contacts or add a company</p>
                            </div>
                        ) : viewMode === 'list' ? (
                            filteredCompanies.map(company => (
                                <CompanyListItem
                                    key={company.id}
                                    company={company}
                                    isSelected={selectedCompany?.id === company.id}
                                    onClick={() => handleSelectCompany(company)}
                                    getGradient={getCompanyGradient}
                                />
                            ))
                        ) : (
                            <div className="p-3 grid grid-cols-2 gap-2">
                                {filteredCompanies.map(company => (
                                    <CompanyGridCard
                                        key={company.id}
                                        company={company}
                                        isSelected={selectedCompany?.id === company.id}
                                        onClick={() => handleSelectCompany(company)}
                                        getGradient={getCompanyGradient}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* List Footer */}
                    <div className="p-3 border-t border-slate-700/50 bg-slate-800/50">
                        <p className="text-xs text-slate-500 text-center">
                            Showing {filteredCompanies.length} of {companies.length} companies
                        </p>
                    </div>
                </div>

                {/* Right Panel - Company Detail + Leads */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    {selectedCompany ? (
                        <>
                            {/* Company Header Card */}
                            <div className="bg-gradient-to-r from-slate-800 to-[#1e293b] rounded-xl border border-slate-700/50 p-5">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${getCompanyGradient(selectedCompany.name)} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                                            {selectedCompany.name?.charAt(0)?.toUpperCase() || '?'}
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">{selectedCompany.name}</h2>
                                            <p className="text-slate-400 text-sm flex items-center gap-1">
                                                <Globe size={12} />
                                                {selectedCompany.domain || 'No domain'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {selectedCompany.industry && (
                                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30">
                                                        {selectedCompany.industry}
                                                    </span>
                                                )}
                                                {selectedCompany.company_size && (
                                                    <span className="px-2 py-0.5 bg-slate-700 text-slate-400 text-xs rounded">
                                                        {selectedCompany.company_size} employees
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {selectedCompany.website && (
                                            <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer"
                                                className="p-2 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg" title="Visit Website">
                                                <ExternalLink size={16} />
                                            </a>
                                        )}
                                        <button onClick={() => openEditCompany(selectedCompany)} className="p-2 hover:bg-slate-700 text-blue-400 rounded-lg" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDeleteCompany(selectedCompany.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg" title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Quick Stats Row */}
                                <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-700/50">
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-blue-400">{selectedCompany.lead_count || 0}</p>
                                        <p className="text-[10px] text-slate-500 uppercase">Contacts</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-green-400">
                                            {companyLeads.filter(l => l.status === 'ACTIVE').length}
                                        </p>
                                        <p className="text-[10px] text-slate-500 uppercase">Active</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-amber-400">
                                            {companyLeads.reduce((sum, l) => sum + (l.message_count || 0), 0)}
                                        </p>
                                        <p className="text-[10px] text-slate-500 uppercase">Messages</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-2xl font-bold text-purple-400">
                                            {companyLeads.filter(l => l.status === 'COMPLETED').length}
                                        </p>
                                        <p className="text-[10px] text-slate-500 uppercase">Converted</p>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-700/50 text-sm">
                                    {selectedCompany.phone && (
                                        <a href={`tel:${selectedCompany.phone}`} className="flex items-center gap-1.5 text-slate-400 hover:text-white">
                                            <Phone size={14} /> {selectedCompany.phone}
                                        </a>
                                    )}
                                    {(selectedCompany.city || selectedCompany.state) && (
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <MapPin size={14} /> {[selectedCompany.city, selectedCompany.state].filter(Boolean).join(', ')}
                                        </div>
                                    )}
                                    {selectedCompany.last_activity && (
                                        <div className="flex items-center gap-1.5 text-slate-500">
                                            <Clock size={14} /> Last activity: {formatDistanceToNow(new Date(selectedCompany.last_activity), { addSuffix: true })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="flex items-center space-x-1 bg-slate-800/50 rounded-lg p-1">
                                <TabButton active={activeTab === 'leads'} onClick={() => setActiveTab('leads')} icon={Users} label="Contacts" count={companyLeads.length} />
                                <TabButton active={activeTab === 'activity'} onClick={() => { setActiveTab('activity'); fetchCompanyActivity(selectedCompany.id); }} icon={Activity} label="Activity" />
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 bg-[#1e293b] rounded-xl border border-slate-700/50 flex flex-col overflow-hidden">
                                {activeTab === 'leads' && (
                                    <>
                                        <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-white">Contacts</h3>
                                                <p className="text-xs text-slate-500">{companyLeads.length} people at {selectedCompany.name}</p>
                                            </div>
                                            <button
                                                onClick={() => { setNewLead({ ...emptyLead }); setEditingLead(null); setShowAddLeadModal(true); }}
                                                className="flex items-center space-x-1 px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white rounded-lg text-sm shadow-lg shadow-green-500/20"
                                            >
                                                <UserPlus size={14} />
                                                <span>Add Contact</span>
                                            </button>
                                        </div>

                                        <div className="flex-1 overflow-y-auto">
                                            {loadingLeads ? (
                                                <div className="p-8 text-center text-slate-500">
                                                    <RefreshCw className="animate-spin mx-auto" size={20} />
                                                </div>
                                            ) : companyLeads.length === 0 ? (
                                                <div className="p-8 text-center text-slate-500">
                                                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                                                    <p className="font-medium">No contacts yet</p>
                                                    <p className="text-xs mt-1">Add your first contact to this company</p>
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-slate-700/50">
                                                    {companyLeads.map(lead => (
                                                        <LeadRow
                                                            key={lead.id}
                                                            lead={lead}
                                                            onEdit={() => openEditLead(lead)}
                                                            onDelete={() => handleDeleteLead(lead.id)}
                                                            onMessage={() => navigate('/inbox', { state: { leadId: lead.id } })}
                                                            getStatusBadge={getStatusBadge}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {activeTab === 'activity' && (
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {companyActivity.length === 0 ? (
                                            <div className="p-8 text-center text-slate-500">
                                                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                                                <p className="font-medium">No activity yet</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {companyActivity.map((item, idx) => (
                                                    <ActivityItem key={idx} item={item} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 bg-gradient-to-br from-slate-800/50 to-[#1e293b] rounded-xl border border-slate-700/50 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                                    <Building2 size={40} className="text-blue-400/50" />
                                </div>
                                <p className="text-lg font-medium text-slate-400">Select a Company</p>
                                <p className="text-sm text-slate-600 mt-1">Click on a company to view its contacts and details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Company Modal */}
            {showAddCompanyModal && (
                <Modal
                    title={editingCompany ? 'Edit Company' : 'Add New Company'}
                    onClose={() => { setShowAddCompanyModal(false); setEditingCompany(null); }}
                    onSave={handleSaveCompany}
                    saveLabel={editingCompany ? 'Save Changes' : 'Add Company'}
                >
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Company Name *" value={newCompany.name} onChange={v => setNewCompany({ ...newCompany, name: v })} />
                        <InputField label="Domain" value={newCompany.domain} onChange={v => setNewCompany({ ...newCompany, domain: v })} placeholder="acme.com" />
                        <InputField label="Industry" value={newCompany.industry} onChange={v => setNewCompany({ ...newCompany, industry: v })} />
                        <InputField label="Company Size" value={newCompany.company_size} onChange={v => setNewCompany({ ...newCompany, company_size: v })} placeholder="1-10, 11-50, 51-200..." />
                        <InputField label="Website" value={newCompany.website} onChange={v => setNewCompany({ ...newCompany, website: v })} placeholder="https://..." />
                        <InputField label="Phone" value={newCompany.phone} onChange={v => setNewCompany({ ...newCompany, phone: v })} />
                        <InputField label="City" value={newCompany.city} onChange={v => setNewCompany({ ...newCompany, city: v })} />
                        <InputField label="State" value={newCompany.state} onChange={v => setNewCompany({ ...newCompany, state: v })} />
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm text-slate-400 mb-1">Notes</label>
                        <textarea
                            value={newCompany.notes}
                            onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Additional notes about this company..."
                        />
                    </div>
                </Modal>
            )}

            {/* Add/Edit Lead Modal */}
            {showAddLeadModal && (
                <Modal
                    title={editingLead ? 'Edit Contact' : 'Add Contact'}
                    onClose={() => { setShowAddLeadModal(false); setEditingLead(null); }}
                    onSave={handleSaveLead}
                    saveLabel={editingLead ? 'Save Changes' : 'Add Contact'}
                    saveColor="green"
                >
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="First Name *" value={newLead.first_name} onChange={v => setNewLead({ ...newLead, first_name: v })} />
                        <InputField label="Last Name" value={newLead.last_name} onChange={v => setNewLead({ ...newLead, last_name: v })} />
                        <InputField label="Email" type="email" value={newLead.email} onChange={v => setNewLead({ ...newLead, email: v })} />
                        <InputField label="Phone" value={newLead.phone} onChange={v => setNewLead({ ...newLead, phone: v })} />
                        <InputField label="Job Title" value={newLead.job_title} onChange={v => setNewLead({ ...newLead, job_title: v })} />
                        <InputField label="Department" value={newLead.department} onChange={v => setNewLead({ ...newLead, department: v })} />
                    </div>
                    <div className="mt-4">
                        <InputField label="LinkedIn URL" value={newLead.linkedin_url} onChange={v => setNewLead({ ...newLead, linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ========== COMPONENTS ==========

function StatCard({ icon: Icon, label, value, color }) {
    const colors = {
        blue: 'from-blue-500 to-cyan-500 shadow-blue-500/20',
        green: 'from-green-500 to-emerald-500 shadow-green-500/20',
        purple: 'from-purple-500 to-pink-500 shadow-purple-500/20',
        amber: 'from-amber-500 to-orange-500 shadow-amber-500/20'
    };

    return (
        <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 p-4 hover:border-slate-600 transition-all">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-slate-500 text-xs uppercase tracking-wide">{label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} shadow-lg flex items-center justify-center`}>
                    <Icon size={18} className="text-white" />
                </div>
            </div>
        </div>
    );
}

function CompanyListItem({ company, isSelected, onClick, getGradient }) {
    return (
        <div
            onClick={onClick}
            className={`p-3 border-b border-slate-700/50 cursor-pointer transition-all
                ${isSelected
                    ? 'bg-blue-600/20 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-800/50 border-l-2 border-l-transparent'}`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getGradient(company.name)} flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                        {company.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium text-white truncate">{company.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500 truncate">{company.domain || 'No domain'}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <span className="flex items-center px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400">
                        <Users size={10} className="mr-1" />
                        {company.lead_count || 0}
                    </span>
                </div>
            </div>
            {company.industry && (
                <p className="text-[10px] text-slate-600 mt-1.5 truncate">{company.industry}</p>
            )}
        </div>
    );
}

function CompanyGridCard({ company, isSelected, onClick, getGradient }) {
    return (
        <div
            onClick={onClick}
            className={`p-3 rounded-lg cursor-pointer transition-all border
                ${isSelected
                    ? 'bg-blue-600/20 border-blue-500/50'
                    : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/50'}`}
        >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getGradient(company.name)} flex items-center justify-center text-white font-bold text-sm mb-2`}>
                {company.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <p className="font-medium text-white text-sm truncate">{company.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{company.domain}</p>
            <div className="flex items-center mt-2 text-xs text-slate-400">
                <Users size={10} className="mr-1" />
                {company.lead_count || 0} contacts
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                ${active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
        >
            <Icon size={14} />
            <span>{label}</span>
            {count !== undefined && <span className="ml-1 px-1.5 py-0.5 bg-slate-700 text-[10px] rounded">{count}</span>}
        </button>
    );
}

function LeadRow({ lead, onEdit, onDelete, onMessage, getStatusBadge }) {
    return (
        <div className="p-3 hover:bg-slate-800/30 transition-colors">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-medium text-sm">
                        {lead.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <p className="font-medium text-white">{lead.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">
                            {lead.job_title || 'No title'}
                            {lead.email && <span className="ml-1 text-slate-600">• {lead.email}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${getStatusBadge(lead.status)}`}>
                        {lead.status?.replace(/_/g, ' ') || 'NEW'}
                    </span>
                    {lead.message_count > 0 && (
                        <span className="text-xs text-slate-500 flex items-center">
                            <MessageSquare size={10} className="mr-1" />
                            {lead.message_count}
                        </span>
                    )}
                    <button onClick={onMessage} className="p-1.5 hover:bg-green-500/20 text-green-400 rounded" title="Message">
                        <Send size={14} />
                    </button>
                    {lead.linkedin_url && (
                        <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded" title="LinkedIn">
                            <Linkedin size={14} />
                        </a>
                    )}
                    <button onClick={onEdit} className="p-1.5 hover:bg-slate-700 text-slate-400 rounded" title="Edit">
                        <Edit2 size={14} />
                    </button>
                    <button onClick={onDelete} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded" title="Delete">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function ActivityItem({ item }) {
    const getIcon = () => {
        if (item.activity_type === 'message') {
            return item.direction === 'INBOUND' ? <Mail className="text-green-400" size={14} /> : <Send className="text-blue-400" size={14} />;
        }
        if (item.type === 'EMAIL_OPEN') return <Eye className="text-purple-400" size={14} />;
        if (item.type === 'LINK_CLICK') return <ExternalLink className="text-amber-400" size={14} />;
        return <Activity className="text-slate-400" size={14} />;
    };

    return (
        <div className="flex items-start space-x-3 p-2 rounded-lg hover:bg-slate-800/50">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                    <span className="text-slate-400">{item.leadName || 'Unknown'}</span>
                    {' '}{item.activity_type === 'message' ? (item.direction === 'INBOUND' ? 'replied' : 'was messaged') : item.type?.toLowerCase().replace(/_/g, ' ')}
                </p>
                {item.content && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">{item.content}</p>
                )}
                <p className="text-[10px] text-slate-600 mt-1">
                    {format(new Date(item.created_at), 'MMM d, yyyy h:mm a')}
                </p>
            </div>
        </div>
    );
}

function Modal({ title, onClose, onSave, saveLabel, saveColor = 'blue', children }) {
    const buttonColors = {
        blue: 'bg-blue-600 hover:bg-blue-500',
        green: 'bg-green-600 hover:bg-green-500'
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e293b] rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
                <div className="bg-slate-800/50 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white p-1 hover:bg-slate-700 rounded">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {children}
                </div>

                <div className="bg-slate-800/50 border-t border-slate-700 px-6 py-4 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={onSave} className={`px-6 py-2 ${buttonColors[saveColor]} text-white rounded-lg font-medium transition-colors shadow-lg`}>
                        {saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function InputField({ label, value, onChange, type = 'text', placeholder = '' }) {
    return (
        <div>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-600"
                placeholder={placeholder}
            />
        </div>
    );
}
