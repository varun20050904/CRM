import React, { useState, useEffect } from 'react';
import api from './api';
import AuthViews from './views/AuthViews';
import DashboardView from './views/DashboardView';
import CompaniesView from './views/CompaniesView';
import MeetingsView from './views/MeetingsView';
import RemindersView from './views/RemindersView';
import SettingsView from './views/SettingsView';
import './App.css';

function App() {
    const [token, setToken] = useState(localStorage.getItem('token') || '');
    const [user, setUser] = useState(null);
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [fetchingProfile, setFetchingProfile] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Fetch user profile on load or token change
    useEffect(() => {
        if (token) {
            fetchUserProfile();
        } else {
            setUser(null);
        }
    }, [token]);

    // Handle token expired events from api.js interceptors
    useEffect(() => {
        const handleAuthExpired = () => {
            handleLogout();
        };

        window.addEventListener('auth-expired', handleAuthExpired);
        return () => {
            window.removeEventListener('auth-expired', handleAuthExpired);
        };
    }, []);

    const fetchUserProfile = async () => {
        setFetchingProfile(true);
        try {
            const res = await api.get('/me');
            setUser(res.data);
        } catch (err) {
            console.error("Failed to fetch user profile:", err);
            // If fetching profile fails due to auth, logout
            if (err.response?.status === 401 || err.response?.status === 403) {
                handleLogout();
            }
        } finally {
            setFetchingProfile(false);
        }
    };

    const handleLoginSuccess = (newToken) => {
        setToken(newToken);
        setCurrentPage('dashboard');
    };

    const handleLogout = async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
            try {
                // Inform backend to revoke the refresh token
                await api.post('/logout', { refreshToken });
            } catch (err) {
                console.error("Logout error on backend:", err);
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken('');
        setUser(null);
        setCurrentPage('dashboard'); // resets page state
    };

    // Main layout renderer based on current view page state
    const renderContent = () => {
        switch (currentPage) {
            case 'dashboard': return <DashboardView />;
            case 'companies': return <CompaniesView />;
            case 'meetings': return <MeetingsView />;
            case 'reminders': return <RemindersView />;
            case 'settings': return <SettingsView />;
            default: return <DashboardView />;
        }
    };

    if (!token) {
        return <AuthViews onLoginSuccess={handleLoginSuccess} />;
    }

    if (fetchingProfile && !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-24 -left-28 h-72 w-72 rounded-full bg-primary/20 blur-3xl"></div>
                <div className="absolute top-16 -right-16 h-80 w-80 rounded-full bg-secondary/18 blur-3xl"></div>
                <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-olive/14 blur-3xl"></div>
                <div className="absolute bottom-20 right-1/4 h-64 w-64 rounded-full bg-taupe/12 blur-3xl"></div>
            </div>

            {/* Sidebar Desktop - fixed, never scrolls */}
            <aside className="hidden md:flex flex-col fixed top-0 left-0 h-screen w-60 bg-slate-950/96 backdrop-blur-xl text-slate-300 border-r border-white/10 z-30 shadow-2xl shadow-slate-950/30 ring-1 ring-white/5">
                <div className="h-20 flex items-center px-6 border-b border-white/10 gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-primary/25">
                        CT
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-white text-sm tracking-wide">Client Tracker</span>
                        <span className="text-[10px] text-secondary font-semibold tracking-wider uppercase">Relationship Hub</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-6 space-y-1.5">
                    <button
                        onClick={() => setCurrentPage('dashboard')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                            currentPage === 'dashboard'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                        }`}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        Dashboard
                    </button>

                    <button
                        onClick={() => setCurrentPage('companies')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                            currentPage === 'companies'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                        }`}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Companies
                    </button>

                    <button
                        onClick={() => setCurrentPage('meetings')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                            currentPage === 'meetings'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                        }`}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Meetings
                    </button>

                    <button
                        onClick={() => setCurrentPage('reminders')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                            currentPage === 'reminders'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                        }`}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Reminders
                    </button>

                    <button
                        onClick={() => setCurrentPage('settings')}
                        className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                            currentPage === 'settings'
                                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                                : 'text-slate-400 hover:bg-white/6 hover:text-slate-100'
                        }`}
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </button>
                </nav>

                {/* Profile panel bottom */}
                {user && (
                    <div className="p-4 border-t border-slate-800 flex items-center gap-3 bg-slate-950/80">
                        <div className="h-10 w-10 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-black shadow-inner">
                            {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{user.name || 'User Profile'}</p>
                            <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            title="Sign out"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                )}
            </aside>

            {/* Right side: mobile topbar + main content, offset by sidebar width on desktop */}
            <div className="flex flex-col min-h-screen md:ml-60">
                <header className="md:hidden h-16 bg-slate-950/95 backdrop-blur-xl text-white flex items-center justify-between px-4 sm:px-6 border-b border-white/10 shrink-0 z-20 shadow-lg shadow-slate-950/25">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-primary/25">
                            CT
                        </div>
                        <span className="font-bold text-white text-sm tracking-wide">Client Tracker</span>
                    </div>
                    <button
                        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                    >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                        </svg>
                    </button>
                </header>

                {/* Mobile Sidebar overlay */}
                {mobileSidebarOpen && (
                    <div className="md:hidden fixed inset-0 z-10 flex">
                        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" onClick={() => setMobileSidebarOpen(false)}></div>
                        <aside className="relative flex flex-col w-72 max-w-[86vw] bg-slate-950 text-slate-300 h-full animate-slideRight shadow-2xl shadow-slate-950/40 ring-1 ring-white/5">
                            <div className="h-16 flex items-center px-6 border-b border-white/10 gap-3">
                                <div className="h-8 w-8 rounded-xl bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-sm">
                                    CT
                                </div>
                                <span className="font-bold text-white text-sm tracking-wide">Client Tracker</span>
                            </div>

                            <nav className="flex-1 px-4 py-6 space-y-1.5">
                                <button
                                    onClick={() => { setCurrentPage('dashboard'); setMobileSidebarOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                                        currentPage === 'dashboard' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                                    }`}
                                >
                                    Dashboard
                                </button>
                                <button
                                    onClick={() => { setCurrentPage('companies'); setMobileSidebarOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                                        currentPage === 'companies' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                                    }`}
                                >
                                    Companies
                                </button>
                                <button
                                    onClick={() => { setCurrentPage('meetings'); setMobileSidebarOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                                        currentPage === 'meetings' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                                    }`}
                                >
                                    Meetings
                                </button>
                                <button
                                    onClick={() => { setCurrentPage('reminders'); setMobileSidebarOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                                        currentPage === 'reminders' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                                    }`}
                                >
                                    Reminders
                                </button>
                                <button
                                    onClick={() => { setCurrentPage('settings'); setMobileSidebarOpen(false); }}
                                    className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 gap-3 cursor-pointer ${
                                        currentPage === 'settings' ? 'bg-primary text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                                    }`}
                                >
                                    Settings
                                </button>
                            </nav>

                            {user && (
                                <div className="p-4 border-t border-white/10 flex items-center gap-3 bg-slate-950/80">
                                    <div className="h-10 w-10 rounded-full bg-linear-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-black">
                                        {user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                                        <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
                                    >
                                        <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </aside>
                    </div>
                )}

                {/* Main Content Area */}
                <main className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6 md:px-8 lg:px-10 lg:py-8 pb-10">
                    <div className="page-shell w-full">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default App;
