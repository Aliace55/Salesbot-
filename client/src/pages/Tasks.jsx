import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Phone, Linkedin, Mail, MessageSquare, CheckCircle, X, Clock, User, Calendar, ChevronRight, AlertCircle } from 'lucide-react';

export default function Tasks() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('PENDING');

    useEffect(() => {
        fetchTasks();
    }, [filter]);

    const fetchTasks = async () => {
        try {
            const res = await axios.get(`/api/tasks?status=${filter}`);
            setTasks(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = async (taskId) => {
        try {
            await axios.post(`/api/tasks/${taskId}/complete`);
            fetchTasks();
        } catch (err) {
            console.error(err);
        }
    };

    const handleSkip = async (taskId) => {
        try {
            await axios.post(`/api/tasks/${taskId}/skip`);
            fetchTasks();
        } catch (err) {
            console.error(err);
        }
    };

    const getTaskIcon = (type) => {
        const icons = {
            'CALL': <Phone size={20} className="text-green-400" />,
            'LINKEDIN': <Linkedin size={20} className="text-sky-400" />,
            'EMAIL_MANUAL': <Mail size={20} className="text-purple-400" />,
            'SMS': <MessageSquare size={20} className="text-blue-400" />,
            'FOLLOW_UP': <Calendar size={20} className="text-amber-400" />
        };
        return icons[type] || <CheckCircle size={20} className="text-slate-400" />;
    };

    const getTaskColor = (type) => {
        const colors = {
            'CALL': 'border-green-500/30 bg-green-500/5',
            'LINKEDIN': 'border-sky-500/30 bg-sky-500/5',
            'EMAIL_MANUAL': 'border-purple-500/30 bg-purple-500/5',
            'SMS': 'border-blue-500/30 bg-blue-500/5',
            'FOLLOW_UP': 'border-amber-500/30 bg-amber-500/5'
        };
        return colors[type] || 'border-slate-500/30 bg-slate-500/5';
    };

    const tasksByType = {
        CALL: tasks.filter(t => t.type === 'CALL'),
        LINKEDIN: tasks.filter(t => t.type === 'LINKEDIN'),
        OTHER: tasks.filter(t => !['CALL', 'LINKEDIN'].includes(t.type))
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Tasks</h1>
                    <p className="text-slate-500 text-sm mt-1">{tasks.length} tasks {filter.toLowerCase()}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {['PENDING', 'COMPLETED', 'SKIPPED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                ${filter === status
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading tasks...</div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-12">
                    <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                    <p className="text-slate-400">All caught up! No {filter.toLowerCase()} tasks.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Calls Column */}
                    <div>
                        <div className="flex items-center space-x-2 mb-4">
                            <Phone size={18} className="text-green-400" />
                            <h2 className="font-semibold text-white">Calls</h2>
                            <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                                {tasksByType.CALL.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {tasksByType.CALL.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onComplete={handleComplete}
                                    onSkip={handleSkip}
                                    icon={getTaskIcon(task.type)}
                                    colorClass={getTaskColor(task.type)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* LinkedIn Column */}
                    <div>
                        <div className="flex items-center space-x-2 mb-4">
                            <Linkedin size={18} className="text-sky-400" />
                            <h2 className="font-semibold text-white">LinkedIn</h2>
                            <span className="px-2 py-0.5 text-xs bg-sky-500/20 text-sky-400 rounded-full">
                                {tasksByType.LINKEDIN.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {tasksByType.LINKEDIN.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onComplete={handleComplete}
                                    onSkip={handleSkip}
                                    icon={getTaskIcon(task.type)}
                                    colorClass={getTaskColor(task.type)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Other Tasks Column */}
                    <div>
                        <div className="flex items-center space-x-2 mb-4">
                            <CheckCircle size={18} className="text-slate-400" />
                            <h2 className="font-semibold text-white">Other</h2>
                            <span className="px-2 py-0.5 text-xs bg-slate-500/20 text-slate-400 rounded-full">
                                {tasksByType.OTHER.length}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {tasksByType.OTHER.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onComplete={handleComplete}
                                    onSkip={handleSkip}
                                    icon={getTaskIcon(task.type)}
                                    colorClass={getTaskColor(task.type)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function TaskCard({ task, onComplete, onSkip, icon, colorClass }) {
    return (
        <div className={`rounded-xl border p-4 ${colorClass}`}>
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-800 rounded-lg">
                        {icon}
                    </div>
                    <div>
                        <p className="font-medium text-white text-sm">{task.lead_name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{task.lead_email}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-1">
                    <Clock size={12} className="text-slate-600" />
                    <span className="text-xs text-slate-600">
                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No due date'}
                    </span>
                </div>
            </div>

            <p className="text-sm text-slate-300 mb-4">{task.description || task.title}</p>

            {task.status === 'PENDING' && (
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => onComplete(task.id)}
                        className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <CheckCircle size={14} />
                        <span>Complete</span>
                    </button>
                    <button
                        onClick={() => onSkip(task.id)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-sm transition-colors"
                    >
                        Skip
                    </button>
                </div>
            )}
        </div>
    );
}
