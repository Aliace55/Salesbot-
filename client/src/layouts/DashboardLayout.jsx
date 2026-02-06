import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
    Users, Mail, BarChart3, Zap, Settings, MessageSquare, ChevronRight,
    Sparkles, CheckSquare, UserCircle, Building, Menu, X, Moon, Sun,
    Bell, Search, HelpCircle, LogOut, ChevronDown, Activity, Target,
    Clock, Calendar, Cpu
} from 'lucide-react';
import { AIStatusIndicator } from '../components/AIStatusIndicator';

export default function DashboardLayout() {
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [time, setTime] = useState(new Date());

    const [notifications, setNotifications] = useState([]);
    const notificationRef = useRef(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 60000);
        fetchNotifications(); // Initial fetch
        return () => clearInterval(timer);
    }, []);

    // Close notifications on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [notificationRef]);

    const fetchNotifications = async () => {
        try {
            const res = await axios.get('/api/brain/feed');
            setNotifications(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const navSections = [
        {
            title: 'Sales',
            items: [
                { path: '/', label: 'Pipeline', icon: Target, badge: null, description: 'Active deals & leads' },
                { path: '/agenda', label: 'Agenda', icon: Calendar, badge: null, description: 'Meetings & Prep' },
                { path: '/companies', label: 'Companies', icon: Building, badge: 'NEW', description: 'Account hierarchy' },
                { path: '/contacts', label: 'Contacts', icon: UserCircle, badge: null, description: 'Individual leads' },
            ]
        },
        {
            title: 'Engagement',
            items: [
                { path: '/campaigns', label: 'Campaigns', icon: Zap, badge: 'AI', description: 'Automated outreach' },
                { path: '/tasks', label: 'Tasks', icon: CheckSquare, badge: null, description: 'To-dos & follow-ups' },
                { path: '/inbox', label: 'Inbox', icon: MessageSquare, badge: null, description: 'All conversations' },
            ]
        },
        {
            title: 'Intelligence',
            items: [
                { path: '/brain', label: 'Command Center', icon: Cpu, badge: 'LIVE', description: 'AI Operating System' },
                { path: '/analytics', label: 'Reports', icon: BarChart3, badge: null, description: 'Performance metrics' },
            ]
        }
    ];

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex h-screen bg-[#0c1222]">
            {/* Sidebar */}
            <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-gradient-to-b from-[#111827] to-[#0f172a] border-r border-slate-700/50 flex flex-col transition-all duration-300`}>
                {/* Logo */}
                <div className="px-4 py-4 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center space-x-2.5">
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Sparkles size={18} className="text-white" />
                            </div>
                            {!collapsed && (
                                <div>
                                    <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                        SalesBot
                                    </span>
                                    <p className="text-[9px] text-slate-600 -mt-0.5">Enterprise</p>
                                </div>
                            )}
                        </Link>
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
                        </button>
                    </div>
                </div>

                {/* Quick Stats (when expanded) */}
                {!collapsed && (
                    <div className="px-4 py-3 border-b border-slate-700/50">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5 text-slate-500">
                                <Clock size={12} />
                                <span>{formatTime(time)}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-slate-600">
                                <Calendar size={12} />
                                <span>{formatDate(time)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="flex-1 px-2 py-3 overflow-y-auto">
                    {navSections.map((section, sIdx) => (
                        <div key={section.title} className={sIdx > 0 ? 'mt-4' : ''}>
                            {!collapsed && (
                                <h3 className="px-3 mb-2 text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
                                    {section.title}
                                </h3>
                            )}
                            <div className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = location.pathname === item.path;
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            title={collapsed ? item.label : undefined}
                                            className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150
                                                ${isActive
                                                    ? 'bg-gradient-to-r from-blue-600/20 to-cyan-600/10 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/5'
                                                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
                                                }`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className={`${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'} transition-colors`}>
                                                    <Icon size={18} />
                                                </span>
                                                {!collapsed && (
                                                    <div>
                                                        <span className="text-sm font-medium block">{item.label}</span>
                                                        {isActive && (
                                                            <span className="text-[10px] text-slate-600">{item.description}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {!collapsed && (
                                                <div className="flex items-center space-x-2">
                                                    {item.badge && (
                                                        <span className={`px-1.5 py-0.5 text-[9px] font-bold text-white rounded-md ${item.badge === 'NEW'
                                                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-sm shadow-green-500/30'
                                                            : 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-sm shadow-purple-500/30'
                                                            }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}
                                                    {isActive && <ChevronRight size={14} className="text-blue-400" />}
                                                </div>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="border-t border-slate-700/50">
                    {/* Settings Link */}
                    <div className="px-2 py-3">
                        <Link
                            to="/settings"
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all
                                ${location.pathname === '/settings'
                                    ? 'bg-gradient-to-r from-slate-800 to-slate-700/50 text-white border border-slate-600/50'
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 border border-transparent'
                                }`}
                        >
                            <div className="flex items-center space-x-3">
                                <Settings size={18} />
                                {!collapsed && <span className="text-sm font-medium">Settings</span>}
                            </div>
                            {!collapsed && location.pathname === '/settings' && (
                                <ChevronRight size={14} className="text-slate-400" />
                            )}
                        </Link>
                    </div>

                    {/* User Profile */}
                    {!collapsed && (
                        <div className="px-3 py-3 border-t border-slate-700/50">
                            <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                                    JL
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white truncate">Jeff Lach</p>
                                    <p className="text-[10px] text-slate-500 truncate">jeff.lach@trackmytruck.us</p>
                                </div>
                                <button className="p-1.5 text-slate-600 hover:text-red-400 rounded transition-colors" title="Sign Out">
                                    <LogOut size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="h-14 bg-[#111827]/80 backdrop-blur-xl border-b border-slate-700/50 flex items-center justify-between px-6">
                    <div className="flex items-center space-x-4">
                        {/* Breadcrumb */}
                        <div className="flex items-center text-sm">
                            <span className="text-slate-600">SalesBot</span>
                            <ChevronRight size={14} className="mx-2 text-slate-700" />
                            <span className="text-white font-medium capitalize">
                                {location.pathname === '/' ? 'Pipeline' : location.pathname.slice(1)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-3">
                        {/* Global Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search everything..."
                                className="w-64 pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                            />
                            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-slate-600 bg-slate-800 rounded">⌘K</kbd>
                        </div>

                        {/* AI Status Indicator */}
                        <AIStatusIndicator />

                        {/* Quick Actions & Notifications */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`p-2 rounded-lg transition-colors relative ${showNotifications ? 'text-white bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                            >
                                <Bell size={18} />
                                {notifications.length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-[#1e293b] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[100]">
                                    <div className="px-4 py-3 border-b border-slate-700/50 flex justify-between items-center bg-[#111827]">
                                        <h3 className="font-semibold text-white text-sm">Notifications</h3>
                                        <span className="text-xs text-slate-500">{notifications.length} New</span>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-6 text-center text-slate-500 text-xs">
                                                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                                                No new notifications
                                            </div>
                                        ) : (
                                            notifications.map((note) => (
                                                <div key={note.id} className="px-4 py-3 border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors">
                                                    <div className="flex items-start justify-between mb-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded
                                                            ${note.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                                                                note.severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' :
                                                                    'bg-blue-500/20 text-blue-400'}`}>
                                                            {note.type.replace(/_/g, ' ')}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-medium text-slate-200 mb-0.5">{note.title}</h4>
                                                    <p className="text-xs text-slate-500 line-clamp-2">{note.description}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="px-4 py-2 bg-[#111827] border-t border-slate-700/50 text-center">
                                        <Link to="/brain" onClick={() => setShowNotifications(false)} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                                            View Command Center →
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto bg-[#0c1222]">
                    <div className="max-w-7xl mx-auto px-6 py-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
