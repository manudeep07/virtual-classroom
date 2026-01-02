import React, { useContext, useState, useEffect } from 'react';
import { SocketContext } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import { Plus, LogOut, Users, BookOpen, ArrowRight, Trash2, Camera, Search, MoreVertical } from 'lucide-react';
import toast from 'react-hot-toast';
import NotificationBell from '../components/NotificationBell';

const Dashboard = () => {
    const { user, setUser } = useContext(SocketContext);
    const navigate = useNavigate();
    const [classrooms, setClassrooms] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ name: '', subject: '', code: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');


    // Notification State
    const [notifications, setNotifications] = useState(() => {
        const saved = localStorage.getItem('notifications');
        return saved ? JSON.parse(saved) : [];
    });
    const [newUpdates, setNewUpdates] = useState({}); // Map of classroomId -> boolean (for Badge)
    const { socket } = useContext(SocketContext);

    // Profile State
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    useEffect(() => {
        localStorage.setItem('notifications', JSON.stringify(notifications));
    }, [notifications]);

    useEffect(() => {
        if (!user) {
            navigate('/auth');
            return;
        }
        fetchClassrooms();
    }, [user, navigate]);

    // Socket Listeners for Dashboard
    useEffect(() => {
        if (!socket) {
            console.log('[DEBUG] Dashboard: Socket not initialized');
            return;
        }
        if (classrooms.length === 0) {
            console.log('[DEBUG] Dashboard: No classrooms to join yet');
            return;
        }

        console.log('[DEBUG] Dashboard: Joining classroom channels', classrooms.map(c => c._id));

        socket.onAny((event, ...args) => {
            console.log(`[DEBUG] Socket Event Received: ${event}`, args);
        });

        // Join room for each classroom to get updates
        classrooms.forEach(cls => {
            socket.emit('join-classroom-dashboard', { roomId: cls._id });
        });

        // Listeners
        const handleAnnouncement = (announcement) => {
            console.log('[DEBUG] Dashboard received announcement:', announcement);
            // Find class name
            const cls = classrooms.find(c => c._id === announcement.classroomId);
            const className = cls ? cls.name : 'Classroom';

            // Add notification
            const newNotif = {
                type: 'announcement',
                message: `New announcement in ${className}: "${announcement.content.substring(0, 30)}${announcement.content.length > 30 ? '...' : ''}"`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                classroomId: announcement.classroomId,
                read: false
            };

            setNotifications(prev => [newNotif, ...prev]);
            setNewUpdates(prev => ({ ...prev, [announcement.classroomId]: true }));
            toast(newNotif.message, { icon: '📢' });
        };

        const handleMaterial = (material) => {
            const cls = classrooms.find(c => c._id === material.classroomId);
            const className = cls ? cls.name : 'Classroom';

            const newNotif = {
                type: 'material',
                message: `New material posted in ${className}: ${material.title}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                classroomId: material.classroomId,
                read: false
            };

            setNotifications(prev => [newNotif, ...prev]);
            setNewUpdates(prev => ({ ...prev, [material.classroomId]: true }));
            toast(newNotif.message, { icon: '📚' });
        };

        const handleAssignment = (assignment) => {
            const cls = classrooms.find(c => c._id === assignment.classroomId);
            const className = cls ? cls.name : 'Classroom';

            const newNotif = {
                type: 'assignment',
                message: `New assignment in ${className}: ${assignment.title}`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                classroomId: assignment.classroomId,
                read: false
            };

            setNotifications(prev => [newNotif, ...prev]);
            setNewUpdates(prev => ({ ...prev, [assignment.classroomId]: true }));
            toast(newNotif.message, { icon: '📝' });
        };

        socket.on('announcement-created', handleAnnouncement);
        socket.on('material-created', handleMaterial);
        socket.on('assignment-created', handleAssignment);

        return () => {
            socket.off('announcement-created', handleAnnouncement);
            socket.off('material-created', handleMaterial);
            socket.off('assignment-created', handleAssignment);
        };
    }, [socket, classrooms]);

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

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const loadingToast = toast.loading('Uploading photo...');
            const res = await fetch(`http://localhost:5001/api/users/${user.id}/avatar`, {
                method: 'POST',
                body: formData
            });

            let data;
            try {
                data = await res.json();
            } catch (e) {
                // Response was not JSON (e.g. 404 HTML)
                toast.dismiss(loadingToast);
                toast.error(`Server Error: ${res.status} (Please restart backend)`);
                console.error("Non-JSON response:", res);
                return;
            }

            toast.dismiss(loadingToast);

            if (res.ok) {
                toast.success('Photo updated!');
                // Update local user state
                const updatedUser = { ...user, avatar: data.fileUrl };
                setUser(updatedUser);
                localStorage.setItem('user', JSON.stringify(updatedUser));
            } else {
                toast.error(data.msg || 'Upload failed');
            }
        } catch (err) {
            console.error(err);
            toast.error('Connection failed');
        }
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
                    <NotificationBell
                        notifications={notifications}
                        onClear={() => setNotifications([])}
                        onOpen={() => {
                            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                        }}
                    />

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className="flex items-center gap-3 hover:bg-white/5 p-2 pr-4 rounded-full transition-all border border-transparent hover:border-white/10"
                        >
                            <div className="w-9 h-9 bg-gradient-to-br from-[rgb(var(--color-secondary))] to-[rgb(var(--color-accent))] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md relative overflow-hidden group">
                                {user.name.charAt(0)}

                            </div>
                            <div className="text-left hidden md:block">
                                <p className="text-sm font-medium leading-none">{user.name}</p>
                                <p className="text-xs text-[rgb(var(--text-secondary))] mt-1 capitalize">{user.role}</p>
                            </div>

                        </button>

                        {/* Dropdown Menu */}
                        {showProfileMenu && (
                            <div className="absolute right-0 top-full mt-2 w-64 glass-card rounded-2xl shadow-xl border border-white/10 p-2 transform origin-top-right animate-in fade-in zoom-in-95 duration-100 z-50">
                                <div className="p-4 border-b border-white/5 mb-2 text-center relative">
                                    <div className="w-20 h-20 mx-auto rounded-full p-1 border-2 border-[rgb(var(--color-primary))] relative group">
                                        <div className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-[rgb(var(--color-secondary))] to-[rgb(var(--color-accent))] flex items-center justify-center text-2xl font-bold text-white relative">
                                            {user.avatar ? (
                                                <img src={`http://localhost:5001${user.avatar}`} alt="Profile" className="w-full h-full object-cover" />
                                            ) : (
                                                user.name.charAt(0)
                                            )}
                                        </div>

                                        {/* Pencil/Edit Icon */}
                                        <button
                                            onClick={() => document.getElementById('avatar-upload').click()}
                                            className="absolute bottom-0 right-0 bg-white text-black p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer z-10"
                                            title="Update Photo"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        </button>
                                        <input
                                            type="file"
                                            id="avatar-upload"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handlePhotoUpload}
                                        />
                                    </div>
                                    <p className="font-medium mt-3">{user.name}</p>
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
                                    placeholder="Search classes... (Press Enter)"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && setSearchQuery(searchInput)}
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
                {classrooms.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.subject.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed border-white/10 bg-white/5">
                        <div className="w-20 h-20 mx-auto bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <BookOpen size={32} className="text-[rgb(var(--text-secondary))]" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">No classrooms found</h3>
                        <p className="text-[rgb(var(--text-secondary))] mb-8 max-w-sm mx-auto">
                            {searchQuery ? "No matches found for your search." : (user.role === 'teacher' ? 'It looks like you haven\'t created any classes yet.' : 'It looks like you haven\'t joined any classes yet.')}
                            {!searchQuery && " Get started by clicking the button above!"}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {classrooms.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.subject.toLowerCase().includes(searchQuery.toLowerCase())).map((cls) => (
                            <div
                                key={cls._id}
                                onClick={() => {
                                    // Clear badge when entering
                                    setNewUpdates(prev => {
                                        const next = { ...prev };
                                        delete next[cls._id];
                                        return next;
                                    });
                                    navigate(`/classrooms/${cls._id}`)
                                }}
                                className="glass-card rounded-2xl overflow-hidden cursor-pointer group flex flex-col h-full min-h-[220px]"
                            >
                                {/* Card Header / Banner */}
                                <div className="h-28 bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-secondary))] p-6 relative overflow-hidden">
                                    {/* Abstract Shapes */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full transform translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-500"></div>

                                    <div className="relative z-10 flex justify-between items-start">
                                        <div className="max-w-[80%]">
                                            <h3 className="font-bold text-xl text-white truncate leading-tight mb-1 flex items-center gap-2">
                                                {cls.name}
                                                {newUpdates[cls._id] && (
                                                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                                                        NEW
                                                    </span>
                                                )}
                                            </h3>
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
                                            <span>Class code:</span>
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

                                            <div className="relative inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/5 border border-white/10 shadow-sm group-hover:scale-110 transition-transform">
                                                <Users size={16} className="text-[rgb(var(--color-primary))]" />
                                                <span className="absolute -bottom-1 -right-1 bg-gradient-to-r from-[rgb(var(--color-primary))] to-[rgb(var(--color-secondary))] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-[#1c1c1e]">
                                                    {cls.studentIds?.length || 0}
                                                </span>
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
