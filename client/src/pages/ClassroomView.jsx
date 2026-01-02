import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { Video, BookOpen, Users, LogOut, MessageSquare, Plus, Download, ChevronLeft, Send, Clock, FileText, MoreVertical, Trash2, Pencil, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ClassroomView = () => {
    const { id } = useParams();
    const { user, socket } = useContext(SocketContext);
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [activeTab, setActiveTab] = useState('stream');
    const [assignments, setAssignments] = useState([]);
    const [materials, setMaterials] = useState([]);

    // Modal States
    const [showAssignmentModal, setShowAssignmentModal] = useState(false);
    const [showMaterialModal, setShowMaterialModal] = useState(false);
    const [showSubmissionModal, setShowSubmissionModal] = useState(false);

    // Selection States
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [submissionContent, setSubmissionContent] = useState('');
    const [viewSubmissions, setViewSubmissions] = useState({});
    const [submittedAssignments, setSubmittedAssignments] = useState({}); // Map of assignmentId -> boolean

    // Forms
    const [newAssignment, setNewAssignment] = useState({ title: '', description: '', dueDate: '' });
    const [assignmentFile, setAssignmentFile] = useState(null);
    const [newMaterial, setNewMaterial] = useState({ title: '', description: '', link: '' });
    const [materialFile, setMaterialFile] = useState(null);
    const [submissionFile, setSubmissionFile] = useState(null);

    // Announcements
    const [announcements, setAnnouncements] = useState([]);
    const [newAnnouncement, setNewAnnouncement] = useState('');
    const [isActiveAnnouncementInput, setIsActiveAnnouncementInput] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCreating, setIsCreating] = useState(false); // Shared loading state for creating assignment/material

    // --- Fetchers ---
    const fetchClassroom = async () => {
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/${id}`);
            const data = await res.json();
            if (res.ok) setClassroom(data);
            else {
                toast.error('Failed to load classroom');
                navigate('/dashboard');
            }
        } catch (err) { console.error(err); }
    };

    const fetchAnnouncements = async () => {
        try {
            const res = await fetch(`http://localhost:5001/api/announcements/${id}`);
            if (res.ok) setAnnouncements(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchAssignments = async () => {
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/${id}/assignments`);
            if (res.ok) {
                const data = await res.json();
                setAssignments(data);

                // If student, fetch their submissions to check status
                if (user && user.role === 'student') {
                    // This is a naive N+1 approach but sufficient for this scale. 
                    // Better: a separate endpoint returning all submission IDs for this student in this class.
                    // For now, let's use a Promise.all to check specific status or just rely on the error.
                    // Actually, let's stick to the error handling for simplicity and robustness first, 
                    // OR implementing a 'submission status' map.

                    // Let's create a map of submitted assignment IDs
                    const statusMap = {};
                    await Promise.all(data.map(async (assign) => {
                        try {
                            const subRes = await fetch(`http://localhost:5001/api/submissions/${assign._id}/my-submission?studentId=${user.id}`);
                            if (subRes.ok) {
                                const sub = await subRes.json();
                                if (sub) statusMap[assign._id] = true;
                            }
                        } catch (e) { console.error(e); }
                    }));
                    setSubmittedAssignments(statusMap);
                }
            }
        } catch (err) { console.error(err); }
    };

    const fetchMaterials = async () => {
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/${id}/materials`);
            if (res.ok) setMaterials(await res.json());
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (id && user) {
            fetchClassroom();
            fetchAssignments();
            fetchMaterials();
            fetchAnnouncements();

            socket.emit('join-classroom-dashboard', { roomId: id });
            socket.on('class-status-changed', ({ isActive }) => {
                setClassroom(prev => prev ? { ...prev, isActive } : prev);
            });

            // Real-time assignment updates
            socket.on('assignment-created', (newAssignment) => {
                setAssignments(prev => [newAssignment, ...prev]);
                // If current user is student, we might want to check submission status (which is null initially)
            });

            socket.on('assignment-deleted', (assignmentId) => {
                setAssignments(prev => prev.filter(a => a._id !== assignmentId));
            });

            socket.on('material-created', (newMaterial) => {
                setMaterials(prev => [newMaterial, ...prev]);
            });

            return () => {
                socket.off('class-status-changed');
                socket.off('assignment-created');
                socket.off('assignment-deleted');
                socket.off('material-created');
            };
        }
    }, [id, user, socket]);

    // Helper to format Cloudinary URLs for download
    const getDownloadUrl = (url) => {
        if (!url) return '#';
        if (url.startsWith('http')) {
            console.log('Download URL:', url); // Debugging
            return url;
        }
        return `http://localhost:5001${url}`;
    };

    // --- Handlers ---

    const handlePostAnnouncement = async () => {
        if (!newAnnouncement.trim()) return;
        try {
            const res = await fetch(`http://localhost:5001/api/announcements/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: user.id, content: newAnnouncement })
            });
            if (res.ok) {
                setNewAnnouncement('');
                setIsActiveAnnouncementInput(false);
                fetchAnnouncements();
                toast.success('Announcement posted');
            }
        } catch (err) { console.error(err); }
    };

    const handleDeleteAnnouncement = async (annId) => {
        if (!window.confirm('Delete this announcement?')) return;
        try {
            const res = await fetch(`http://localhost:5001/api/announcements/${annId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Announcement deleted');
                fetchAnnouncements();
            }
        } catch (err) { console.error(err); }
    };

    const handleUpdateAnnouncement = async (annId) => {
        if (!editContent.trim()) return;
        try {
            const res = await fetch(`http://localhost:5001/api/announcements/${annId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editContent })
            });
            if (res.ok) {
                toast.success('Announcement updated');
                setEditingAnnouncement(null);
                fetchAnnouncements();
            }
        } catch (err) { console.error(err); }
    };

    const handleDeleteClassroom = async () => {
        if (!window.confirm('Are you sure you want to delete this class? This cannot be undone.')) return;
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: user.id })
            });
            if (res.ok) {
                toast.success('Classroom deleted');
                navigate('/dashboard');
            } else {
                toast.error('Failed to delete classroom');
            }
        } catch (err) { console.error(err); }
    };

    const handleStartLive = (duration = 0) => {
        socket.emit('start-class', { roomId: id, userId: user.id, duration });
        navigate(`/room/${id}`);
    };

    const handleDeleteAssignment = async (assignId) => {
        if (!window.confirm('Delete this assignment? This will also delete all student submissions.')) return;
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/${id}/assignments/${assignId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success('Assignment deleted');
                // UI update handled by socket, but we can do it optimistically too if needed
            } else {
                toast.error('Failed to delete assignment');
            }
        } catch (err) { console.error(err); }
    };

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const formData = new FormData();
            formData.append('title', newAssignment.title);
            formData.append('description', newAssignment.description);
            formData.append('dueDate', newAssignment.dueDate);
            if (assignmentFile) formData.append('file', assignmentFile);

            const res = await fetch(`http://localhost:5001/api/classrooms/${id}/assignments`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                fetchAssignments();
                setShowAssignmentModal(false);
                setNewAssignment({ title: '', description: '', dueDate: '' });
                setAssignmentFile(null);
                toast.success('Assignment created');
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to create assignment');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error creating assignment');
        }
        finally { setIsCreating(false); }
    };

    const handleCreateMaterial = async (e) => {
        e.preventDefault();
        setIsCreating(true);
        try {
            const formData = new FormData();
            formData.append('title', newMaterial.title);
            formData.append('description', newMaterial.description);
            formData.append('link', newMaterial.link);
            if (materialFile) formData.append('file', materialFile);

            const res = await fetch(`http://localhost:5001/api/classrooms/${id}/materials`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                fetchMaterials();
                setShowMaterialModal(false);
                setNewMaterial({ title: '', description: '', link: '' });
                setMaterialFile(null);
                toast.success('Material added');
            }
        } catch (err) { console.error(err); }
        finally { setIsCreating(false); }
    };

    const handleSubmitAssignment = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('studentId', user.id);
            formData.append('content', submissionContent);
            if (submissionFile) formData.append('file', submissionFile);

            const res = await fetch(`http://localhost:5001/api/submissions/${selectedAssignment._id}`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                toast.success('Assignment submitted!');
                setShowSubmissionModal(false);
                // Update local state to reflect submission immediately
                setSubmittedAssignments(prev => ({ ...prev, [selectedAssignment._id]: true }));
            } else {
                const data = await res.json();
                toast.error(data.message || 'Failed to submit');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error submitting');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!classroom) return <div className="min-h-screen bg-[rgb(var(--bg-dark))] flex items-center justify-center text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-[rgb(var(--bg-dark))] text-[rgb(var(--text-primary))] font-sans relative">
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-white/5 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white/10 rounded-full transition-colors text-[rgb(var(--text-secondary))] hover:text-white">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">{classroom.name}</h1>
                        <p className="text-xs text-[rgb(var(--text-secondary))] uppercase tracking-wider font-semibold">{classroom.subject}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {user.role === 'teacher' && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleStartLive(0)}
                                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg font-bold shadow-lg shadow-red-500/20 flex items-center gap-2 transition-all"
                            >
                                <Video size={18} />
                                Go Live
                            </button>
                        </div>
                    )}
                    {user.role === 'student' && (
                        <button
                            onClick={() => navigate(`/room/${id}`)}
                            disabled={!classroom.isActive}
                            className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-all ${classroom.isActive
                                ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 animate-pulse'
                                : 'bg-white/10 text-[rgb(var(--text-secondary))] cursor-not-allowed'
                                }`}
                        >
                            <Video size={18} />
                            {classroom.isActive ? 'Join Live Class' : 'Class Offline'}
                        </button>
                    )}
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 px-6 pb-12 max-w-7xl mx-auto h-[calc(100vh-6rem)]">

                {/* Tabs */}
                <div className="flex border-b border-white/10 mb-6">
                    {['stream', 'classwork', 'people'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 font-medium text-sm transition-all relative ${activeTab === tab ? 'text-[rgb(var(--color-primary))]' : 'text-[rgb(var(--text-secondary))] hover:text-white'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))] rounded-t-full"></div>
                            )}
                        </button>
                    ))}
                </div>

                <div className="flex gap-6 h-full items-start">

                    {/* Main Feed Area */}
                    <div className="flex-1 space-y-6 overflow-y-auto pb-20 custom-scrollbar h-full pr-2">

                        {/* Stream View */}
                        {activeTab === 'stream' && (
                            <>
                                {/* Hero Banner */}
                                <div className="h-48 rounded-2xl bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-secondary))] p-8 relative overflow-hidden shadow-2xl flex flex-col justify-end">
                                    <div className="absolute top-0 right-0 p-12 opacity-20 transform translate-x-12 -translate-y-12">
                                        <BookOpen size={200} />
                                    </div>
                                    <div className="relative z-10">
                                        <h2 className="text-4xl font-bold text-white mb-2">{classroom.name}</h2>
                                        <div className="flex items-center gap-4 text-white/80">
                                            <span className="text-lg">{classroom.subject}</span>
                                            <span className="w-1.5 h-1.5 bg-white/50 rounded-full"></span>
                                            <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-sm">Code: {classroom.code}</span>
                                        </div>
                                    </div>
                                    {user.role === 'teacher' && (
                                        <button
                                            onClick={handleDeleteClassroom}
                                            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-red-500 text-white rounded-lg backdrop-blur-md transition-all"
                                            title="Delete Class"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>

                                {/* Announcement Input */}
                                {user.role === 'teacher' && (
                                    <div className={`glass-panel rounded-2xl p-4 transition-all ${isActiveAnnouncementInput ? 'ring-2 ring-[rgb(var(--color-primary))]' : ''}`}>
                                        <div className="flex gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[rgb(var(--color-secondary))] to-[rgb(var(--color-accent))] flex items-center justify-center font-bold text-white shrink-0">
                                                {user.name.charAt(0)}
                                            </div>
                                            <div className="flex-1">
                                                <textarea
                                                    value={newAnnouncement}
                                                    onChange={(e) => setNewAnnouncement(e.target.value)}
                                                    onFocus={() => setIsActiveAnnouncementInput(true)}
                                                    placeholder="Announce something to your class..."
                                                    className="w-full bg-transparent border-none outline-none focus:ring-0 text-white placeholder-white/30 resize-none min-h-[40px]"
                                                    rows={isActiveAnnouncementInput ? 3 : 1}
                                                />
                                                {isActiveAnnouncementInput && (
                                                    <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-white/10">
                                                        <button
                                                            onClick={() => setIsActiveAnnouncementInput(false)}
                                                            className="px-4 py-2 hover:bg-white/5 rounded-lg text-sm text-[rgb(var(--text-secondary))]"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handlePostAnnouncement}
                                                            disabled={!newAnnouncement.trim()}
                                                            className="px-4 py-2 bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-secondary))] text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Send size={14} /> Post
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile/In-Flow Announcements (if no sidebar space, but we have sidebar) */}
                                {/* For mobile responsiveness, we might want to stack them, but for now strict layout */}
                            </>
                        )}

                        {/* Classwork View */}
                        {activeTab === 'classwork' && (
                            <>
                                {user.role === 'teacher' && (
                                    <div className="flex gap-4 mb-6">
                                        <button onClick={() => setShowAssignmentModal(true)} className="flex items-center gap-2 px-6 py-3 bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-secondary))] text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-all">
                                            <Plus size={20} /> Create Assignment
                                        </button>
                                        <button onClick={() => setShowMaterialModal(true)} className="flex items-center gap-2 px-6 py-3 glass-panel hover:bg-white/10 text-white rounded-xl font-bold transition-all">
                                            <BookOpen size={20} /> Add Material
                                        </button>
                                    </div>
                                )}

                                <div className="space-y-8">
                                    {/* Assignments */}
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            <FileText className="text-[rgb(var(--color-accent))]" /> Assignments
                                        </h3>
                                        <div className="space-y-4">
                                            {assignments.map(assign => {
                                                // Check if student has submitted (requires logic update)
                                                // For now, we will handle the "Already Submitted" check when they click "Submit"
                                                // Ideally, we'd fetch submission status with the assignments list or separately.
                                                // Let's rely on the backend 400 error for now to block duplicate submissions,
                                                // OR we can make a small fetch for "my-submission" when student views.
                                                // Simpler Approach for this iteration: Just blocking via backend error as established, 
                                                // but let's add the Teacher View Button.

                                                return (
                                                    <div key={assign._id} className="glass-card p-6 rounded-2xl group hover:border-[rgb(var(--color-primary))]/50">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex gap-4">
                                                                <div className="p-3 bg-[rgb(var(--color-primary))]/20 rounded-xl text-[rgb(var(--color-primary))] h-fit">
                                                                    <FileText size={24} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-lg font-bold text-white group-hover:text-[rgb(var(--color-primary))] transition-colors">{assign.title}</h4>
                                                                    <p className="text-[rgb(var(--text-secondary))] mt-1 text-sm">{assign.description}</p>
                                                                    {assign.dueDate && (
                                                                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-500/10 px-2 py-1 rounded w-fit">
                                                                            <Clock size={12} /> Due: {new Date(assign.dueDate).toLocaleDateString()}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-2">
                                                                {user.role === 'student' && (
                                                                    submittedAssignments[assign._id] ? (
                                                                        <button disabled className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-sm text-green-500 font-bold cursor-not-allowed flex items-center gap-1">
                                                                            <CheckCircle size={16} /> Submitted
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => { setSelectedAssignment(assign); setShowSubmissionModal(true); }} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-sm text-white transition-colors">
                                                                            Submit
                                                                        </button>
                                                                    )
                                                                )}
                                                                {user.role === 'teacher' && (
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={async () => {
                                                                                setViewSubmissions({ show: true, assignmentTitle: assign.title, data: null });
                                                                                try {
                                                                                    const res = await fetch(`http://localhost:5001/api/submissions/${assign._id}/all`);
                                                                                    if (res.ok) {
                                                                                        const data = await res.json();
                                                                                        setViewSubmissions({ show: true, assignmentTitle: assign.title, data });
                                                                                    }
                                                                                } catch (e) {
                                                                                    toast.error("Failed to load submissions");
                                                                                }
                                                                            }}
                                                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-[rgb(var(--color-primary))] font-bold transition-colors flex items-center gap-2"
                                                                        >
                                                                            <Users size={16} /> Submissions
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteAssignment(assign._id)}
                                                                            className="px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-sm text-red-500 transition-colors"
                                                                            title="Delete Assignment"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {assign.fileUrl && (
                                                                    <a href={getDownloadUrl(assign.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-2 text-[rgb(var(--color-secondary))] hover:bg-white/5 rounded-lg" title="Download Attachment">
                                                                        <Download size={20} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {assignments.length === 0 && <p className="text-[rgb(var(--text-secondary))] italic px-2">No assignments posted yet.</p>}
                                        </div>
                                    </div>

                                    {/* Materials */}
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                            <BookOpen className="text-[rgb(var(--color-secondary))]" /> Learning Materials
                                        </h3>
                                        <div className="space-y-4">
                                            {materials.map(mat => (
                                                <div key={mat._id} className="glass-card p-6 rounded-2xl group hover:border-[rgb(var(--color-secondary))]/50">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex gap-4">
                                                            <div className="p-3 bg-[rgb(var(--color-secondary))]/20 rounded-xl text-[rgb(var(--color-secondary))] h-fit">
                                                                <BookOpen size={24} />
                                                            </div>
                                                            <div>
                                                                <h4 className="text-lg font-bold text-white group-hover:text-[rgb(var(--color-secondary))] transition-colors">{mat.title}</h4>
                                                                <p className="text-[rgb(var(--text-secondary))] mt-1 text-sm">{mat.description}</p>
                                                                {mat.link && <a href={mat.link} target="_blank" className="text-[rgb(var(--color-primary))] text-sm hover:underline mt-1 block">{mat.link}</a>}
                                                            </div>
                                                        </div>
                                                        {mat.fileUrl && (
                                                            <a href={getDownloadUrl(mat.fileUrl)} target="_blank" rel="noopener noreferrer" className="p-2 text-[rgb(var(--color-secondary))] hover:bg-white/5 rounded-lg">
                                                                <Download size={20} />
                                                            </a>
                                                        )}                                          </div>
                                                </div>
                                            ))}
                                            {materials.length === 0 && <p className="text-[rgb(var(--text-secondary))] italic px-2">No materials posted yet.</p>}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* People View */}
                        {activeTab === 'people' && (
                            <div className="max-w-3xl mx-auto space-y-8">
                                <div className="glass-panel rounded-2xl overflow-hidden">
                                    <div className="p-6 border-b border-white/10">
                                        <h2 className="text-2xl font-bold text-[rgb(var(--color-primary))]">Teacher</h2>
                                    </div>
                                    <div className="p-6 flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[rgb(var(--color-primary))] to-[rgb(var(--color-secondary))] flex items-center justify-center font-bold text-white text-xl">
                                            {classroom.teacherId?.name?.charAt(0)}
                                        </div>
                                        <span className="text-lg font-medium text-white">{classroom.teacherId?.name}</span>
                                    </div>
                                </div>

                                <div className="glass-panel rounded-2xl overflow-hidden">
                                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                                        <h2 className="text-2xl font-bold text-[rgb(var(--color-primary))]">Classmates</h2>
                                        <span className="text-sm text-[rgb(var(--text-secondary))]">{classroom.studentIds.length} students</span>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {classroom.studentIds.map(student => (
                                            <div key={student._id} className="p-6 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white">
                                                    {student.name.charAt(0)}
                                                </div>
                                                <span className="text-white font-medium">{student.name}</span>
                                            </div>
                                        ))}
                                        {classroom.studentIds.length === 0 && (
                                            <div className="p-8 text-center text-[rgb(var(--text-secondary))] italic">
                                                No students enrolled yet.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Right Sidebar - Sticky Announcements Panel */}
                    {activeTab === 'stream' && (
                        <div className="w-80 shrink-0 hidden lg:block sticky top-0 h-full overflow-hidden">
                            <div className="glass-panel rounded-2xl h-full flex flex-col border border-white/10">
                                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center gap-2">
                                    <MessageSquare size={18} className="text-[rgb(var(--color-accent))]" />
                                    <h3 className="font-bold text-white">Announcements</h3>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                    {announcements.length === 0 ? (
                                        <div className="text-center py-10">
                                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3 text-white/20">
                                                <MessageSquare size={20} />
                                            </div>
                                            <p className="text-[rgb(var(--text-secondary))] text-sm">No announcements yet</p>
                                        </div>
                                    ) : (
                                        announcements.map(ann => (
                                            <div key={ann._id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors group">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-[rgb(var(--color-primary))] flex items-center justify-center text-[10px] text-white font-bold">
                                                        {ann.teacherId?.name?.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-bold text-white truncate">{ann.teacherId?.name}</span>
                                                    <span className="text-[10px] text-[rgb(var(--text-secondary))] ml-auto">{new Date(ann.createdAt).toLocaleDateString()}</span>

                                                    {user.role === 'teacher' && (
                                                        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => { setEditingAnnouncement(ann._id); setEditContent(ann.content); }}
                                                                className="p-1 hover:bg-white/10 rounded text-[rgb(var(--text-secondary))] hover:text-white cursor-pointer"
                                                                title="Edit"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteAnnouncement(ann._id)}
                                                                className="p-1 hover:bg-red-500/20 rounded text-[rgb(var(--text-secondary))] hover:text-red-400 cursor-pointer"
                                                                title="Delete"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {editingAnnouncement === ann._id ? (
                                                    <div className="mt-2">
                                                        <textarea
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            className="w-full bg-black/20 rounded-lg p-2 text-sm text-white resize-none border border-white/10 focus:border-[rgb(var(--color-primary))] outline-none"
                                                            rows={3}
                                                        />
                                                        <div className="flex justify-end gap-2 mt-2">
                                                            <button
                                                                onClick={() => setEditingAnnouncement(null)}
                                                                className="text-xs px-2 py-1 hover:bg-white/10 rounded text-gray-400"
                                                            >
                                                                Cancel
                                                            </button>
                                                            <button
                                                                onClick={() => handleUpdateAnnouncement(ann._id)}
                                                                className="text-xs px-2 py-1 bg-[rgb(var(--color-primary))] hover:bg-[rgb(var(--color-secondary))] rounded text-white font-bold"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modals - Reused Glass Style */}
            {showAssignmentModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl animate-in fade-in zoom-in bg-[rgb(var(--bg-card))]">
                        <h3 className="text-xl font-bold text-white mb-4">Create Assignment</h3>
                        <form onSubmit={handleCreateAssignment} className="space-y-4">
                            <input type="text" placeholder="Title" required className="w-full px-4 py-3 rounded-xl input-glass" value={newAssignment.title} onChange={e => setNewAssignment({ ...newAssignment, title: e.target.value })} />
                            <textarea placeholder="Description" className="w-full px-4 py-3 rounded-xl input-glass" value={newAssignment.description} onChange={e => setNewAssignment({ ...newAssignment, description: e.target.value })} />
                            <input type="date" required className="w-full px-4 py-3 rounded-xl input-glass" value={newAssignment.dueDate} onChange={e => setNewAssignment({ ...newAssignment, dueDate: e.target.value })} />

                            <div className="space-y-2">
                                <label className="text-sm text-[rgb(var(--text-secondary))] ml-1">Attachment (Optional)</label>
                                <input
                                    type="file"
                                    onChange={e => setAssignmentFile(e.target.files[0])}
                                    className="w-full text-sm text-[rgb(var(--text-secondary))] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[rgb(var(--color-primary))] file:text-white hover:file:bg-[rgb(var(--color-secondary))]"
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowAssignmentModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-white" disabled={isCreating}>Cancel</button>
                                <button type="submit" className="px-4 py-2 btn-primary rounded-lg text-white font-bold flex items-center gap-2" disabled={isCreating}>
                                    {isCreating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Creating...
                                        </>
                                    ) : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Material Modal - Simplified for brevity but matches style */}
            {showMaterialModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl bg-[rgb(var(--bg-card))]">
                        <h3 className="text-xl font-bold text-white mb-4">Add Material</h3>
                        <form onSubmit={handleCreateMaterial} className="space-y-4">
                            <input type="text" placeholder="Title" required className="w-full px-4 py-3 rounded-xl input-glass" value={newMaterial.title} onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })} />
                            <textarea placeholder="Description" className="w-full px-4 py-3 rounded-xl input-glass" value={newMaterial.description} onChange={e => setNewMaterial({ ...newMaterial, description: e.target.value })} />
                            <input type="text" placeholder="Link (http://...)" className="w-full px-4 py-3 rounded-xl input-glass" value={newMaterial.link} onChange={e => setNewMaterial({ ...newMaterial, link: e.target.value })} />

                            <div className="space-y-2">
                                <label className="text-sm text-[rgb(var(--text-secondary))] ml-1">Attachment (Optional)</label>
                                <input
                                    type="file"
                                    onChange={e => setMaterialFile(e.target.files[0])}
                                    className="w-full text-sm text-[rgb(var(--text-secondary))] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[rgb(var(--color-secondary))] file:text-white hover:file:bg-[rgb(var(--color-secondary))]/80"
                                />
                            </div>

                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowMaterialModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-white" disabled={isCreating}>Cancel</button>
                                <button type="submit" className="px-4 py-2 btn-primary rounded-lg text-white font-bold flex items-center gap-2" disabled={isCreating}>
                                    {isCreating ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Adding...
                                        </>
                                    ) : 'Add'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Submission Modal */}
            {showSubmissionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-md p-6 rounded-2xl shadow-2xl bg-[rgb(var(--bg-card))]">
                        <h3 className="text-xl font-bold text-white mb-2">Submit Assignment</h3>
                        <p className="text-sm text-[rgb(var(--text-secondary))] mb-4">{selectedAssignment?.title}</p>
                        <form onSubmit={handleSubmitAssignment} className="space-y-4">
                            <textarea placeholder="Type your response here..." className="w-full px-4 py-3 rounded-xl input-glass min-h-[120px]" value={submissionContent} onChange={e => setSubmissionContent(e.target.value)} />
                            <input type="file" onChange={e => setSubmissionFile(e.target.files[0])} className="w-full text-sm text-[rgb(var(--text-secondary))] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[rgb(var(--color-primary))] file:text-white hover:file:bg-[rgb(var(--color-secondary))]" />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowSubmissionModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-white" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold flex items-center gap-2" disabled={isSubmitting}>
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Submitting...
                                        </>
                                    ) : 'Submit'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Submissions Modal (Teacher) */}
            {viewSubmissions.show && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl shadow-2xl bg-[rgb(var(--bg-card))] h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Users size={20} className="text-[rgb(var(--color-primary))]" />
                                Submissions: {viewSubmissions.assignmentTitle}
                            </h3>
                            <button onClick={() => setViewSubmissions({ ...viewSubmissions, show: false })} className="p-2 hover:bg-white/10 rounded-lg text-white">
                                <LogOut size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                            {!viewSubmissions.data ? (
                                <div className="text-center py-10 text-[rgb(var(--text-secondary))]">Loading...</div>
                            ) : viewSubmissions.data.length === 0 ? (
                                <div className="text-center py-10 text-[rgb(var(--text-secondary))]">No submissions yet.</div>
                            ) : (
                                viewSubmissions.data.map(sub => (
                                    <div key={sub._id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[rgb(var(--color-secondary))] to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                                                    {sub.studentId?.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white">{sub.studentId?.name}</p>
                                                    <p className="text-xs text-[rgb(var(--text-secondary))]">{sub.studentId?.email}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-[rgb(var(--text-secondary))]">
                                                {new Date(sub.submittedAt).toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="ml-11 space-y-2">
                                            {sub.content && <p className="text-sm text-gray-200 bg-black/20 p-3 rounded-lg">{sub.content}</p>}
                                            {sub.fileUrl && (
                                                <a href={getDownloadUrl(sub.fileUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-[rgb(var(--color-primary))] hover:underline bg-[rgb(var(--color-primary))]/10 px-3 py-2 rounded-lg transition-colors">
                                                    <Download size={14} /> Download Attachment
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ClassroomView;
