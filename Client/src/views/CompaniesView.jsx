import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

const STAGES = ["Lead", "Meeting Scheduled", "Proposal Sent", "In Progress", "Closed Won", "Closed Lost"];

export default function CompaniesView() {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Search and Filters
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('All');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Form inputs
    const [formData, setFormData] = useState({
        company_name: '',
        contact_person: '',
        email: '',
        phone: '',
        stage: 'Lead'
    });
    const [formError, setFormError] = useState('');
    const [formSaving, setFormSaving] = useState(false);

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await api.get('/companies');
            setCompanies(res.data || []);
        } catch (err) {
            console.error("Fetch companies error:", err);
            setError('Failed to load companies. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleStageChange = async (companyId, newStage) => {
        try {
            // Optimistic update
            setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, stage: newStage } : c));
            await api.patch(`/companies/${companyId}/stage`, { stage: newStage });
            showSuccess('Stage updated successfully.');
        } catch (err) {
            console.error("Stage update error:", err);
            showError('Failed to update stage: ' + (err.response?.data?.error || err.message));
            // Rollback
            fetchCompanies();
        }
    };

    const showSuccess = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const showError = (msg) => {
        setError(msg);
        setTimeout(() => setError(''), 5000);
    };

    const validateForm = () => {
        if (!formData.company_name.trim()) return 'Company Name is required.';
        if (!formData.email.trim()) return 'Email is required.';
        if (!/\S+@\S+\.\S+/.test(formData.email)) return 'Email format is invalid.';
        if (formData.phone && !/^\+?[0-9\s\-()]{7,20}$/.test(formData.phone)) {
            return 'Phone format is invalid (7-20 digits/symbols required).';
        }
        return null;
    };

    const openAddModal = () => {
        setFormData({
            company_name: '',
            contact_person: '',
            email: '',
            phone: '',
            stage: 'Lead'
        });
        setFormError('');
        setShowAddModal(true);
    };

    const openEditModal = (company) => {
        setSelectedCompany(company);
        setFormData({
            company_name: company.company_name || '',
            contact_person: company.contact_person || '',
            email: company.email || '',
            phone: company.phone || '',
            stage: company.stage || 'Lead'
        });
        setFormError('');
        setShowEditModal(true);
    };

    const openViewModal = (company) => {
        setSelectedCompany(company);
        setShowViewModal(true);
    };

    const handleSaveCompany = async (e) => {
        e.preventDefault();
        const validationErr = validateForm();
        if (validationErr) {
            setFormError(validationErr);
            return;
        }

        setFormSaving(true);
        setFormError('');
        try {
            if (showAddModal) {
                await api.post('/companies', formData);
                showSuccess('Company added successfully.');
                setShowAddModal(false);
            } else if (showEditModal && selectedCompany) {
                await api.put(`/companies/${selectedCompany.id}`, formData);
                showSuccess('Company updated successfully.');
                setShowEditModal(false);
            }
            fetchCompanies();
        } catch (err) {
            console.error("Save company error:", err);
            setFormError(err.response?.data?.error || 'Failed to save company details.');
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteCompany = async (id) => {
        if (!window.confirm('Are you sure you want to delete this company? This will delete all linked meetings and reminders.')) return;
        try {
            await api.delete(`/companies/${id}`);
            showSuccess('Company deleted successfully.');
            fetchCompanies();
        } catch (err) {
            console.error("Delete company error:", err);
            showError('Failed to delete company: ' + (err.response?.data?.error || err.message));
        }
    };

    // Filtered list
    const filteredCompanies = companies.filter(c => {
        const matchesSearch = c.company_name.toLowerCase().includes(search.toLowerCase()) ||
            (c.contact_person && c.contact_person.toLowerCase().includes(search.toLowerCase())) ||
            c.email.toLowerCase().includes(search.toLowerCase());
        const matchesStage = stageFilter === 'All' || c.stage === stageFilter;
        return matchesSearch && matchesStage;
    });

    const getStageColor = (stage) => {
        switch (stage) {
            case 'Closed Won': return 'bg-emerald-100 text-emerald-800';
            case 'Closed Lost': return 'bg-rose-100 text-rose-800';
            case 'Proposal Sent': return 'bg-sky-100 text-sky-800';
            case 'Meeting Scheduled': return 'bg-amber-100 text-amber-800';
            case 'In Progress': return 'bg-indigo-100 text-indigo-800';
            default: return 'bg-slate-100 text-slate-800';
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Companies Directory</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage client organizations and track their respective lead status stages.</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="inline-flex items-center px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold rounded-xl hover:shadow-md hover:shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                    <svg className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Company
                </button>
            </div>

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

            {/* Filters Bar */}
            <div className="glass-panel p-4 rounded-2xl shadow-xs flex flex-col md:flex-row gap-4 justify-between border border-slate-100/70">
                <div className="flex-1 relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search by company name, contact or email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10 block w-full px-3.5 py-2.5 border border-slate-200/80 rounded-xl text-sm placeholder-slate-455 focus:outline-hidden focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white/60 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500">Stage:</span>
                    <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="block px-3.5 py-2.5 border border-slate-200/80 rounded-xl text-sm bg-white/80 focus:outline-hidden focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all cursor-pointer font-medium"
                    >
                        <option value="All">All Stages</option>
                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Companies Grid / Table */}
            {loading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>
            ) : filteredCompanies.length === 0 ? (
                <div className="glass-panel rounded-2xl shadow-xs py-16 text-center border border-slate-100">
                    <svg className="mx-auto h-12 w-12 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">No companies found</h3>
                    <p className="mt-2 text-xs text-slate-500">Get started by creating a new client organization record.</p>
                </div>
            ) : (
                <div className="glass-panel rounded-2xl shadow-xs overflow-hidden border border-slate-100/70">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100/85 text-left">
                            <thead className="bg-slate-50/70">
                                <tr>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Company Details</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Contact Person</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Email & Phone</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Pipeline Stage</th>
                                    <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-450">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/70 text-slate-700 text-sm">
                                {filteredCompanies.map(company => (
                                    <tr key={company.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">
                                            {company.company_name}
                                        </td>
                                        <td className="px-6 py-4">
                                            {company.contact_person || <span className="text-slate-400 italic font-medium">None</span>}
                                        </td>
                                        <td className="px-6 py-4 space-y-0.5">
                                            <div className="text-xs font-medium text-slate-550">{company.email}</div>
                                            {company.phone && <div className="text-xs text-slate-400">{company.phone}</div>}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={company.stage}
                                                    onChange={(e) => handleStageChange(company.id, e.target.value)}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-full border border-transparent focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer transition-all shadow-xs ${getStageColor(company.stage)}`}
                                                >
                                                    {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === company.id ? null : company.id); }}
                                                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                                                </svg>
                                            </button>
                                            
                                            {activeDropdown === company.id && (
                                                <div className="absolute right-8 top-10 w-40 bg-white border border-slate-200 shadow-lg rounded-xl z-10 py-1 overflow-hidden animate-fadeIn">
                                                    <button
                                                        onClick={() => { openViewModal(company); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                                                    >
                                                        View Details
                                                    </button>
                                                    <button
                                                        onClick={() => { openEditModal(company); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                    <div className="border-t border-slate-100 my-1"></div>
                                                    <button
                                                        onClick={() => { handleDeleteCompany(company.id); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modals for Add & Edit */}
            {(showAddModal || showEditModal) && createPortal(
                <div className="fixed inset-0 matte-modal-overlay overflow-y-auto flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn">
                    <div className="matte-glass-modal rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col relative overflow-hidden transform transition-all">
                        {/* Decorative background blob */}
                        <div className="absolute top-0 left-0 w-full h-48 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent z-0 pointer-events-none"></div>

                        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/50 flex justify-between items-center relative z-10">
                            <div>
                                <h3 className="font-extrabold text-xl tracking-tight text-slate-900 font-['Outfit']">
                                    {showAddModal ? 'Add New Company' : 'Edit Company'}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    {showAddModal ? 'Enter the details of the new client organization.' : 'Update the organization details.'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2.5 rounded-full transition-all cursor-pointer bg-white/50 border border-transparent hover:border-rose-100 shadow-sm"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto relative z-10 custom-scrollbar">
                            <form onSubmit={handleSaveCompany} className="p-6 sm:p-8 space-y-5">
                                {formError && (
                                    <div className="text-sm text-rose-700 bg-rose-50/80 backdrop-blur-sm border border-rose-200 p-4 rounded-xl shadow-sm flex items-start gap-3">
                                        <svg className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="font-medium">{formError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Company Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.company_name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                        placeholder="e.g. Acme Corp"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Contact Person</label>
                                    <input
                                        type="text"
                                        value={formData.contact_person}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                        placeholder="e.g. Sarah Jenkins"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Email Address *</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                            placeholder="contact@acme.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Phone Number</label>
                                        <input
                                            type="text"
                                            value={formData.phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                            className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                            placeholder="+1 555-0199"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Pipeline Stage</label>
                                    <select
                                        value={formData.stage}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stage: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all cursor-pointer font-semibold shadow-sm appearance-none"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                                    >
                                        {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>

                                <div className="pt-6 mt-4 border-t border-slate-200/50 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
                                    <button
                                        type="button"
                                        onClick={() => { setShowAddModal(false); setShowEditModal(false); }}
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
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                </svg>
                                                {showAddModal ? 'Create Company' : 'Save Changes'}
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

            {/* View Details Modal */}
            {showViewModal && selectedCompany && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 overflow-y-auto flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn">
                    <div className="glass-panel bg-white/80 rounded-3xl shadow-2xl border border-white/60 max-w-md w-full flex flex-col relative overflow-hidden transform transition-all">
                        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/50 flex justify-between items-center">
                            <h3 className="font-extrabold text-xl text-slate-900">Company Details</h3>
                            <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 space-y-4 text-sm">
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Company Name</p>
                                <p className="font-semibold text-slate-900">{selectedCompany.company_name}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Contact Person</p>
                                <p className="font-semibold text-slate-900">{selectedCompany.contact_person || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Email</p>
                                <p className="font-semibold text-slate-900">{selectedCompany.email}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Phone</p>
                                <p className="font-semibold text-slate-900">{selectedCompany.phone || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pipeline Stage</p>
                                <span className={`inline-block px-3 py-1 mt-1 text-xs font-bold rounded-full shadow-xs ${getStageColor(selectedCompany.stage)}`}>
                                    {selectedCompany.stage}
                                </span>
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-slate-200/50 bg-slate-50 flex justify-end">
                            <button onClick={() => setShowViewModal(false)} className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 shadow-sm transition-all">Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
