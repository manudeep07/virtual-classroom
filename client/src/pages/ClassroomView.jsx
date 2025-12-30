import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { Video, BookOpen, Users, LogOut, MessageSquare, Plus, Download, ChevronLeft, Send, Clock, FileText, MoreVertical, Trash2 } from 'lucide-react';
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
            if (res.ok) setAssignments(await res.json());
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

            return () => {
                socket.off('class-status-changed');
            };
        }
    }, [id, user, socket]);

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

    const handleCreateAssignment = async (e) => {
        e.preventDefault();
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
            }
        } catch (err) { console.error(err); }
    };

    const handleCreateMaterial = async (e) => {
        e.preventDefault();
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
    };

    const handleSubmitAssignment = async (e) => {
        e.preventDefault();
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
            } else {
                toast.error('Failed to submit');
            }
        } catch (err) {
            console.error(err);
            toast.error('Error submitting');
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
                                                    className="w-full bg-transparent border-none focus:ring-0 text-white placeholder-white/30 resize-none min-h-[40px]"
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
                                            {assignments.map(assign => (
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
                                                                <button onClick={() => { setSelectedAssignment(assign); setShowSubmissionModal(true); }} className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded-lg text-sm text-white transition-colors">
                                                                    Submit
                                                                </button>
                                                            )}
                                                            {assign.fileUrl && (
                                                                <a href={`http://localhost:5001${assign.fileUrl}`} target="_blank" className="p-2 text-[rgb(var(--color-secondary))] hover:bg-white/5 rounded-lg" title="Download Attachment">
                                                                    <Download size={20} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
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
                                                            <a href={`http://localhost:5001${mat.fileUrl}`} target="_blank" className="p-2 text-[rgb(var(--color-secondary))] hover:bg-white/5 rounded-lg">
                                                                <Download size={20} />
                                                            </a>
                                                        )}
                                                    </div>
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
                                            <div key={ann._id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:bg-white/10 transition-colors">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-6 h-6 rounded-full bg-[rgb(var(--color-primary))] flex items-center justify-center text-[10px] text-white font-bold">
                                                        {ann.teacherId?.name?.charAt(0)}
                                                    </div>
                                                    <span className="text-xs font-bold text-white truncate">{ann.teacherId?.name}</span>
                                                    <span className="text-[10px] text-[rgb(var(--text-secondary))] ml-auto">{new Date(ann.createdAt).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
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
                            <input type="date" className="w-full px-4 py-3 rounded-xl input-glass" value={newAssignment.dueDate} onChange={e => setNewAssignment({ ...newAssignment, dueDate: e.target.value })} />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowAssignmentModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-white">Cancel</button>
                                <button type="submit" className="px-4 py-2 btn-primary rounded-lg text-white font-bold">Create</button>
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
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowMaterialModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-white">Cancel</button>
                                <button type="submit" className="px-4 py-2 btn-primary rounded-lg text-white font-bold">Add</button>
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
                            <input type="file" onChange={e => setSubmissionFile(e.target.files[0])} className="w-full text-sm text-[rgb(var(--text-secondary))]" />
                            <div className="flex justify-end gap-2 mt-4">
                                <button type="button" onClick={() => setShowSubmissionModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-lg text-white">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-bold">Turn In</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ClassroomView;
