import React, { useState } from 'react';
import {
    Calendar as CalendarIcon, Clock, Video, CheckCircle, XCircle,
    MoreVertical, FileText, User, Linkedin, MessageSquare, Phone,
    ChevronLeft, ChevronRight, Plus, Search, Filter
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';

export default function Agenda() {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('both'); // 'meetings', 'tasks', 'both'
    const [selectedMeeting, setSelectedMeeting] = useState(null);

    // Mock Data
    const tasks = [
        { id: 1, type: 'CALL', title: 'Follow up with Precision Logistics', due: '10:00 AM', status: 'pending', lead: 'Sarah Jenkins' },
        { id: 2, type: 'LINKEDIN', title: 'Connect with CTO of FastTrack', due: '11:30 AM', status: 'completed', lead: 'Mike Ross' },
        { id: 3, type: 'EMAIL', title: 'Send proposal to BlueSky Transport', due: '2:00 PM', status: 'pending', lead: 'Jessica Pearson' },
    ];

    const meetings = [
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
        },
        {
            id: 102,
            title: 'Discovery Call: Global Shipping',
            time: '3:30 PM',
            duration: '30m',
            lead: 'Jan Levinson',
            company: 'Global Shipping inc.',
            source: 'Outbound',
            status: 'confirmed',
            attendees: ['Jan Levinson']
        }
    ];

    // Helpers
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
                    <div className="flex bg-slate-800 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('meetings')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'meetings' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Meetings
                        </button>
                        <button
                            onClick={() => setViewMode('tasks')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'tasks' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Tasks
                        </button>
                        <button
                            onClick={() => setViewMode('both')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'both' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            Both
                        </button>
                    </div>
                </div>

                {/* Calendar Strip */}
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-white">{format(selectedDate, 'MMMM yyyy')}</h2>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => setSelectedDate(addDays(selectedDate, -7))} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-xs font-medium text-white">
                                Today
                            </button>
                            <button onClick={() => setSelectedDate(addDays(selectedDate, 7))} className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
                                <ChevronRight size={18} />
                            </button>
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
                                {/* Dots for events */}
                                <div className="flex space-x-1 mt-1.5 h-1.5">
                                    {(i % 2 === 0 || i === 3) && <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>}
                                    {(i % 3 === 0) && <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Day's Agenda */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {/* Meetings Section */}
                    {(viewMode === 'meetings' || viewMode === 'both') && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-400 sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10 flex items-center">
                                <Video size={14} className="mr-2 text-purple-400" /> Matches & Demos
                            </h3>
                            {meetings.map((meeting) => (
                                <div
                                    key={meeting.id}
                                    onClick={() => setSelectedMeeting(meeting)}
                                    className={`p-4 rounded-xl border border-slate-700/50 cursor-pointer transition-all group ${selectedMeeting?.id === meeting.id
                                            ? 'bg-purple-500/10 border-purple-500/50'
                                            : 'bg-slate-800/30 hover:bg-slate-800 hover:border-slate-600'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start space-x-3">
                                            <div className="mt-1 p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-lg shadow-purple-500/20">
                                                <Video size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-white group-hover:text-purple-300 transition-colors">{meeting.title}</h4>
                                                <div className="flex items-center space-x-3 mt-1 text-sm text-slate-400">
                                                    <span className="flex items-center"><Clock size={12} className="mr-1" /> {meeting.time} ({meeting.duration})</span>
                                                    <span className="flex items-center"><User size={12} className="mr-1" /> {meeting.lead}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                                            {meeting.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Tasks Section */}
                    {(viewMode === 'tasks' || viewMode === 'both') && (
                        <div className="space-y-3 pt-2">
                            <h3 className="text-sm font-medium text-slate-400 sticky top-0 bg-slate-900/95 backdrop-blur py-2 z-10 flex items-center">
                                <CheckCircle size={14} className="mr-2 text-blue-400" /> Pending Tasks
                            </h3>
                            {tasks.map((task) => (
                                <div key={task.id} className="p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:border-slate-600 transition-all flex items-center justify-between group">
                                    <div className="flex items-center space-x-3">
                                        <button className="flex-shrink-0 w-5 h-5 rounded border-2 border-slate-600 hover:border-blue-500 group-hover:scale-105 transition-all"></button>
                                        <div>
                                            <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors strike-through">{task.title}</p>
                                            <p className="text-xs text-slate-500 flex items-center mt-0.5">
                                                {task.type === 'CALL' && <Phone size={10} className="mr-1 text-green-400" />}
                                                {task.type === 'EMAIL' && <FileText size={10} className="mr-1 text-purple-400" />}
                                                {task.type === 'LINKEDIN' && <Linkedin size={10} className="mr-1 text-sky-400" />}
                                                <span className="mr-2">{task.type}</span>
                                                <span className="w-1 h-1 bg-slate-600 rounded-full mr-2"></span>
                                                {task.lead}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-1 rounded">{task.due}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Meeting Prep Panel */}
            <div className="w-96 bg-slate-900 border-l border-slate-700/50 p-6 flex flex-col h-full overflow-y-auto">
                {selectedMeeting ? (
                    <div className="space-y-6 animate-in slide-in-from-right duration-300">
                        {/* Selected Meeting Header */}
                        <div>
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 block">Meeting Prep</span>
                            <h2 className="text-xl font-bold text-white mb-1">{selectedMeeting.title}</h2>
                            <div className="flex items-center space-x-2 text-sm text-slate-400">
                                <Clock size={14} />
                                <span>{selectedMeeting.time} today</span>
                            </div>
                        </div>

                        {/* Attendees */}
                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-white">Attendees</h3>
                                <div className="flex -space-x-2">
                                    {selectedMeeting.attendees.map((attendee, i) => (
                                        <div key={i} className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-bold border-2 border-slate-800">
                                            {attendee.charAt(0)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center space-x-3 p-2 hover:bg-slate-700/30 rounded-lg transition-colors cursor-pointer">
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${selectedMeeting.lead}&background=random`}
                                        alt={selectedMeeting.lead}
                                        className="w-8 h-8 rounded-full"
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-white">{selectedMeeting.lead}</p>
                                        <p className="text-xs text-slate-400">{selectedMeeting.company}</p>
                                    </div>
                                    <Linkedin size={14} className="ml-auto text-sky-400" />
                                </div>
                            </div>
                        </div>

                        {/* Prep Checklist */}
                        <div>
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                                <CheckCircle size={14} className="mr-2 text-green-400" /> Prep Checklist
                            </h3>
                            <div className="space-y-2">
                                {['Review website & recent news', 'Check LinkedIn activity', 'Prepare pricing scenario', 'Test demo environment'].map((item, i) => (
                                    <label key={i} className="flex items-center space-x-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-xl cursor-pointer hover:bg-slate-800/50 transition-colors">
                                        <input type="checkbox" className="w-4 h-4 rounded border-slate-600 text-purple-600 focus:ring-purple-500 bg-slate-700" />
                                        <span className="text-sm text-slate-300">{item}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* AI Talking Points */}
                        <div>
                            <h3 className="text-sm font-semibold text-white mb-3 flex items-center">
                                <div className="mr-2 p-1 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-md">
                                    <FileText size={10} className="text-white" />
                                </div>
                                AI Talking Points
                            </h3>
                            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                                <div className="p-3 bg-slate-700/30 rounded-lg border-l-2 border-purple-500">
                                    <p className="text-xs font-bold text-purple-300 mb-1">Pain Point: High Visibility Costs</p>
                                    <p className="text-sm text-slate-300">Mention our new "Fleet Efficiency" dashboard that cuts reporting time by 40%.</p>
                                </div>
                                <div className="p-3 bg-slate-700/30 rounded-lg border-l-2 border-blue-500">
                                    <p className="text-xs font-bold text-blue-300 mb-1">Company Goal: Scaling</p>
                                    <p className="text-sm text-slate-300">Discuss volume discounts and API integrations for their growing fleet.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
                            <CalendarIcon size={32} className="text-slate-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">No Meeting Selected</h3>
                            <p className="text-sm text-slate-500 max-w-[200px] mx-auto mt-1">Select a meeting from the agenda to view prep details and talking points.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
