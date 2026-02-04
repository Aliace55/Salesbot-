import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import {
    Search, Filter, Plus, Download, Upload, MoreHorizontal, Edit2, Trash2,
    Phone, Mail, Linkedin, Globe, MapPin, Building, User, Tag, Star,
    ChevronDown, X, Check, Eye, RefreshCw, SlidersHorizontal, ArrowUpDown,
    MessageSquare, Users, Briefcase, Hash, Calendar, ExternalLink, FileText,
    Clock, CheckCircle, XCircle, AlertCircle, Play, Pause, Send
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { TableSkeleton } from '../components/LoadingSkeletons';

function InputField({ label, value, onChange, type = "text", placeholder }) {
    return (
        <div>
            <label className="block text-sm text-slate-400 mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                placeholder={placeholder}
            />
        </div>
    );
}

export default function Contacts() {
    const navigate = useNavigate();
    const toast = useToast();
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedContacts, setSelectedContacts] = useState(new Set());
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({ company: '', industry: '', status: 'all' });
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingContact, setEditingContact] = useState(null);
    const [activityTimeline, setActivityTimeline] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [importResults, setImportResults] = useState(null);
    const fileInputRef = useRef(null);
    const [columns, setColumns] = useState([
        'name', 'email', 'phone', 'company', 'job_title', 'status', 'last_activity'
    ]);
    const [showColumnPicker, setShowColumnPicker] = useState(false);

    const allColumns = [
        { id: 'name', label: 'Name' },
        { id: 'first_name', label: 'First Name' },
        { id: 'last_name', label: 'Last Name' },
        { id: 'email', label: 'Email' },
        { id: 'phone', label: 'Phone' },
        { id: 'company', label: 'Company' },
        { id: 'job_title', label: 'Job Title' },
        { id: 'department', label: 'Department' },
        { id: 'job_function', label: 'Job Function' },
        { id: 'website', label: 'Website' },
        { id: 'linkedin_url', label: 'LinkedIn' },
        { id: 'street_address', label: 'Street' },
        { id: 'city', label: 'City' },
        { id: 'state', label: 'State' },
        { id: 'zip_code', label: 'Zip' },
        { id: 'country', label: 'Country' },
        { id: 'industry', label: 'Industry' },
        { id: 'company_size', label: 'Company Size' },
        { id: 'status', label: 'Status' },
        { id: 'score', label: 'Score' },
        { id: 'owner', label: 'Owner' },
        { id: 'tags', label: 'Tags' },
        { id: 'source', label: 'Source' },
        { id: 'last_activity', label: 'Last Activity' },
        { id: 'created_at', label: 'Created' }
    ];

    const emptyContact = {
        first_name: '', last_name: '', job_title: '', email: '', company: '',
        website: '', phone: '', street_address: '', city: '', state: '',
        zip_code: '', country: '', linkedin_url: '', job_function: '',
        department: '', notes: '', tags: '', industry: '', company_size: '', owner: ''
    };

    const [newContact, setNewContact] = useState({ ...emptyContact });

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/leads');
            setContacts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchActivity = async (contactId) => {
        setLoadingActivity(true);
        try {
            const res = await axios.get(`/api/contacts/${contactId}/activity`);
            setActivityTimeline(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingActivity(false);
        }
    };

    const handleSaveContact = async () => {
        const fullName = `${newContact.first_name} ${newContact.last_name}`.trim() || 'Unknown';
        const emailDomain = newContact.email?.split('@')[1] || '';

        const payload = { ...newContact, name: fullName, email_domain: emailDomain };

        try {
            if (editingContact) {
                await axios.put(`/api/contacts/${editingContact.id}`, payload);
            } else {
                await axios.post('/api/leads', payload);
            }
            setShowAddModal(false);
            setEditingContact(null);
            setNewContact({ ...emptyContact });
            fetchContacts();
            toast.success(editingContact ? 'Contact updated' : 'Contact added successfully');
        } catch (err) {
            toast.error('Failed to save contact');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this contact?')) return;
        try {
            await axios.delete(`/api/leads/${id}`);
            fetchContacts();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`Delete ${selectedContacts.size} contacts?`)) return;
        try {
            for (const id of selectedContacts) {
                await axios.delete(`/api/leads/${id}`);
            }
            setSelectedContacts(new Set());
            fetchContacts();
            toast.success(`${selectedContacts.size} contacts deleted`);
        } catch (err) {
            toast.error('Failed to delete contacts');
        }
    };

    const handleExport = () => {
        window.location.href = '/api/export/leads';
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            alert('CSV must have headers and at least one row');
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const contacts = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};
            headers.forEach((h, idx) => {
                row[h] = values[idx] || '';
            });
            contacts.push(row);
        }

        try {
            const res = await axios.post('/api/import/csv', { contacts });
            setImportResults(res.data);
            fetchContacts();
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    };

    const handleOptOut = async (id) => {
        if (!confirm('Mark this contact as opted out?')) return;
        try {
            await axios.post(`/api/leads/${id}/opt-out`);
            fetchContacts();
        } catch (err) {
            alert('Failed to opt out');
        }
    };

    const handleAddNote = async (id, note) => {
        try {
            await axios.post(`/api/contacts/${id}/notes`, { note });
            fetchActivity(id);
        } catch (err) {
            alert('Failed to add note');
        }
    };

    const toggleSelectAll = () => {
        if (selectedContacts.size === filteredContacts.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
        }
    };

    const toggleSelect = (id) => {
        setSelectedContacts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const openEdit = (contact) => {
        setNewContact({
            first_name: contact.first_name || contact.name?.split(' ')[0] || '',
            last_name: contact.last_name || contact.name?.split(' ').slice(1).join(' ') || '',
            job_title: contact.job_title || '',
            email: contact.email || '',
            company: contact.company || '',
            website: contact.website || '',
            phone: contact.phone || '',
            street_address: contact.street_address || '',
            city: contact.city || '',
            state: contact.state || '',
            zip_code: contact.zip_code || '',
            country: contact.country || '',
            linkedin_url: contact.linkedin_url || '',
            job_function: contact.job_function || '',
            department: contact.department || '',
            notes: contact.notes || '',
            tags: contact.tags || '',
            industry: contact.industry || '',
            company_size: contact.company_size || '',
            owner: contact.owner || ''
        });
        setEditingContact(contact);
        setShowAddModal(true);
    };

    const openDetail = async (contact) => {
        setShowDetailModal(contact);
        await fetchActivity(contact.id);
    };

    // Filter and sort
    let filteredContacts = contacts.filter(c => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
            c.name?.toLowerCase().includes(searchLower) ||
            c.email?.toLowerCase().includes(searchLower) ||
            c.phone?.includes(searchTerm) ||
            c.company?.toLowerCase().includes(searchLower) ||
            c.job_title?.toLowerCase().includes(searchLower);

        const matchesCompany = !filters.company || c.company?.toLowerCase().includes(filters.company.toLowerCase());
        const matchesIndustry = !filters.industry || c.industry?.toLowerCase().includes(filters.industry.toLowerCase());
        const matchesStatus = filters.status === 'all' || c.status === filters.status;

        return matchesSearch && matchesCompany && matchesIndustry && matchesStatus;
    });

    filteredContacts = [...filteredContacts].sort((a, b) => {
        let aVal = a[sortBy] || '';
        let bVal = b[sortBy] || '';
        if (sortBy.includes('_at') || sortBy === 'last_activity') {
            aVal = new Date(aVal || 0).getTime();
            bVal = new Date(bVal || 0).getTime();
        }
        return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    const getStatusBadge = (status) => {
        const styles = {
            'NEW': 'bg-blue-500/20 text-blue-400',
            'ACTIVE': 'bg-green-500/20 text-green-400',
            'MANUAL_INTERVENTION': 'bg-purple-500/20 text-purple-400',
            'COMPLETED': 'bg-slate-500/20 text-slate-400',
            'OPTED_OUT': 'bg-red-500/20 text-red-400'
        };
        return styles[status] || 'bg-slate-500/20 text-slate-400';
    };

    const getActivityIcon = (activity) => {
        if (activity.activity_type === 'message') {
            return activity.direction === 'OUTBOUND'
                ? <Send size={14} className="text-blue-400" />
                : <MessageSquare size={14} className="text-green-400" />;
        }
        if (activity.activity_type === 'event') {
            const icons = {
                'EMAIL_OPEN': <Eye size={14} className="text-purple-400" />,
                'LINK_CLICK': <ExternalLink size={14} className="text-cyan-400" />,
                'OPT_OUT': <XCircle size={14} className="text-red-400" />
            };
            return icons[activity.type] || <AlertCircle size={14} className="text-amber-400" />;
        }
        if (activity.activity_type === 'task') {
            return activity.status === 'COMPLETED'
                ? <CheckCircle size={14} className="text-green-400" />
                : <Clock size={14} className="text-amber-400" />;
        }
        return <FileText size={14} className="text-slate-400" />;
    };

    const renderCell = (contact, column) => {
        const val = contact[column];

        if (column === 'name') {
            return (
                <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-medium text-sm">
                        {contact.name?.charAt(0) || '?'}
                    </div>
                    <div>
                        <p className="font-medium text-white">{contact.name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                    </div>
                </div>
            );
        }
        if (column === 'status') {
            return (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(val)}`}>
                    {val?.replace(/_/g, ' ') || 'NEW'}
                </span>
            );
        }
        if (column === 'linkedin_url' && val) {
            return (
                <a href={val} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline flex items-center">
                    <Linkedin size={14} className="mr-1" /> View
                </a>
            );
        }
        if (column === 'website' && val) {
            return (
                <a href={val.startsWith('http') ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center">
                    <Globe size={14} className="mr-1" /> {val.replace(/^https?:\/\//, '').slice(0, 20)}
                </a>
            );
        }
        if (column === 'last_activity' || column === 'created_at') {
            return val ? (
                <span className="text-xs text-slate-500">
                    {formatDistanceToNow(new Date(val), { addSuffix: true })}
                </span>
            ) : '-';
        }
        if (column === 'tags' && val) {
            return (
                <div className="flex flex-wrap gap-1">
                    {val.split(',').slice(0, 2).map((tag, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-700 text-slate-300 text-[10px] rounded">
                            {tag.trim()}
                        </span>
                    ))}
                </div>
            );
        }
        if (column === 'score') {
            return (
                <div className="flex items-center space-x-1">
                    <div className="w-8 bg-slate-700 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, val || 0)}%` }}></div>
                    </div>
                    <span className="text-xs text-slate-400">{val || 0}</span>
                </div>
            );
        }

        return <span className="text-slate-400 text-sm">{val || '-'}</span>;
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">CRM Contacts</h1>
                    <p className="text-slate-500 text-sm mt-1">{contacts.length} contacts in your database</p>
                </div>
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => setShowImportModal(true)}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg transition-colors"
                    >
                        <Upload size={16} />
                        <span>Import CSV</span>
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-lg transition-colors"
                    >
                        <Download size={16} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={() => { setNewContact({ ...emptyContact }); setEditingContact(null); setShowAddModal(true); }}
                        className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25"
                    >
                        <Plus size={16} />
                        <span>Add Contact</span>
                    </button>
                </div>
            </div>

            {/* Search, Filter & Column Picker */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search by name, email, phone, company..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-[#1e293b] border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center space-x-2 px-4 py-2.5 border rounded-lg text-sm transition-colors
                            ${showFilters ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1e293b] border-slate-700/50 text-slate-400'}`}
                    >
                        <SlidersHorizontal size={16} />
                        <span>Filters</span>
                    </button>

                    <div className="relative">
                        <button
                            onClick={() => setShowColumnPicker(!showColumnPicker)}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-[#1e293b] border border-slate-700/50 rounded-lg text-sm text-slate-400"
                        >
                            <Eye size={16} />
                            <span>Columns</span>
                            <ChevronDown size={14} />
                        </button>

                        {showColumnPicker && (
                            <div className="absolute top-full right-0 mt-2 w-56 bg-[#1e293b] border border-slate-700 rounded-lg shadow-xl z-50 p-2 max-h-80 overflow-y-auto">
                                {allColumns.map(col => (
                                    <label key={col.id} className="flex items-center px-2 py-1.5 hover:bg-slate-800 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={columns.includes(col.id)}
                                            onChange={() => {
                                                if (columns.includes(col.id)) {
                                                    setColumns(columns.filter(c => c !== col.id));
                                                } else {
                                                    setColumns([...columns, col.id]);
                                                }
                                            }}
                                            className="mr-2 rounded border-slate-600"
                                        />
                                        <span className="text-sm text-slate-300">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={fetchContacts} className="p-2.5 bg-[#1e293b] border border-slate-700/50 rounded-lg text-slate-400 hover:text-white">
                        <RefreshCw size={16} />
                    </button>
                </div>

                {selectedContacts.size > 0 && (
                    <div className="flex items-center space-x-2 ml-4">
                        <span className="text-sm text-slate-400">{selectedContacts.size} selected</span>
                        <button onClick={handleBulkDelete} className="flex items-center space-x-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">
                            <Trash2 size={14} />
                            <span>Delete</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Filter Bar */}
            {showFilters && (
                <div className="flex items-center space-x-4 mb-4 p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Status:</span>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        >
                            <option value="all">All</option>
                            <option value="NEW">New</option>
                            <option value="ACTIVE">Active</option>
                            <option value="MANUAL_INTERVENTION">Needs Reply</option>
                            <option value="COMPLETED">Completed</option>
                            <option value="OPTED_OUT">Opted Out</option>
                        </select>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Company:</span>
                        <input
                            type="text"
                            value={filters.company}
                            onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white w-32"
                            placeholder="Filter..."
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500">Sort:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                        >
                            {allColumns.map(col => (
                                <option key={col.id} value={col.id}>{col.label}</option>
                            ))}
                        </select>
                        <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')} className="p-1 text-slate-400 hover:text-white">
                            <ArrowUpDown size={14} />
                        </button>
                    </div>
                    <button onClick={() => setFilters({ company: '', industry: '', status: 'all' })} className="text-xs text-blue-400 hover:text-blue-300">
                        Reset
                    </button>
                </div>
            )}

            {/* Results Count */}
            <div className="text-xs text-slate-500 mb-3">
                Showing {filteredContacts.length} of {contacts.length} contacts
            </div>

            {/* Contacts Table */}
            <div className="bg-[#1e293b] rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="py-3 px-4 text-left w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                                        onChange={toggleSelectAll}
                                        className="rounded border-slate-600"
                                    />
                                </th>
                                {columns.map(col => (
                                    <th key={col} className="text-left py-3 px-4 font-medium cursor-pointer hover:text-white" onClick={() => { setSortBy(col); setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); }}>
                                        {allColumns.find(c => c.id === col)?.label}
                                    </th>
                                ))}
                                <th className="text-right py-3 px-4 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan={columns.length + 2} className="p-4">
                                        <TableSkeleton rows={10} columns={columns.length + 1} />
                                    </td>
                                </tr>
                            ) : filteredContacts.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length + 2} className="py-12 text-center text-slate-500">
                                        <Users size={32} className="mx-auto mb-2 opacity-30" />
                                        No contacts found
                                    </td>
                                </tr>
                            ) : (
                                filteredContacts.map(contact => (
                                    <tr key={contact.id} className={`hover:bg-slate-800/30 transition-colors ${selectedContacts.has(contact.id) ? 'bg-blue-900/10' : ''}`}>
                                        <td className="py-3 px-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedContacts.has(contact.id)}
                                                onChange={() => toggleSelect(contact.id)}
                                                className="rounded border-slate-600"
                                            />
                                        </td>
                                        {columns.map(col => (
                                            <td key={col} className="py-3 px-4">
                                                {renderCell(contact, col)}
                                            </td>
                                        ))}
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end space-x-1">
                                                <button onClick={() => openDetail(contact)} className="p-2 hover:bg-slate-800 text-slate-400 rounded-lg" title="View">
                                                    <Eye size={16} />
                                                </button>
                                                <button onClick={() => openEdit(contact)} className="p-2 hover:bg-slate-800 text-blue-400 rounded-lg" title="Edit">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => navigate('/inbox', { state: { leadId: contact.id } })} className="p-2 hover:bg-slate-800 text-green-400 rounded-lg" title="Message">
                                                    <MessageSquare size={16} />
                                                </button>
                                                <button onClick={() => handleOptOut(contact.id)} className="p-2 hover:bg-red-500/20 text-amber-400 rounded-lg" title="Opt Out">
                                                    <XCircle size={16} />
                                                </button>
                                                <button onClick={() => handleDelete(contact.id)} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg" title="Delete">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] rounded-xl border border-slate-700 w-full max-w-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Import Contacts</h3>
                            <button onClick={() => { setShowImportModal(false); setImportResults(null); }} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        {!importResults ? (
                            <>
                                <p className="text-slate-400 text-sm mb-4">
                                    Upload a CSV file with your contacts. Supported headers:
                                </p>
                                <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-500 mb-4 font-mono overflow-x-auto">
                                    First Name, Last Name, Job Title, Email, Company, Website, phone_number,
                                    Company Street Address, Company City, Company State, Company Zip Code,
                                    Company Country, LinkedIn Contact Profile URL, Job Function, Department
                                </div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                                >
                                    <Upload size={20} />
                                    <span>Choose CSV File</span>
                                </button>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-center space-x-2 text-green-400">
                                    <CheckCircle size={24} />
                                    <span className="text-lg font-medium">Import Complete</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div className="bg-slate-800 rounded-lg p-3">
                                        <p className="text-2xl font-bold text-green-400">{importResults.imported}</p>
                                        <p className="text-xs text-slate-500">Imported</p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3">
                                        <p className="text-2xl font-bold text-amber-400">{importResults.skipped}</p>
                                        <p className="text-xs text-slate-500">Skipped</p>
                                    </div>
                                    <div className="bg-slate-800 rounded-lg p-3">
                                        <p className="text-2xl font-bold text-slate-400">{importResults.total}</p>
                                        <p className="text-xs text-slate-500">Total</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setShowImportModal(false); setImportResults(null); }}
                                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg"
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Add/Edit Contact Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-[#1e293b] border-b border-slate-700 px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-white">{editingContact ? 'Edit Contact' : 'Add New Contact'}</h3>
                            <button onClick={() => { setShowAddModal(false); setEditingContact(null); }} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Personal Info */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                                    <User size={14} className="mr-2" /> Personal Information
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="First Name" value={newContact.first_name} onChange={v => setNewContact({ ...newContact, first_name: v })} />
                                    <InputField label="Last Name" value={newContact.last_name} onChange={v => setNewContact({ ...newContact, last_name: v })} />
                                    <InputField label="Email" type="email" value={newContact.email} onChange={v => setNewContact({ ...newContact, email: v })} />
                                    <InputField label="Phone" value={newContact.phone} onChange={v => setNewContact({ ...newContact, phone: v })} />
                                    <InputField label="LinkedIn URL" value={newContact.linkedin_url} onChange={v => setNewContact({ ...newContact, linkedin_url: v })} placeholder="https://linkedin.com/in/..." />
                                </div>
                            </div>

                            {/* Company Info */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                                    <Building size={14} className="mr-2" /> Company Information
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Company" value={newContact.company} onChange={v => setNewContact({ ...newContact, company: v })} />
                                    <InputField label="Job Title" value={newContact.job_title} onChange={v => setNewContact({ ...newContact, job_title: v })} />
                                    <InputField label="Department" value={newContact.department} onChange={v => setNewContact({ ...newContact, department: v })} />
                                    <InputField label="Job Function" value={newContact.job_function} onChange={v => setNewContact({ ...newContact, job_function: v })} />
                                    <InputField label="Website" value={newContact.website} onChange={v => setNewContact({ ...newContact, website: v })} placeholder="example.com" />
                                    <InputField label="Industry" value={newContact.industry} onChange={v => setNewContact({ ...newContact, industry: v })} />
                                    <InputField label="Company Size" value={newContact.company_size} onChange={v => setNewContact({ ...newContact, company_size: v })} placeholder="1-10, 11-50, 51-200..." />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                                    <MapPin size={14} className="mr-2" /> Address
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <InputField label="Street Address" value={newContact.street_address} onChange={v => setNewContact({ ...newContact, street_address: v })} />
                                    </div>
                                    <InputField label="City" value={newContact.city} onChange={v => setNewContact({ ...newContact, city: v })} />
                                    <InputField label="State/Province" value={newContact.state} onChange={v => setNewContact({ ...newContact, state: v })} />
                                    <InputField label="Zip/Postal Code" value={newContact.zip_code} onChange={v => setNewContact({ ...newContact, zip_code: v })} />
                                    <InputField label="Country" value={newContact.country} onChange={v => setNewContact({ ...newContact, country: v })} />
                                </div>
                            </div>

                            {/* Additional */}
                            <div>
                                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center">
                                    <Tag size={14} className="mr-2" /> Additional
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField label="Tags" value={newContact.tags} onChange={v => setNewContact({ ...newContact, tags: v })} placeholder="vip, prospect, hot-lead" />
                                    <InputField label="Owner" value={newContact.owner} onChange={v => setNewContact({ ...newContact, owner: v })} placeholder="Sales rep name" />
                                    <div className="col-span-2">
                                        <label className="block text-sm text-slate-400 mb-1">Notes</label>
                                        <textarea
                                            value={newContact.notes}
                                            onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none"
                                            placeholder="Add notes about this contact..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-[#1e293b] border-t border-slate-700 px-6 py-4 flex justify-end space-x-3">
                            <button onClick={() => { setShowAddModal(false); setEditingContact(null); }} className="px-4 py-2 text-slate-400 hover:text-white">
                                Cancel
                            </button>
                            <button onClick={handleSaveContact} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium">
                                {editingContact ? 'Save Changes' : 'Add Contact'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Detail Modal with Activity Timeline */}
            {showDetailModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] rounded-xl border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold">
                                        {showDetailModal.name?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{showDetailModal.name || 'Unknown'}</h3>
                                        <p className="text-slate-400">{showDetailModal.job_title} at {showDetailModal.company}</p>
                                        <div className="flex items-center space-x-3 mt-1">
                                            {showDetailModal.email && (
                                                <a href={`mailto:${showDetailModal.email}`} className="text-blue-400 text-sm hover:underline">{showDetailModal.email}</a>
                                            )}
                                            {showDetailModal.phone && (
                                                <span className="text-slate-500 text-sm">{showDetailModal.phone}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setShowDetailModal(null)} className="text-slate-500 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-2 gap-6">
                                {/* Contact Info */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Details</h4>
                                    <DetailRow icon={<Mail size={14} />} label="Email" value={showDetailModal.email} />
                                    <DetailRow icon={<Phone size={14} />} label="Phone" value={showDetailModal.phone} />
                                    <DetailRow icon={<Building size={14} />} label="Company" value={showDetailModal.company} />
                                    <DetailRow icon={<Globe size={14} />} label="Website" value={showDetailModal.website} link />
                                    <DetailRow icon={<Linkedin size={14} />} label="LinkedIn" value={showDetailModal.linkedin_url} link />
                                    <DetailRow icon={<MapPin size={14} />} label="Location" value={[showDetailModal.city, showDetailModal.state, showDetailModal.country].filter(Boolean).join(', ')} />
                                    <DetailRow icon={<Tag size={14} />} label="Tags" value={showDetailModal.tags} />
                                    <DetailRow icon={<Hash size={14} />} label="Status" value={showDetailModal.status} />
                                </div>

                                {/* Activity Timeline */}
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Activity Timeline</h4>
                                    {loadingActivity ? (
                                        <div className="text-center py-8 text-slate-500">
                                            <RefreshCw className="animate-spin mx-auto mb-2" size={20} />
                                            Loading...
                                        </div>
                                    ) : activityTimeline.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500">
                                            <Clock size={24} className="mx-auto mb-2 opacity-30" />
                                            No activity yet
                                        </div>
                                    ) : (
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                            {activityTimeline.map((activity, idx) => (
                                                <div key={idx} className="flex items-start space-x-3 p-2 bg-slate-800/50 rounded-lg">
                                                    <div className="mt-0.5">{getActivityIcon(activity)}</div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-white truncate">
                                                            {activity.activity_type === 'message'
                                                                ? `${activity.direction} ${activity.type}`
                                                                : activity.activity_type === 'task'
                                                                    ? activity.title
                                                                    : activity.type
                                                            }
                                                        </p>
                                                        {activity.content && (
                                                            <p className="text-xs text-slate-500 truncate">{activity.content.slice(0, 50)}...</p>
                                                        )}
                                                        <p className="text-[10px] text-slate-600">
                                                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-700 flex space-x-3">
                            <button onClick={() => { setShowDetailModal(null); openEdit(showDetailModal); }} className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                                <Edit2 size={16} /> <span>Edit</span>
                            </button>
                            <button onClick={() => navigate('/inbox', { state: { leadId: showDetailModal.id } })} className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg">
                                <MessageSquare size={16} /> <span>Message</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper components removed (moved to top)

function DetailRow({ icon, label, value, link = false }) {
    if (!value) return null;
    return (
        <div className="flex items-start space-x-3 p-3 bg-slate-800/50 rounded-lg">
            <div className="text-slate-500 mt-0.5">{icon}</div>
            <div>
                <p className="text-xs text-slate-500">{label}</p>
                {link ? (
                    <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline flex items-center text-sm">
                        {value.replace(/^https?:\/\//, '').slice(0, 35)} <ExternalLink size={12} className="ml-1" />
                    </a>
                ) : (
                    <p className="text-white text-sm">{value}</p>
                )}
            </div>
        </div>
    );
}
