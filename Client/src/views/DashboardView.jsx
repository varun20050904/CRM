import React, { useEffect, useState } from 'react';
import api from '../api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export default function DashboardView() {
    const [stats, setStats] = useState({
        totalCompanies: 0,
        totalMeetings: 0,
        totalReminders: 0,
        pendingReminders: 0,
    });
    const [recentMeetings, setRecentMeetings] = useState([]);
    const [recentCompanies, setRecentCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [chartData, setChartData] = useState({
        meetingsPerMonth: [],
        companiesByStage: []
    });

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                setLoading(true);
                setError('');
                const [companiesRes, meetingsRes, remindersRes] = await Promise.all([
                    api.get('/companies'),
                    api.get('/meetings'),
                    api.get('/reminders')
                ]);

                const companies = companiesRes.data || [];
                const meetings = meetingsRes.data || [];
                const reminders = remindersRes.data || [];

                setStats({
                    totalCompanies: companies.length,
                    totalMeetings: meetings.length,
                    totalReminders: reminders.length,
                    pendingReminders: reminders.filter(r => !r.sent).length,
                });

                // Grab recent items
                setRecentMeetings(meetings.slice(0, 5));
                setRecentCompanies(companies.slice(0, 5));

                // Process chart data
                const stageCounts = {};
                companies.forEach(c => {
                    stageCounts[c.stage || 'Lead'] = (stageCounts[c.stage || 'Lead'] || 0) + 1;
                });
                const companiesByStage = Object.keys(stageCounts).map(key => ({
                    name: key,
                    value: stageCounts[key]
                }));

                const monthCounts = {};
                meetings.forEach(m => {
                    const date = new Date(m.meeting_date);
                    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
                    monthCounts[month] = (monthCounts[month] || 0) + 1;
                });
                const meetingsPerMonth = Object.keys(monthCounts).map(key => ({
                    name: key,
                    meetings: monthCounts[key]
                }));

                setChartData({
                    meetingsPerMonth,
                    companiesByStage
                });
            } catch (err) {
                console.error("Dashboard error:", err);
                setError('Failed to fetch dashboard data. Please try again later.');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="space-y-8 animate-pulse">
                {/* Header Skeleton */}
                <div className="space-y-2">
                    <div className="h-8 bg-slate-200 rounded-lg w-1/4"></div>
                    <div className="h-4 bg-slate-200 rounded-lg w-1/3"></div>
                </div>

                {/* Metrics Cards Skeleton */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-2xl flex items-center space-x-4 shadow-xs">
                            <div className="h-12 w-12 bg-slate-200 rounded-xl"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-slate-200 rounded-sm w-2/3"></div>
                                <div className="h-6 bg-slate-200 rounded-md w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Charts Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {[1, 2].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-2xl h-80 flex flex-col justify-between">
                            <div className="h-5 bg-slate-200 rounded-md w-1/3 mb-4"></div>
                            <div className="flex-1 bg-slate-100 rounded-xl"></div>
                        </div>
                    ))}
                </div>

                {/* Lists Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {[1, 2].map(i => (
                        <div key={i} className="glass-panel p-6 rounded-2xl space-y-4">
                            <div className="h-5 bg-slate-200 rounded-md w-1/3"></div>
                            <div className="space-y-3">
                                {[1, 2, 3].map(j => (
                                    <div key={j} className="flex justify-between items-center py-2 border-b border-slate-100">
                                        <div className="space-y-2 flex-1">
                                            <div className="h-4 bg-slate-200 rounded-md w-1/2"></div>
                                            <div className="h-3 bg-slate-200 rounded-sm w-1/3"></div>
                                        </div>
                                        <div className="h-4 bg-slate-200 rounded-md w-12"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md text-red-700 text-sm">
                {error}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Dashboard Overview</h1>
                <p className="text-sm text-slate-500 mt-1">Real-time health check of your sales funnel and relationship records.</p>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Companies Card */}
                <div className="glass-panel premium-card p-6 rounded-2xl flex items-center space-x-4 shadow-xs">
                    <div className="p-3.5 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Total Companies</p>
                        <p className="text-3xl font-black text-slate-900 mt-0.5">{stats.totalCompanies}</p>
                    </div>
                </div>

                {/* Meetings Card */}
                <div className="glass-panel premium-card p-6 rounded-2xl flex items-center space-x-4 shadow-xs">
                    <div className="p-3.5 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-md shadow-emerald-500/20">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Total Meetings</p>
                        <p className="text-3xl font-black text-slate-900 mt-0.5">{stats.totalMeetings}</p>
                    </div>
                </div>

                {/* Reminders Card */}
                <div className="glass-panel premium-card p-6 rounded-2xl flex items-center space-x-4 shadow-xs">
                    <div className="p-3.5 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-xl shadow-md shadow-amber-500/20">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Scheduled Reminders</p>
                        <p className="text-3xl font-black text-slate-900 mt-0.5">{stats.totalReminders}</p>
                    </div>
                </div>

                {/* Pending Reminders Card */}
                <div className="glass-panel premium-card p-6 rounded-2xl flex items-center space-x-4 shadow-xs">
                    <div className="p-3.5 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-xl shadow-md shadow-rose-500/20">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Pending Alerts</p>
                        <p className="text-3xl font-black text-slate-900 mt-0.5">{stats.pendingReminders}</p>
                    </div>
                </div>
            </div>

            {/* Analytics Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Meetings Bar Chart */}
                <div className="glass-panel p-6 rounded-2xl shadow-xs h-80 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Meetings Over Time</h3>
                    {chartData.meetingsPerMonth.length === 0 ? (
                        <p className="text-sm text-slate-500 italic flex-1 flex items-center justify-center">No meeting data available.</p>
                    ) : (
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.meetingsPerMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Bar dataKey="meetings" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Companies Pie Chart */}
                <div className="glass-panel p-6 rounded-2xl shadow-xs h-80 flex flex-col">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">Companies by Stage</h3>
                    {chartData.companiesByStage.length === 0 ? (
                        <p className="text-sm text-slate-500 italic flex-1 flex items-center justify-center">No company data available.</p>
                    ) : (
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData.companiesByStage}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {chartData.companiesByStage.map((entry, index) => {
                                            const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
                                            return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />;
                                        })}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* Content Lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Companies */}
                <div className="glass-panel p-6 rounded-2xl shadow-xs space-y-5">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900">Recent Companies</h3>
                        <span className="text-xs font-semibold text-indigo-650 bg-indigo-50 px-2.5 py-1 rounded-md">Updates</span>
                    </div>
                    {recentCompanies.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No companies added yet.</p>
                    ) : (
                        <div className="divide-y divide-slate-100/70">
                            {recentCompanies.map(company => (
                                <div key={company.id} className="py-3 flex justify-between items-center hover:bg-slate-50/50 px-3 -mx-3 rounded-xl transition-colors">
                                    <div>
                                        <p className="font-semibold text-slate-900 text-sm">{company.company_name}</p>
                                        <p className="text-xs text-slate-550 mt-0.5">{company.contact_person || 'No contact person'}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full shadow-xs ${
                                        company.stage === 'Closed Won' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/50' :
                                        company.stage === 'Closed Lost' ? 'bg-rose-50 text-rose-700 border border-rose-100/50' :
                                        company.stage === 'Proposal Sent' ? 'bg-sky-50 text-sky-700 border border-sky-100/50' :
                                        company.stage === 'Meeting Scheduled' ? 'bg-amber-50 text-amber-700 border border-amber-100/50' :
                                        company.stage === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/50' :
                                        'bg-slate-50 text-slate-700 border border-slate-150'
                                    }`}>
                                        {company.stage}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Meetings */}
                <div className="glass-panel p-6 rounded-2xl shadow-xs space-y-5">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-900">Upcoming / Recent Meetings</h3>
                        <span className="text-xs font-semibold text-emerald-650 bg-emerald-50 px-2.5 py-1 rounded-md">Logs</span>
                    </div>
                    {recentMeetings.length === 0 ? (
                        <p className="text-sm text-slate-500 italic">No meetings logged yet.</p>
                    ) : (
                        <div className="divide-y divide-slate-100/70">
                            {recentMeetings.map(meeting => (
                                <div key={meeting.id} className="py-3.5 flex justify-between items-start hover:bg-slate-50/50 px-3 -mx-3 rounded-xl transition-colors">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-slate-900 text-sm">{meeting.company_name || 'Unknown Company'}</p>
                                        <p className="text-xs text-slate-500 max-w-xs truncate">
                                            {(() => {
                                                if (!meeting.notes) return 'No notes';
                                                try {
                                                    const parsedNotes = JSON.parse(meeting.notes);
                                                    if (Array.isArray(parsedNotes) && parsedNotes.length > 0) {
                                                        return parsedNotes[parsedNotes.length - 1];
                                                    }
                                                } catch (e) {
                                                    return meeting.notes;
                                                }
                                                return 'No notes';
                                            })()}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-semibold text-slate-700">
                                            {new Date(meeting.meeting_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        <p className="text-[10px] text-slate-450 mt-0.5">
                                            {new Date(meeting.meeting_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
