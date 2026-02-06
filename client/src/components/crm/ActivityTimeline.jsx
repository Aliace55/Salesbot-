import React, { useState } from 'react';
import {
    MessageSquare, Phone, Mail, FileText, Calendar,
    CheckCircle, Clock, Send, User, ChevronDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function ActivityTimeline({ activities = [], onCreateNote, onCreateTask, entityType }) {
    const [activeTab, setActiveTab] = useState('all');
    const [noteInput, setNoteInput] = useState('');

    const tabs = [
        { id: 'all', label: 'All Activity' },
        { id: 'notes', label: 'Notes' },
        { id: 'emails', label: 'Emails' },
        { id: 'calls', label: 'Calls' },
        { id: 'tasks', label: 'Tasks' },
    ];

    const filteredActivities = activeTab === 'all'
        ? activities
        : activities.filter(a => mapActivityToTab(a) === activeTab);

    const handleSubmitNote = (e) => {
        e.preventDefault();
        if (!noteInput.trim()) return;
        onCreateNote(noteInput);
        setNoteInput('');
    };

    return (
        <div className="flex flex-col h-full bg-[#1e293b] border-x border-slate-700/50">
            {/* Composer Area */}
            <div className="p-4 border-b border-slate-700/50 bg-slate-800/30">
                <div className="flex space-x-4 mb-4">
                    <button className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
                        <div className="p-2 bg-yellow-500/20 rounded-full text-yellow-400"><FileText size={18} /></div>
                        <span className="text-sm font-medium">Note</span>
                    </button>
                    <button className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
                        <div className="p-2 bg-blue-500/20 rounded-full text-blue-400"><Mail size={18} /></div>
                        <span className="text-sm font-medium">Email</span>
                    </button>
                    <button className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
                        <div className="p-2 bg-purple-500/20 rounded-full text-purple-400"><Phone size={18} /></div>
                        <span className="text-sm font-medium">Call</span>
                    </button>
                    <button className="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors">
                        <div className="p-2 bg-green-500/20 rounded-full text-green-400"><CheckCircle size={18} /></div>
                        <span className="text-sm font-medium">Task</span>
                    </button>
                </div>

                <form onSubmit={handleSubmitNote} className="relative group">
                    <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Start typing a note..."
                        className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-slate-900 transition-all resize-none h-24"
                    />
                    <div className="absolute bottom-3 right-3 flex items-center space-x-2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                        <button type="submit" disabled={!noteInput.trim()} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-md shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            Save Note
                        </button>
                    </div>
                </form>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center px-4 py-2 border-b border-slate-700/50 space-x-4 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`text-xs font-medium py-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                ? 'text-blue-400 border-blue-500'
                                : 'text-slate-500 border-transparent hover:text-slate-300'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Timeline Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {filteredActivities.length === 0 ? (
                    <div className="text-center py-10">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-800 mb-3">
                            <Clock size={20} className="text-slate-500" />
                        </div>
                        <p className="text-slate-400 text-sm">No recent activity</p>
                    </div>
                ) : (
                    filteredActivities.map((activity, idx) => (
                        <TimelineItem key={activity.id || idx} activity={activity} />
                    ))
                )}
            </div>
        </div>
    );
}

function TimelineItem({ activity }) {
    const { icon, color, title, subtitle, date } = getActivityConfig(activity);

    return (
        <div className="flex space-x-3 group animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ring-4 ring-[#1e293b]
                ${color}
            `}>
                {icon}
            </div>
            <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-baseline justify-between">
                    <p className="text-sm font-medium text-white truncate pr-2">
                        {title}
                        {activity.user && <span className="text-slate-500 font-normal ml-1">by {activity.user}</span>}
                    </p>
                    <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0">
                        {date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : 'Just now'}
                    </span>
                </div>
                {subtitle && (
                    <div className="mt-1 text-sm text-slate-400 bg-slate-800/40 rounded-lg p-3 border border-slate-700/30">
                        {subtitle}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper to map backend activity types to UI configuration
function getActivityConfig(activity) {
    // Default fallback
    let config = {
        icon: <FileText size={14} className="text-white" />,
        color: 'bg-slate-600',
        title: 'Unknown Activity',
        date: activity.created_at
    };

    const type = activity.type || activity.activity_type;

    if (['NOTE', 'note'].includes(type)) {
        config = {
            icon: <FileText size={14} />,
            color: 'bg-yellow-500',
            title: 'Note logged',
            subtitle: activity.content || activity.note,
            date: activity.created_at
        };
    } else if (['EMAIL', 'email', 'EMAIL_OPEN', 'email_open'].includes(type)) {
        config = {
            icon: <Mail size={14} />,
            color: 'bg-blue-500',
            title: type === 'EMAIL_OPEN' ? 'Email opened' : 'Email sent',
            subtitle: activity.subject || (type === 'EMAIL_OPEN' ? 'Recipient opened the email' : activity.body),
            date: activity.created_at
        };
    } else if (['call', 'CALL'].includes(type)) {
        config = {
            icon: <Phone size={14} />,
            color: 'bg-purple-500',
            title: 'Call logged',
            subtitle: `Outcome: ${activity.outcome || 'No outcome'}\n${activity.notes || ''}`,
            date: activity.created_at
        };
    } else if (['task', 'TASK'].includes(type)) {
        config = {
            icon: <CheckCircle size={14} />,
            color: 'bg-green-500',
            title: 'Task updated',
            subtitle: activity.title,
            date: activity.created_at
        };
    }

    return config;
}

function mapActivityToTab(activity) {
    const type = (activity.type || activity.activity_type || '').toLowerCase();
    if (type.includes('note')) return 'notes';
    if (type.includes('email')) return 'emails';
    if (type.includes('call')) return 'calls';
    if (type.includes('task')) return 'tasks';
    return 'other';
}
