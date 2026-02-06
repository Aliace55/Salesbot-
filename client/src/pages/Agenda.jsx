import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Calendar as CalendarIcon, Clock, Video, CheckCircle, XCircle,
    MoreVertical, FileText, User, Linkedin, MessageSquare, Phone,
    ChevronLeft, ChevronRight, Plus, Search, Filter, Trash2, Edit2, X
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { useToast } from '../components/ToastProvider';

export default function Agenda() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('both'); // 'meetings', 'tasks', 'both'
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const toast = useToast();

    // Data State
    const [tasks, setTasks] = useState([]);
    const [meetings, setMeetings] = useState([]); // Still need Meetings API, using mock for now or fetch if available
    const [loading, setLoading] = useState(true);

    // Modal State
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [newTask, setNewTask] = useState({ title: '', type: 'TASK', due_date: format(new Date(), 'yyyy-MM-dd'), lead_id: null });

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Tasks
            const tasksRes = await axios.get('/api/tasks?limit=100');
            setTasks(tasksRes.data);

            // Fetch Meetings (Mock for now as backend endpoint might not exist yet similar to tasks)
            // But we'll try to keep existing mock data logic for meetings just in case
            // or fetch if we made an endpoint. Stick to mock for meetings to avoid breaking it.
            setMeetings([
                {
                    id: 101,
                    title: 'Demo with Express Freight',
                    time: '1:00 PM',
                    duration: '45m',
                    lead: 'David Wallace',
                    company: 'Express Freight',
                    source: 'Inbound',
                    status: 'confirmed',
                    attendees: ['David Wallace', 'Jim Halpert']
                }
            ]);

        } catch (err) {
            console.error(err);
            toast.error("Failed to load agenda");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        try {
            if (editingTask) {
                await axios.put(`/api/tasks/${editingTask.id}`, newTask);
                toast.success("Task updated");
            } else {
                await axios.post('/api/tasks', newTask);
                toast.success("Task created");
            }
            setShowTaskModal(false);
            setEditingTask(null);
            setNewTask({ title: '', type: 'TASK', due_date: format(new Date(), 'yyyy-MM-dd'), lead_id: null });
            fetchData();
        } catch (err) {
            console.error(err);
            toast.error("Failed to save task");
        }
    };

    const handleToggleComplete = async (task) => {
        const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

        try {
            await axios.put(`/api/tasks/${task.id}`, { status: newStatus });
        } catch (err) {
            toast.error("Failed to update status");
            fetchData(); // Revert
        }
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm("Delete this task?")) return;
        try {
            await axios.delete(`/api/tasks/${id}`);
            setTasks(prev => prev.filter(t => t.id !== id));
            toast.success("Task deleted");
        } catch (err) {
            toast.error("Failed to delete task");
        }
    };

    const openEditModal = (task) => {
        setEditingTask(task);
        setNewTask({
            title: task.title,
            type: task.type,
            due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : '',
            lead_id: task.lead_id
        });
        setShowTaskModal(true);
    };

    // Filter tasks for selected date (optional, currently showing all pending or specific date tasks?)
    // Let's filter by selectedDate if desired, or show all pending. 
    // Usually Agenda shows Today's tasks + Overdue.
    const filteredTasks = tasks.filter(t => {
        if (t.status === 'COMPLETED' && !isSameDay(new Date(t.created_at), selectedDate)) return false; // Hide old completed
        return true; // Show all pending for now to be safe, or filter strictly
    });

    const getDaysInWeek = (date) => {
        const start = startOfWeek(date, { weekStartsOn: 1 });
        const end = endOfWeek(date, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    };

    const weekDays = getDaysInWeek(selectedDate);

    return (
        <div className="flex h-[calc(100vh-2rem)] space-x-6">
            {/* Left: Calendar & List */}
            <div className="flex-1 flex flex-col space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Agenda</h1>
                        <p className="text-slate-400 text-sm">Manage your meetings and daily tasks</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => {
                                setEditingTask(null);
                                setNewTask({ title: '', type: 'TASK', due_date: format(new Date(), 'yyyy-MM-dd') });
                                setShowTaskModal(true);
                            }}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg shadow-blue-500/20 transition-all"
                        >
                            <Plus size={16} />
                            <span>New Task</span>
                        </button>

                        <div className="flex bg-slate-800 p-1 rounded-lg">
                            {['meetings', 'tasks', 'both'].map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${viewMode === mode ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Calendar Strip */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                    {/* ... Calendar logic kept same as before ... */}
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">{format(selectedDate, 'MMMM yyyy')}</h2>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronLeft size={18} /></button>
                            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-xs font-medium text-white">Today</button>
                            <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><ChevronRight size={18} /></button>
                        </div>
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                        {weekDays.map((day, i) => (
                            <button
                                key={i}
                                onClick={() => setSelectedDate(day)}
                                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all border ${isSameDay(day, selectedDate)
                                    ? 'bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20'
                                    : isToday(day)
                                        ? 'bg-slate-700/50 border-slate-600'
                                        : 'bg-slate-800/30 border-transparent hover:bg-slate-700/50 hover:border-slate-600'
                                    }`}
                            >
                                <span className={`text-xs font-medium mb-1 ${isSameDay(day, selectedDate) ? 'text-blue-100' : 'text-slate-500'}`}>
                                    {format(day, 'EEE')}
                                </span>
                                <span className={`text-lg font-bold ${isSameDay(day, selectedDate) ? 'text-white' : 'text-slate-300'}`}>
                                    {format(day, 'd')}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Day's Agenda */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {/* Meetings Section (Static for now) */}
                    {(viewMode === 'meetings' || viewMode === 'both') && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-400 sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10 flex items-center">
                                <Video size={14} className="mr-2 text-purple-400" /> Matches & Demos
                            </h3>
                            {meetings.map((meeting) => (
                                <div key={meeting.id} onClick={() => setSelectedMeeting(meeting)} className="p-4 rounded-xl border border-slate-700/50 cursor-pointer bg-slate-800/30 hover:bg-slate-800 transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3">
                                            <div className="mt-1 p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                                                <Video size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white">{meeting.title}</h4>
                                                <p className="text-sm text-slate-400">{meeting.time} with {meeting.lead}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tasks Section (Data Driven) */}
                    {(viewMode === 'tasks' || viewMode === 'both') && (
                        <div className="space-y-3 pt-2">
                            <h3 className="text-sm font-medium text-slate-400 sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10 flex items-center">
                                <CheckCircle size={14} className="mr-2 text-blue-400" /> Pending Tasks
                            </h3>
                            {filteredTasks.length === 0 ? (
                                <p className="text-slate-500 text-sm italic py-4 text-center">No tasks found. Create one!</p>
                            ) : (
                                filteredTasks.map((task) => (
                                    <div key={task.id} className={`p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all flex items-center justify-between group ${task.status === 'COMPLETED' ? 'opacity-50' : ''}`}>
                                        <div className="flex items-center space-x-3 flex-1">
                                            <button
                                                onClick={() => handleToggleComplete(task)}
                                                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${task.status === 'COMPLETED' ? 'bg-blue-600 border-blue-600' : 'border-slate-600 hover:border-blue-500'
                                                    }`}
                                            >
                                                {task.status === 'COMPLETED' && <CheckCircle size={14} className="text-white" />}
                                            </button>
                                            <div onClick={() => openEditModal(task)} className="cursor-pointer flex-1">
                                                <p className={`text-sm font-medium transition-colors ${task.status === 'COMPLETED' ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-white'}`}>
                                                    {task.title}
                                                </p>
                                                <p className="text-xs text-slate-500 flex items-center mt-0.5">
                                                    <span className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px] mr-2">{task.type}</span>
                                                    {task.lead && <span>{task.lead}</span>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs font-mono text-slate-500">{task.due_date ? format(new Date(task.due_date), 'MMM d') : '-'}</span>
                                            <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel (Meeting Prep - Static for now) */}
            <div className="w-96 bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col h-full overflow-y-auto">
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                        <CalendarIcon size={32} className="text-slate-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-white">Select a Meeting</h3>
                        <p className="text-sm text-slate-500 max-w-[200px] mx-auto mt-1">View prep details and AI talking points.</p>
                    </div>
                </div>
            </div>

            {/* Create/Edit Task Modal */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-[400px] shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">{editingTask ? 'Edit Task' : 'New Task'}</h3>
                            <button onClick={() => setShowTaskModal(false)}><X className="text-slate-400 hover:text-white" /></button>
                        </div>
                        <form onSubmit={handleCreateTask} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={newTask.title}
                                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
                                    placeholder="e.g. Call Client X"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                    <select
                                        value={newTask.type}
                                        onChange={e => setNewTask({ ...newTask, type: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                    >
                                        <option value="TASK">Task</option>
                                        <option value="CALL">Call</option>
                                        <option value="EMAIL">Email</option>
                                        <option value="LINKEDIN">LinkedIn</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        value={newTask.due_date}
                                        onChange={e => setNewTask({ ...newTask, due_date: e.target.value })}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg">
                                {editingTask ? 'Save Changes' : 'Create Task'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
