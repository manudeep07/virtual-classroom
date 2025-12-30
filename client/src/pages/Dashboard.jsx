import React, { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Users, BookOpen, ArrowRight, Trash2, Camera, Search, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';

const Dashboard = () => {
    const { user, setUser } = useContext(SocketContext);
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', subject: '', code: '' });

    // Profile State
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    useEffect(() => {
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchClassrooms();
    }, [user, navigate]);

    const fetchClassrooms = async () => {
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/my-classes?userId=${user.id}&role=${user.role}`);
            const data = await res.json();
            if (res.ok) setClassrooms(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateClass = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5001/api/classrooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    subject: formData.subject,
                    teacherId: user.id
                })
            });
            if (res.ok) {
                setShowModal(false);
                setFormData({ name: '', subject: '', code: '' });
                fetchClassrooms();
                toast.success('Classroom created successfully!');
            } else {
                toast.error('Failed to create class');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleJoinClass = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5001/api/classrooms/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: formData.code,
                    studentId: user.id
                })
            });
            const data = await res.json();
            if (res.ok) {
                setShowModal(false);
                setFormData({ name: '', subject: '', code: '' });
                fetchClassrooms();
                toast.success('Joined classroom successfully!');
            } else {
                toast.error(data.message || 'Failed to join class');
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteClass = async (classId, e) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this class? This cannot be undone.')) return;
        try {
            const res = await fetch(`http://localhost:5001/api/classrooms/${classId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: user.id })
            });
            if (res.ok) {
                toast.success('Classroom deleted');
                fetchClassrooms();
            } else {
                toast.error('Failed to delete classroom');
            }
        } catch (err) { console.error(err); }
    };

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        navigate('/auth');
    };

    const handlePhotoUpload = () => {
        // Placeholder for photo upload logic
        toast.promise(
            new Promise(resolve => setTimeout(resolve, 1000)),
            {
                loading: 'Uploading photo...',
                success: 'Photo updated!',
                error: 'Could not upload photo.'
            }
        );
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-[rgb(var(--bg-dark))] text-[rgb(var(--text-primary))] font-sans relative overflow-x-hidden">
            {/* Background Atmosphere */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-[rgb(var(--color-primary))] rounded-full mix-blend-screen filter blur-[120px] opacity-10"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-[rgb(var(--color-secondary))] rounded-full mix-blend-screen filter blur-[120px] opacity-10"></div>
            </div>

            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass-panel border-b-0 border-white/5 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-tr from-[rgb(var(--color-primary))] to-[rgb(var(--color-secondary))] rounded-xl shadow-lg shadow-[rgb(var(--color-primary))]/20">
                        <BookOpen size={20} className="text-white" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">Virtual CLS</span>
                </div>

                <div className="flex items-center gap-6">
                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-3 hover:bg-white/5 p-2 pr-4 rounded-full transition-all border border-transparent hover:border-white/10"
                        >
                            <div className="w-9 h-9 bg-gradient-to-br from-[rgb(var(--color-secondary))] to-[rgb(var(--color-accent))] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md relative overflow-hidden group">
                                {user.name.charAt(0)}
                                <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center pointer-events-none">
                                    <Camera size={12} />
                                </div>
                            </div>
                            <div className="text-left hidden md:block">
                                <p className="text-sm font-medium leading-none">{user.name}</p>
                                <p className="text-xs text-[rgb(var(--text-secondary))] mt-1 capitalize">{user.role}</p>
                            </div>
                            <MoreVertical size={16} className="text-[rgb(var(--text-secondary))]" />
                        </button>

                        {/* Dropdown Menu */}
                        {showProfileMenu && (
                            <div className="absolute right-0 top-full mt-2 w-64 glass-card rounded-2xl shadow-xl border border-white/10 p-2 transform origin-top-right animate-in fade-in zoom-in-95 duration-100 z-50">
                                <div className="p-4 border-b border-white/5 mb-2 text-center">
                                    <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[rgb(var(--color-secondary))] to-[rgb(var(--color-accent))] rounded-full flex items-center justify-center text-2xl font-bold mb-3 relative group cursor-pointer" onClick={handlePhotoUpload}>
                                        {user.name.charAt(0)}
                                        <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                            <Camera size={20} />
                                        </div>
                                    </div>
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-xs text-[rgb(var(--text-secondary))]">{user.email}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 text-sm font-medium"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-28 px-6 pb-12 max-w-7xl mx-auto relative z-10">

                {/* Hero / Welcome Section */}
                <div className="mb-12 glass-panel p-8 md:p-12 rounded-3xl relative overflow-hidden border border-white/10 shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-10 transform translate-x-12 -translate-y-12">
                        <BookOpen size={300} />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
                            Welcome back, <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))]">
                                {user.name}
                            </span>
                        </h1>
                        <p className="text-[rgb(var(--text-secondary))] text-lg mb-8 max-w-lg">
                            {user.role === 'teacher'
                                ? "Manage your classrooms, assignments, and connect with your students in real-time."
                                : "Access your courses, join live sessions, and track your progress all in one place."
                            }
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <button
                                onClick={() => setShowModal(true)}
                                className="px-8 py-4 rounded-xl btn-primary font-semibold text-lg hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[rgb(var(--color-primary))]/25 flex items-center gap-3"
                            >
                                <Plus size={22} strokeWidth={2.5} />
                                {user.role === 'teacher' ? "Create Classroom" : "Join Classroom"}
                            </button>

                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--text-secondary))]" size={20} />
                                <input
                                    type="text"
                                    placeholder="Search classes..."
                                    className="pl-12 pr-6 py-4 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))] w-64 transition-all hover:bg-white/10"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grid Header */}
                <div className="flex items-center justify-between mb-8 px-2">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <div className="h-8 w-1 bg-[rgb(var(--color-accent))] rounded-full"></div>
                        Active Classrooms <span className="text-[rgb(var(--text-secondary))] text-base font-normal">({classrooms.length})</span>
                    </h2>
                </div>

                {/* Classrooms Grid */}
                {classrooms.length === 0 ? (
                    <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-white/10 bg-white/5">
                        <div className="w-20 h-20 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <BookOpen size={32} className="text-[rgb(var(--text-secondary))]" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">No classrooms found</h3>
                        <p className="text-[rgb(var(--text-secondary))] mb-8 max-w-sm mx-auto">
                            It looks like you haven't {user.role === 'teacher' ? 'created' : 'joined'} any classes yet.
                            Get started by clicking the button above!
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {classrooms.map((cls) => (
                            <div
                                key={cls._id}
                                onClick={() => navigate(`/classrooms/${cls._id}`)}
                                className="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col h-full min-h-[220px]"
                            >
                                {/* Card Header / Banner */}
                                <div className="h-28 bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-secondary))] p-6 relative overflow-hidden">
                                    {/* Abstract Shapes */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full transform translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500"></div>

                                    <div className="relative z-10 flex justify-between items-start">
                                        <div className="max-w-[80%]">
                                            <h3 className="font-bold text-xl text-white truncate leading-tight mb-1">{cls.name}</h3>
                                            <p className="text-white/80 text-sm font-medium">{cls.subject}</p>
                                        </div>

                                        {/* Teacher Action: Delete */}
                                        {user.role === 'teacher' && (
                                            <button
                                                onClick={(e) => handleDeleteClass(cls._id, e)}
                                                className="p-2 bg-black/20 hover:bg-red-500 text-white rounded-lg backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
                                                title="Delete Class"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="p-6 flex-1 flex flex-col justify-between bg-white/[0.02]">
                                    <div className="flex justify-between items-center mb-6">
                                        <div className="flex items-center gap-2 text-[rgb(var(--text-secondary))] text-sm bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                                            <LogOut size={14} className="rotate-90" />
                                            <span className="font-mono tracking-wider">{cls.code}</span>
                                        </div>

                                        {cls.isActive && (
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold animate-pulse">
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                </span>
                                                LIVE
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between mt-auto">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {/* Avatar Placeholders */}
                                            {[...Array(3)].map((_, i) => (
                                                <div key={i} className="inline-block h-8 w-8 rounded-full ring-2 ring-[rgb(var(--bg-card))] bg-gray-700/50 flex items-center justify-center text-xs text-white/50">
                                                    <Users size={12} />
                                                </div>
                                            ))}
                                            <div className="h-8 w-8 rounded-full ring-2 ring-[rgb(var(--bg-card))] bg-gray-700 flex items-center justify-center text-[10px] text-white/70 font-medium">
                                                +12
                                            </div>
                                        </div>

                                        <button className="text-[rgb(var(--color-primary))] group-hover:text-[rgb(var(--color-secondary))] font-semibold text-sm flex items-center gap-1 transition-colors">
                                            Enter Class <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
                    <div className="glass-panel w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in fade-in zoom-in duration-200 border border-white/10 bg-[rgb(var(--bg-card))]/90">
                        <h2 className="text-2xl font-bold mb-6">
                            {user.role === 'teacher' ? 'Create New Classroom' : 'Join Classroom'}
                        </h2>

                        <form onSubmit={user.role === 'teacher' ? handleCreateClass : handleJoinClass} className="space-y-5">
                            {user.role === 'teacher' ? (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[rgb(var(--text-secondary))] ml-1">Class Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                            placeholder="e.g. Advanced Mathematics"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-[rgb(var(--text-secondary))] ml-1">Subject</label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full px-4 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))]"
                                            placeholder="e.g. Math 101"
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-[rgb(var(--text-secondary))] ml-1">Class Code</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 rounded-xl input-glass focus:ring-2 focus:ring-[rgb(var(--color-primary))] font-mono tracking-widest uppercase text-center text-lg"
                                        placeholder="------"
                                        maxLength={6}
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                    />
                                    <p className="text-xs text-[rgb(var(--text-secondary))] text-center mt-2">Enter the 6-character code provided by your teacher.</p>
                                </div>
                            )}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-[rgb(var(--text-secondary))] font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 rounded-xl btn-primary font-bold shadow-lg"
                                >
                                    {user.role === 'teacher' ? 'Create Class' : 'Join Class'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
