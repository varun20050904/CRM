import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

export default function MeetingsView() {
    const [meetings, setMeetings] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [sendRescheduleEmail, setSendRescheduleEmail] = useState(true);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Form inputs
    const [formData, setFormData] = useState({
        company_id: '',
        meeting_date: '',
        notes: [], // changed to array for multiple notes
        outcome: '',
        attendees: ''
    });
    const [newNote, setNewNote] = useState('');
    const [formError, setFormError] = useState('');
    const [formSaving, setFormSaving] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError('');
            const [meetingsRes, companiesRes] = await Promise.all([
                api.get('/meetings'),
                api.get('/companies')
            ]);
            setMeetings(meetingsRes.data || []);
            setCompanies(companiesRes.data || []);
        } catch (err) {
            console.error("Fetch meetings data error:", err);
            setError('Failed to load meetings list.');
        } finally {
            setLoading(false);
        }
    };

    const showSuccess = (msg) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const validateForm = () => {
        if (!formData.company_id) return 'Please select a company.';
        if (!formData.meeting_date) return 'Meeting date and time are required.';
        if (isNaN(Date.parse(formData.meeting_date))) return 'Invalid date and time format.';
        return null;
    };

    const openAddModal = () => {
        setFormData({
            company_id: companies[0]?.id || '',
            meeting_date: '',
            notes: [],
            outcome: '',
            attendees: ''
        });
        setNewNote('');
        setFormError('');
        setShowAddModal(true);
    };

    const openEditModal = (meeting) => {
        setSelectedMeeting(meeting);

        // Format ISO date to local string required by datetime-local input (YYYY-MM-DDTHH:MM)
        let formattedDate = '';
        if (meeting.meeting_date) {
            const d = new Date(meeting.meeting_date);
            // offset timezone offset
            const offset = d.getTimezoneOffset() * 60000;
            const localISODate = new Date(d.getTime() - offset).toISOString().slice(0, 16);
            formattedDate = localISODate;
        }

        let parsedNotes = [];
        if (meeting.notes) {
            try {
                parsedNotes = JSON.parse(meeting.notes);
                if (!Array.isArray(parsedNotes)) parsedNotes = [meeting.notes];
            } catch (e) {
                parsedNotes = [meeting.notes];
            }
        }

        setFormData({
            company_id: meeting.company_id || '',
            meeting_date: formattedDate,
            notes: parsedNotes,
            outcome: meeting.outcome || '',
            attendees: meeting.attendees || ''
        });
        setNewNote('');
        setFormError('');
        setShowEditModal(true);
    };

    const openViewModal = (meeting) => {
        setSelectedMeeting(meeting);
        setShowViewModal(true);
    };

    const openRescheduleModal = (meeting) => {
        setSelectedMeeting(meeting);
        
        let formattedDate = '';
        if (meeting.meeting_date) {
            const d = new Date(meeting.meeting_date);
            const offset = d.getTimezoneOffset() * 60000;
            formattedDate = new Date(d.getTime() - offset).toISOString().slice(0, 16);
        }
        setRescheduleDate(formattedDate);
        setSendRescheduleEmail(true); // default to sending email
        setShowRescheduleModal(true);
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!rescheduleDate) {
            setError('Please select a new date and time.');
            return;
        }

        try {
            const localDate = new Date(rescheduleDate);
            // Keep all existing details, just change the date
            const payload = {
                company_id: selectedMeeting.company_id,
                meeting_date: localDate.toISOString(),
                notes: selectedMeeting.notes || '',
                outcome: selectedMeeting.outcome || '',
                attendees: selectedMeeting.attendees || '',
                send_reschedule_email: sendRescheduleEmail
            };
            
            await api.put(`/meetings/${selectedMeeting.id}`, payload);
            showSuccess('Meeting rescheduled successfully.');
            setShowRescheduleModal(false);
            fetchData();
        } catch (err) {
            console.error("Reschedule meeting error:", err);
            setError(err.response?.data?.error || 'Failed to reschedule meeting.');
        }
    };

    const handleSaveMeeting = async (e) => {
        e.preventDefault();
        const validationErr = validateForm();
        if (validationErr) {
            setFormError(validationErr);
            return;
        }

        setFormSaving(true);
        setFormError('');
        try {
            const localDate = new Date(formData.meeting_date);
            const payload = {
                ...formData,
                meeting_date: localDate.toISOString(),
                notes: JSON.stringify(formData.notes) // serialize notes array
            };

            if (showAddModal) {
                await api.post('/meetings', payload);
                showSuccess('Meeting added successfully.');
                setShowAddModal(false);
            } else if (showEditModal && selectedMeeting) {
                await api.put(`/meetings/${selectedMeeting.id}`, payload);
                showSuccess('Meeting updated successfully.');
                setShowEditModal(false);
            }
            fetchData();
        } catch (err) {
            console.error("Save meeting error:", err);
            setFormError(err.response?.data?.error || 'Failed to save meeting details.');
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteMeeting = async (id) => {
        if (!window.confirm('Are you sure you want to delete this meeting entry?')) return;
        try {
            await api.delete(`/meetings/${id}`);
            showSuccess('Meeting entry deleted successfully.');
            fetchData();
        } catch (err) {
            console.error("Delete meeting error:", err);
            setError('Failed to delete meeting entry: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleSummarizeNotes = async () => {
        const allNotesText = [...formData.notes, newNote.trim()].filter(Boolean).join('\n\n');
        
        if (!allNotesText) {
            setFormError("No notes to summarize.");
            return;
        }
        
        setIsSummarizing(true);
        setFormError('');
        
        try {
            const res = await api.post('/ai/summarize', { notes: allNotesText });
            const summaryText = "Summary:\n" + res.data.summary;
            
            setFormData(prev => {
                const currentNotes = [...prev.notes];
                if (newNote.trim()) {
                    currentNotes.push(newNote.trim());
                }
                currentNotes.push(summaryText);
                return { ...prev, notes: currentNotes };
            });
            setNewNote('');
        } catch (err) {
            console.error("Summarize error:", err);
            setFormError('Failed to summarize notes.');
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Meeting Logs</h1>
                    <p className="text-sm text-slate-500 mt-1">Document discussions, outcomes, and schedule future touchpoints with clients.</p>
                </div>
                <button
                    onClick={openAddModal}
                    disabled={companies.length === 0}
                    className="inline-flex items-center px-4.5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                    <svg className="h-5 w-5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                    </svg>
                    Log Meeting
                </button>
            </div>

            {/* Warn user if no companies exist */}
            {companies.length === 0 && !loading && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl text-amber-805 text-sm shadow-xs">
                    You must add at least one Company before you can log or schedule a meeting.
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

            {/* Meetings Grid / Table */}
            {loading ? (
                <div className="glass-panel rounded-2xl shadow-xs overflow-hidden border border-slate-100/70 animate-pulse">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100/85 text-left">
                            <thead className="bg-slate-50/70">
                                <tr>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Company Name</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Attendees</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Date & Time</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Discussion Notes</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Outcome</th>
                                    <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-455">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/70">
                                {[1, 2, 3, 4].map(i => (
                                    <tr key={i}>
                                        <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded-md w-28"></div></td>
                                        <td className="px-6 py-5 space-y-2">
                                            <div className="h-3.5 bg-slate-200 rounded-sm w-24"></div>
                                            <div className="h-3 bg-slate-200 rounded-sm w-36"></div>
                                        </td>
                                        <td className="px-6 py-5 space-y-2">
                                            <div className="h-3.5 bg-slate-200 rounded-sm w-28"></div>
                                            <div className="h-3 bg-slate-200 rounded-sm w-20"></div>
                                        </td>
                                        <td className="px-6 py-5 space-y-1.5">
                                            <div className="h-3.5 bg-slate-200 rounded-sm w-44"></div>
                                            <div className="h-3 bg-slate-200 rounded-sm w-32"></div>
                                        </td>
                                        <td className="px-6 py-5"><div className="h-4 bg-slate-200 rounded-md w-24"></div></td>
                                        <td className="px-6 py-5 text-right"><div className="h-8 bg-slate-200 rounded-full w-8 ml-auto"></div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : meetings.length === 0 ? (
                <div className="glass-panel rounded-2xl shadow-xs py-16 text-center border border-slate-100">
                    <svg className="mx-auto h-12 w-12 text-slate-350" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">No meetings logged</h3>
                    <p className="mt-2 text-xs text-slate-500">Document discussions and outcomes with your clients here.</p>
                </div>
            ) : (
                <div className="glass-panel rounded-2xl shadow-xs overflow-hidden border border-slate-100/70">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100/85 text-left">
                            <thead className="bg-slate-50/70">
                                <tr>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-450">Company Name</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Attendees</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Date & Time</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Discussion Notes</th>
                                    <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-455">Outcome</th>
                                    <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-455">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/70 text-slate-700 text-sm">
                                {meetings.map(meeting => (
                                    <tr key={meeting.id} className="hover:bg-slate-50/40 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-900">
                                            {meeting.company_name || <span className="text-slate-400 italic">Unknown Company</span>}
                                        </td>
                                        <td className="px-6 py-4 space-y-0.5">
                                            <div className="text-xs font-medium text-slate-600">
                                                <span className="text-slate-400">Contact: </span>{meeting.contact_person || 'N/A'}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                <span className="text-slate-400">Attendees: </span>{meeting.attendees || 'None'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 space-y-0.5">
                                            <div className="font-semibold text-slate-900 text-xs">
                                                {new Date(meeting.meeting_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-medium">
                                                {new Date(meeting.meeting_date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 max-w-sm">
                                            <div className="text-xs text-slate-655 space-y-1.5">
                                                {(() => {
                                                    let parsedNotes = [];
                                                    try {
                                                        parsedNotes = JSON.parse(meeting.notes);
                                                        if (!Array.isArray(parsedNotes)) parsedNotes = [meeting.notes];
                                                    } catch (e) {
                                                        parsedNotes = meeting.notes ? [meeting.notes] : [];
                                                    }
                                                    if (parsedNotes.length === 0) return <span className="text-slate-400 italic">No notes written.</span>;
                                                    
                                                    // Only show the last note in the table
                                                    const lastNote = parsedNotes[parsedNotes.length - 1];
                                                    return (
                                                        <div>
                                                            <div className="bg-slate-50 p-2 rounded-md border border-slate-100 whitespace-pre-wrap">{lastNote}</div>
                                                            {parsedNotes.length > 1 && (
                                                                <div className="text-[10px] text-slate-400 mt-1 italic font-medium cursor-pointer hover:text-indigo-500" onClick={() => openViewModal(meeting)}>
                                                                    + {parsedNotes.length - 1} more note(s). Click View Details to see all.
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {meeting.outcome ? (
                                                <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-indigo-50 text-indigo-705 border border-indigo-100/50 shadow-xs">
                                                    {meeting.outcome}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">No outcome</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === meeting.id ? null : meeting.id); }}
                                                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                                            >
                                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0-6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                                                </svg>
                                            </button>
                                            
                                            {activeDropdown === meeting.id && (
                                                <div className="absolute right-8 top-10 w-40 bg-white border border-slate-200 shadow-lg rounded-xl z-10 py-1 overflow-hidden animate-fadeIn">
                                                    <button
                                                        onClick={() => { openViewModal(meeting); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium cursor-pointer"
                                                    >
                                                        View Details
                                                    </button>
                                                    <button
                                                        onClick={() => { openEditModal(meeting); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => { openRescheduleModal(meeting); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 font-medium cursor-pointer"
                                                    >
                                                        Reschedule
                                                    </button>
                                                    <div className="border-t border-slate-100 my-1"></div>
                                                    <button
                                                        onClick={() => { handleDeleteMeeting(meeting.id); setActiveDropdown(null); }}
                                                        className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium cursor-pointer"
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
                                    {showAddModal ? 'Log Meeting Details' : 'Edit Meeting Entry'}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    {showAddModal ? 'Document discussions and schedule touchpoints.' : 'Update meeting notes and details.'}
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
                            <form onSubmit={handleSaveMeeting} className="p-6 sm:p-8 space-y-5">
                                {formError && (
                                    <div className="text-sm text-rose-700 bg-rose-50/80 backdrop-blur-sm border border-rose-200 p-4 rounded-xl shadow-sm flex items-start gap-3">
                                        <svg className="h-5 w-5 text-rose-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="font-medium">{formError}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Company *</label>
                                    <select
                                        disabled={showEditModal} // Keep linked to company during edit
                                        value={formData.company_id}
                                        onChange={(e) => setFormData(prev => ({ ...prev, company_id: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all cursor-pointer font-semibold shadow-sm appearance-none disabled:opacity-60"
                                        style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.5rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em`, paddingRight: `2.5rem` }}
                                    >
                                        {companies.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Meeting Date & Time *</label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.meeting_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, meeting_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all shadow-sm font-sans text-slate-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Attendees</label>
                                    <input
                                        type="text"
                                        value={formData.attendees}
                                        onChange={(e) => setFormData(prev => ({ ...prev, attendees: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                        placeholder="e.g. John Doe, Jane Smith"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Discussion Outcome (Status/Action Item)</label>
                                    <input
                                        type="text"
                                        value={formData.outcome}
                                        onChange={(e) => setFormData(prev => ({ ...prev, outcome: e.target.value }))}
                                        className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm"
                                        placeholder="e.g. Scheduled demo, Signed contract"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Detailed Discussion Notes</label>
                                    
                                    {formData.notes.length > 0 && (
                                        <div className="mb-3 space-y-2">
                                            {formData.notes.map((note, idx) => (
                                                <div key={idx} className="flex items-start gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                                                    <div className="flex-1 whitespace-pre-wrap text-slate-700">{note}</div>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            setFormData(prev => ({ ...prev, notes: prev.notes.filter((_, i) => i !== idx) }));
                                                        }}
                                                        className="text-rose-500 hover:text-rose-700"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-end gap-2">
                                        <textarea
                                            rows="2"
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            className="flex-1 px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all placeholder-slate-400 shadow-sm resize-none custom-scrollbar"
                                            placeholder="Type a new note here..."
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if(newNote.trim()) {
                                                    setFormData(prev => ({ ...prev, notes: [...prev.notes, newNote.trim()] }));
                                                    setNewNote('');
                                                }
                                            }}
                                            className="px-4 py-3 bg-indigo-100 text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-200 transition-all shadow-sm h-[66px] flex items-center justify-center cursor-pointer"
                                        >
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSummarizeNotes}
                                            disabled={isSummarizing}
                                            className="px-4 py-3 bg-white text-indigo-600 border border-indigo-200 font-bold text-sm rounded-xl hover:bg-indigo-50 transition-all shadow-sm h-[66px] flex items-center justify-center cursor-pointer disabled:opacity-70 flex-shrink-0"
                                        >
                                            {isSummarizing ? 'Summarizing...' : 'Summarize Notes'}
                                        </button>
                                    </div>
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
                                                {showAddModal ? 'Save Meeting' : 'Save Changes'}
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
            {showViewModal && selectedMeeting && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 overflow-y-auto flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn">
                    <div className="glass-panel bg-white/80 rounded-3xl shadow-2xl border border-white/60 max-w-lg w-full flex flex-col relative overflow-hidden transform transition-all">
                        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/50 flex justify-between items-center">
                            <h3 className="font-extrabold text-xl text-slate-900">Meeting Details</h3>
                            <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer">
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 space-y-5 text-sm overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Company Name</p>
                                    <p className="font-semibold text-slate-900">{selectedMeeting.company_name}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Date & Time</p>
                                    <p className="font-semibold text-slate-900">
                                        {new Date(selectedMeeting.meeting_date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Contact Person</p>
                                    <p className="font-semibold text-slate-900">{selectedMeeting.contact_person || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Attendees</p>
                                    <p className="font-semibold text-slate-900">{selectedMeeting.attendees || 'None'}</p>
                                </div>
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Outcome</p>
                                {selectedMeeting.outcome ? (
                                    <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-indigo-50 text-indigo-705 border border-indigo-100/50">
                                        {selectedMeeting.outcome}
                                    </span>
                                ) : (
                                    <span className="text-slate-400 italic">No outcome recorded.</span>
                                )}
                            </div>

                            <div className="border-t border-slate-100 pt-4">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">All Discussion Notes</p>
                                {(() => {
                                    let parsedNotes = [];
                                    try {
                                        parsedNotes = JSON.parse(selectedMeeting.notes);
                                        if (!Array.isArray(parsedNotes)) parsedNotes = [selectedMeeting.notes];
                                    } catch (e) {
                                        parsedNotes = selectedMeeting.notes ? [selectedMeeting.notes] : [];
                                    }
                                    if (parsedNotes.length === 0) return <span className="text-slate-400 italic">No notes written.</span>;
                                    return (
                                        <div className="space-y-3">
                                            {parsedNotes.map((note, idx) => (
                                                <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 whitespace-pre-wrap text-slate-700 leading-relaxed shadow-sm">
                                                    {note}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        <div className="p-4 sm:p-6 border-t border-slate-200/50 bg-slate-50 flex justify-end">
                            <button onClick={() => setShowViewModal(false)} className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 shadow-sm transition-all cursor-pointer">Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Reschedule Modal */}
            {showRescheduleModal && selectedMeeting && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 overflow-y-auto flex items-center justify-center p-4 sm:p-6 z-50 animate-fadeIn">
                    <div className="glass-panel bg-white/80 rounded-3xl shadow-2xl border border-white/60 max-w-sm w-full flex flex-col relative overflow-hidden transform transition-all">
                        <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-slate-200/50 flex justify-between items-center relative z-10">
                            <div>
                                <h3 className="font-extrabold text-xl tracking-tight text-slate-900 font-['Outfit']">Reschedule Meeting</h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">Select a new date and time for this meeting.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowRescheduleModal(false)}
                                className="text-slate-400 hover:text-rose-600 p-2 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleReschedule} className="p-6 sm:p-8 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">New Date & Time *</label>
                                <input
                                    type="datetime-local"
                                    required
                                    value={rescheduleDate}
                                    onChange={(e) => setRescheduleDate(e.target.value)}
                                    className="w-full px-4 py-3 bg-white/60 backdrop-blur-md border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all shadow-sm font-sans text-slate-700"
                                />
                            </div>

                            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={sendRescheduleEmail}
                                    onChange={(e) => setSendRescheduleEmail(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 bg-white border-slate-300 rounded focus:ring-indigo-500 focus:ring-2 cursor-pointer"
                                />
                                <span className="text-sm font-medium text-slate-700">Send an email notification to the client</span>
                            </label>

                            <div className="pt-6 mt-4 border-t border-slate-200/50 flex flex-col-reverse sm:flex-row justify-end gap-3 sm:gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowRescheduleModal(false)}
                                    className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-lg hover:shadow-indigo-500/25 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    Reschedule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
