import React, { useState, useEffect } from 'react';
import { X, Calendar, Type, FileText } from 'lucide-react';
import { format } from 'date-fns';

export function TaskModal({ isOpen, onClose, onSave, task = null, defaults = {} }) {
    const [formData, setFormData] = useState({
        title: '',
        type: 'TASK',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        lead_id: null
    });

    useEffect(() => {
        if (isOpen) {
            if (task) {
                // Edit Mode
                setFormData({
                    title: task.title || '',
                    type: task.type || 'TASK',
                    due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                    description: task.description || '',
                    lead_id: task.lead_id || null
                });
            } else {
                // Create Mode
                setFormData({
                    title: '',
                    type: 'TASK',
                    due_date: format(new Date(), 'yyyy-MM-dd'),
                    description: '',
                    lead_id: null,
                    ...defaults
                });
            }
        }
    }, [isOpen, task, defaults]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-slate-800">
                    <h3 className="text-lg font-bold text-white">
                        {task ? 'Edit Task' : 'New Task'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Task Title</label>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            placeholder="e.g. Call John Doe"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Type */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Type</label>
                            <div className="relative">
                                <Type className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                                >
                                    <option value="TASK">Task</option>
                                    <option value="CALL">Call</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="LINKEDIN">LinkedIn</option>
                                    <option value="MEETING">Meeting</option>
                                </select>
                            </div>
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Due Date</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-2.5 text-slate-500" size={14} />
                                <input
                                    type="date"
                                    value={formData.due_date}
                                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wide">Description</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3 text-slate-500" size={14} />
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[100px] resize-none"
                                placeholder="Add details, link, or notes..."
                            />
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20 transition-all transform active:scale-95"
                        >
                            {task ? 'Save Changes' : 'Create Task'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
