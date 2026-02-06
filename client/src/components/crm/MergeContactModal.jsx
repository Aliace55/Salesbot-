import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search, Users, AlertTriangle, Check } from 'lucide-react';

export function MergeContactModal({ isOpen, onClose, sourceContact, onMergeSuccess }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTarget, setSelectedTarget] = useState(null);
    const [merging, setMerging] = useState(false);

    useEffect(() => {
        if (isOpen && searchQuery.length > 2) {
            const timeoutId = setTimeout(() => {
                searchContacts();
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setContacts([]);
        }
    }, [searchQuery, isOpen]);

    const searchContacts = async () => {
        setLoading(true);
        try {
            // Reusing the main contacts endpoint, assuming it might return all or we can filter client side if needed
            // Ideally we'd have a search endpoint, but filtering the list is fine for now if list is small,
            // or if the backend endpoint supports filtering.
            // Let's assume we fetch all and filter client side for now as the current List page does.
            const res = await axios.get('/api/contacts');
            const all = res.data;
            const filtered = all.filter(c =>
                c.id !== sourceContact.id && // Exclude self
                (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    c.email?.toLowerCase().includes(searchQuery.toLowerCase()))
            ).slice(0, 5); // Limit to 5
            setContacts(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleMerge = async () => {
        if (!selectedTarget || !sourceContact) return;

        setMerging(true);
        try {
            await axios.post('/api/contacts/merge', {
                sourceId: sourceContact.id,
                targetId: selectedTarget.id
            });
            onMergeSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert("Failed to merge contacts");
        } finally {
            setMerging(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-[#1e293b] border border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="text-amber-400" size={20} />
                        Merge Contact
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">

                    {/* Source Info */}
                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold shrink-0">
                            {sourceContact?.name?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs text-slate-500 uppercase font-bold">Merging From</p>
                            <p className="text-sm font-medium text-white truncate">{sourceContact?.name}</p>
                            <p className="text-xs text-slate-400 truncate">{sourceContact?.email}</p>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <div className="bg-slate-800 p-2 rounded-full border border-slate-700 text-slate-400">
                            <ArrowDown size={16} />
                        </div>
                    </div>

                    {/* Target Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Merge Into (Keep This One)</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search target contact..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-slate-600"
                            />
                        </div>

                        {/* Results */}
                        {contacts.length > 0 && !selectedTarget && (
                            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden mt-2">
                                {contacts.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedTarget(c)}
                                        className="w-full flex items-center p-3 hover:bg-slate-800 transition-colors text-left space-x-3 border-b border-slate-700/50 last:border-0"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                                            {c.name?.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{c.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{c.company}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Selected Target */}
                        {selectedTarget && (
                            <div className="bg-blue-500/10 border border-blue-500/50 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center space-x-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
                                        {selectedTarget.name?.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs text-blue-300 uppercase font-bold">Target (Will Keep)</p>
                                        <p className="text-sm font-medium text-white truncate">{selectedTarget.name}</p>
                                        <p className="text-xs text-slate-300 truncate">{selectedTarget.company}</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedTarget(null)} className="text-slate-400 hover:text-white">
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg flex items-start space-x-3">
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={16} />
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-500">Warning</p>
                            <p className="text-xs text-amber-200/80 leading-relaxed">
                                Messages, tasks, and events from <strong>{sourceContact?.name}</strong> will be moved to the target.
                                The source contact will be <strong>permanently deleted</strong>. This cannot be undone.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-700/50 flex justify-end gap-3 bg-slate-800/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleMerge}
                        disabled={!selectedTarget || merging}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-lg shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {merging ? 'Merging...' : 'Confirm Merge'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ArrowDown({ size = 20, className = "" }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
    )
}
