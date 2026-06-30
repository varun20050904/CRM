import React, { useState, useEffect } from 'react';
import api from '../api';

export default function SettingsView() {
    const [formData, setFormData] = useState({
        smtp_email: '',
        smtp_pass: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings');
            if (res.data) {
                setFormData({
                    smtp_email: res.data.smtp_email || '',
                    smtp_pass: res.data.smtp_pass || '' // Normally password isn't sent back, but just in case
                });
            }
        } catch (err) {
            // Ignore 404 if user has no settings yet
            if (err.response?.status !== 404) {
                console.error("Failed to fetch settings:", err);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        setError('');

        try {
            await api.put('/settings', formData);
            setMessage('Settings updated successfully!');
            // Clear password field for security after saving
            setFormData(prev => ({ ...prev, smtp_pass: '' }));
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            </div>
        );
    }

    return (
        <div className="page-shell space-y-8 animate-fadeIn max-w-3xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Account Settings</h1>
                <p className="text-sm text-slate-500 mt-1">Configure your email provider to enable automated meeting reminders.</p>
            </div>

            <div className="glass-panel p-6 sm:p-8 rounded-[1.75rem] shadow-xl border border-white/60">
                <form onSubmit={handleSave} className="space-y-6">
                    {message && (
                        <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium flex items-center gap-3">
                            <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            {message}
                        </div>
                    )}
                    
                    {error && (
                        <div className="p-4 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-sm font-medium flex items-center gap-3">
                            <svg className="h-5 w-5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div className="space-y-5">
                        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200/50 pb-2">SMTP Configuration (Gmail)</h3>
                        
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Gmail Address</label>
                            <input
                                type="email"
                                required
                                value={formData.smtp_email}
                                onChange={(e) => setFormData(prev => ({ ...prev, smtp_email: e.target.value }))}
                                className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all placeholder-slate-400 shadow-sm"
                                placeholder="your.email@gmail.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">App Password</label>
                            <input
                                type="password"
                                required
                                value={formData.smtp_pass}
                                onChange={(e) => setFormData(prev => ({ ...prev, smtp_pass: e.target.value }))}
                                className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all placeholder-slate-400 shadow-sm"
                                placeholder="16-character app password"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                You must use a Google App Password, not your regular Gmail password. <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Generate one here</a>.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200/50 flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-3 text-sm font-bold text-white bg-primary hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25 rounded-xl transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Save Settings
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
