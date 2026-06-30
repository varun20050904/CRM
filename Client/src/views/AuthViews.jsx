import React, { useState } from 'react';
import api from '../api';

export default function AuthViews({ onLoginSuccess }) {
    const [isRegister, setIsRegister] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const validateForm = () => {
        if (isRegister && !name.trim()) {
            setError('Name is required');
            return false;
        }
        if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
            setError('Please enter a valid email address');
            return false;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!validateForm()) return;

        setLoading(true);
        try {
            if (isRegister) {
                await api.post('/register', { name, email, password });
                setMessage('Registration successful! Please login.');
                setIsRegister(false);
                setPassword('');
            } else {
                const response = await api.post('/login', { email, password });
                const { token, refreshToken } = response.data;
                localStorage.setItem('token', token);
                localStorage.setItem('refreshToken', refreshToken);
                onLoginSuccess(token, refreshToken);
            }
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white px-4 py-6 sm:px-6 lg:px-8">
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
                <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl"></div>
                <div className="absolute top-12 right-[-4rem] h-80 w-80 rounded-full bg-taupe/15 blur-3xl"></div>
                <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-secondary/15 blur-3xl"></div>
            </div>

            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:grid-cols-[1.1fr_0.9fr]">
                <div className="relative hidden overflow-hidden bg-slate-950 p-10 lg:flex lg:flex-col lg:justify-between">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(92,141,197,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(173,158,144,0.15),transparent_28%)]"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-md shadow-primary/20">
                            CT
                        </div>
                        <div>
                            <p className="text-sm font-bold tracking-[0.2em] text-secondary uppercase">Client Tracker</p>
                            <p className="text-xs text-slate-400">Sharper workflows. Cleaner client management.</p>
                        </div>
                    </div>

                    <div className="relative z-10 max-w-lg space-y-6">
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-secondary">
                            CRM, reminders, and meetings in one place
                        </span>
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
                                A calmer way to run client operations.
                            </h2>
                            <p className="text-base leading-7 text-slate-300">
                                Keep companies, meetings, reminders, and email workflows in one polished workspace that feels responsive on every screen.
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 grid grid-cols-3 gap-3 text-xs text-slate-300">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="font-bold text-white">Fast</p>
                            <p className="mt-1 text-slate-400">Lightweight flow</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="font-bold text-white">Responsive</p>
                            <p className="mt-1 text-slate-400">Desktop to mobile</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="font-bold text-white">Modern</p>
                            <p className="mt-1 text-slate-400">Distinct visual system</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
                    <div className="w-full max-w-md space-y-8 rounded-[1.75rem] border border-slate-200 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/60">
                        <div>
                            <div className="flex justify-center">
                                <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-xl shadow-md shadow-primary/20">
                                    CT
                                </div>
                            </div>
                            <h2 className="mt-6 text-center text-3xl font-black text-slate-950 tracking-tight">
                                {isRegister ? 'Create your account' : 'Sign in to Client Tracker'}
                            </h2>
                            <p className="mt-2 text-center text-sm text-slate-500">
                                {isRegister ? 'Already have access? ' : 'Need an account? '}
                                <button
                                    onClick={() => {
                                        setIsRegister(!isRegister);
                                        setError('');
                                        setMessage('');
                                    }}
                                    className="font-semibold text-primary hover:text-primary-hover transition-colors"
                                >
                                    {isRegister ? 'sign in here' : 'register here'}
                                </button>
                            </p>
                        </div>

                        {error && (
                            <div className="rounded-xl bg-rose-50 p-4 border border-rose-200 text-sm text-rose-700 animate-pulse">
                                <div className="flex">
                                    <span className="font-semibold mr-1">Error:</span>
                                    {error}
                                </div>
                            </div>
                        )}

                        {message && (
                            <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-sm text-emerald-700">
                                <div className="flex">
                                    {message}
                                </div>
                            </div>
                        )}

                        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                            <div className="rounded-2xl space-y-4">
                                {isRegister && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="appearance-none relative block w-full px-4 py-3 border border-slate-200 bg-slate-50/70 text-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary sm:text-sm transition-all"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="appearance-none relative block w-full px-4 py-3 border border-slate-200 bg-slate-50/70 text-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary sm:text-sm transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Password</label>
                                    <input
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none relative block w-full px-4 py-3 border border-slate-200 bg-slate-50/70 text-slate-900 rounded-xl focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary sm:text-sm transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-primary/15 cursor-pointer"
                                >
                                    {loading ? (
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : null}
                                    {isRegister ? 'Register' : 'Sign in'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
