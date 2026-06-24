import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

export default function RemindersView() {
    const [reminders, setReminders] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);

    // Form inputs
    const [formData, setFormData] = useState({
        company_id: '',
        reminder_time: '',
        email: ''
    });
    const [formError, setFormError] = useState('');
    const [formSaving, setFormSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');
            const [remindersRes, companiesRes] = await Promise.all([
                api.get('/reminders'),
                api.get('/companies')
            ]);
            setReminders(remindersRes.data || []);
            setCompanies(companiesRes.data || []);
        } catch (err) {
            console.error("Fetch reminders data error:", err);
            setError('Failed to load reminders list.');
        } finally {
            setLoading(false);
        }
    };

    const showSuccess = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    // Auto populate email based on selected company
    const handleCompanyChange = (companyId) => {
        const selectedCo = companies.find(c => c.id === parseInt(companyId, 10));
        setFormData(prev => ({
            ...prev,
            company_id: companyId,
            email: selectedCo ? selectedCo.email : ''
        }));
    };

    const validateForm = () => {
        if (!formData.company_id) return 'Please select a company.';
        if (!formData.reminder_time) return 'Reminder time is required.';
        if (isNaN(Date.parse(formData.reminder_time))) return 'Invalid date and time format.';
        if (!formData.email.trim()) return 'Target email is required.';
        if (!/\S+@\S+\.\S+/.test(formData.email)) return 'Email format is invalid.';
        return null;
    };

    const openAddModal = () => {
        const defaultCo = companies[0];
        setFormData({
            company_id: defaultCo ? defaultCo.id : '',
            reminder_time: '',
            email: defaultCo ? defaultCo.email : ''
        });
        setFormError('');
        setShowAddModal(true);
    };

    const handleSaveReminder = async (e) => {
        e.preventDefault();
        const validationErr = validateForm();
        if (validationErr) {
            setFormError(validationErr);
            return;
        }

        setFormSaving(true);
        setFormError('');
        try {
            const localDate = new Date(formData.reminder_time);
            const payload = {
                ...formData,
                reminder_time: localDate.toISOString()
            };
            await api.post('/reminders', payload);
            showSuccess('Reminder scheduled successfully.');
            setShowAddModal(false);
            fetchData();
        } catch (err) {
            console.error("Save reminder error:", err);
            setFormError(err.response?.data?.error || 'Failed to schedule reminder.');
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteReminder = async (id) => {
        if (!window.confirm('Are you sure you want to delete this reminder alert?')) return;
        try {
            await api.delete(`/reminders/${id}`);
            showSuccess('Reminder alert deleted successfully.');
            fetchData();
        } catch (err) {
            console.error("Delete reminder error:", err);
            setError('Failed to delete reminder alert: ' + (err.response?.data?.error || err.message));
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Email Reminders</h1>
                    <p className="text-sm text-slate-500 mt-1">Configure automated email alert triggers scheduled to fire at specific times.</p>
                </div>
                <button
                    onClick={openAddModal}
                    disabled={companies.length === 0}
                    className="inline-flex items-center px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:shadow-md hover:shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"                >
                    <svg className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Schedule Alert
                </button>
            </div>

            {/* Warn user if no companies exist */}
            {companies.length === 0 && !loading && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl text-amber-805 text-sm shadow-xs">
                    You must add at least one Company before you can schedule a reminder.
                </div>
            )}

            {/* Error and Success Alerts */}
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-red-700 text-sm shadow-xs animate-pulse">
                    {error}
                </div>
            )}
            {successMessage && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-xl text-green-700 text-sm shadow-xs">
                    {successMessage}
                </div>
            )}

            {/* Reminders List */}
            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            ) : reminders.length === 0 ? (
                <div className="glass-panel rounded-2xl shadow-xs py-16 text-center border border-slate-100">
                    <svg className="mx-auto h-12 w-12 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">No reminders scheduled</h3>
                    <p className="mt-2 text-xs text-slate-500">Configure notifications to trigger emails automatically.</p>
                </div>
            ) : (
                <div className="glass-panel rounded-2xl shadow-xs overflow-hidden border border-slate-100/70">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100/85 text-left">
                            <thead className="bg-slate-50/70">
                                <tr>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Company Link</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Scheduled Trigger Time</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Recipient Email</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Delivery Status</th>
                                    <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-455">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/70 text-slate-700 text-sm">
                                {reminders.map(reminder => (
                                    <tr key={reminder.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">
                                            {reminder.company_name || <span className="text-slate-400 italic">Unknown Company</span>}
                                        </td>
                                        <td className="px-6 py-4 space-y-0.5">
                                            <div className="font-semibold text-slate-900 text-xs">
                                                {new Date(reminder.reminder_time).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-medium">
                                                {new Date(reminder.reminder_time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-mono text-slate-655 font-medium">
                                            {reminder.email}
                                        </td>
                                        <td className="px-6 py-4">
                                            {reminder.sent ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-705 border border-green-100 shadow-xs">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5"></span>
                                                    Sent
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-705 border border-amber-100 shadow-xs animate-pulse">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5"></span>
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleDeleteReminder(reminder.id)}
                                                className="inline-flex text-rose-655 hover:text-rose-900 font-semibold cursor-pointer"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals for Add Reminder */}
            {showAddModal && createPortal(
                <div className="fixed inset-0 matte-modal-overlay overflow-y-auto flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn">
                    <div className="matte-glass-modal rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col relative overflow-hidden transform transition-all">
                        {/* Decorative background blob */}
                        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent z-0 pointer-events-none"></div>

                        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/50 flex justify-between items-center relative z-10">
                            <div>
                                <h3 className="font-extrabold text-xl tracking-tight text-slate-900 font-['Outfit']">
                                    Schedule Email Alert
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Configure automated email notifications.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2.5 rounded-full transition-all cursor-pointer bg-white/50 border border-transparent hover:border-rose-100 shadow-sm"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto relative z-10 custom-scrollbar">
                            <form onSubmit={handleSaveReminder} className="p-6 sm:p-8 space-y-5">
                                {formError && (
                                    <div className="text-sm text-rose-700 bg-rose-50/80 backdrop-blur-sm border border-rose-200 p-4 rounded-xl shadow-sm flex items-start gap-3">
                                        <svg className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="font-medium">{formError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Link Company *</label>
                                    <select
                                        value={formData.company_id}
                                        onChange={(e) => handleCompanyChange(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all cursor-pointer font-semibold shadow-sm appearance-none"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                                    >
                                        <option value="" disabled>-- Select Company --</option>
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Alert Destination Email *</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                        placeholder="e.g. alert@company.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Trigger Date & Time *</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.reminder_time}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reminder_time: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all shadow-sm font-sans text-slate-700"
                                    />
                                    <p className="mt-2 text-[11px] text-slate-500 font-medium">The cron job runs every minute to process and trigger pending email alerts.</p>
                                </div>

                                <div className="pt-6 mt-4 border-t border-slate-200/50 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer shadow-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={formSaving}
                                        className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg hover:shadow-indigo-500/25 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        {formSaving ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Scheduling...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Schedule Alert
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
