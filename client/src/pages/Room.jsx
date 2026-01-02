import React, { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Peer from "simple-peer";
import { SocketContext } from "../context/SocketContext";
import {
    Mic,
    MicOff,
    Video,
    VideoOff,
    PhoneOff,
    MessageSquare,
    Send,
    Hand,
    Users,
    LayoutGrid,
    MonitorUp,
    X,
    MoreVertical,
    ChevronRight,
    Smile
} from "lucide-react";
import toast from "react-hot-toast";

const Room = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { socket, user } = useContext(SocketContext);

    const userVideo = useRef();
    const peersRef = useRef([]);

    const [stream, setStream] = useState(null);
    const [peers, setPeers] = useState([]);
    const [participants, setParticipants] = useState({});
    const [messages, setMessages] = useState([]);

    const [inputMsg, setInputMsg] = useState("");

    // [PERSISTENCE] Initialize state from localStorage
    const [isMuted, setIsMuted] = useState(() => localStorage.getItem('isMuted') === 'true');
    const [isVideoOff, setIsVideoOff] = useState(() => localStorage.getItem('isVideoOff') === 'true');

    const [handRaised, setHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState(new Set());

    // UI States
    // UI States
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'participants'
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // [PAGINATION] Unified Layout State
    // Page 0: Teacher Only
    // Page 1+: Students (9 per page)
    const [page, setPage] = useState(0);
    const STUDENTS_PER_PAGE = 9;

    // 🔒 Auth check
    useEffect(() => {
        if (!user) navigate("/auth");
    }, [user, navigate]);

    // 🎥 Media + Socket setup
    useEffect(() => {
        if (!user) return;

        // [STABILITY FIX] Always request video to maintain active track in PC
        // Use 'enabled = false' for "Start with Video Off"
        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((currentStream) => {
                const videoTrack = currentStream.getVideoTracks()[0];
                const audioTrack = currentStream.getAudioTracks()[0];

                // Apply initial state
                if (isVideoOff && videoTrack) {
                    videoTrack.enabled = false;
                }

                // For Audio, we can use the same Soft Mute pattern for stability or stick to hardware stop
                // Let's us Soft Mute for consistency and stability if the user reported "working good" for mic we can leave it?
                // But mixing strategies is confusing. Let's try Soft Mute for Mic too?
                // User said "mic is working good", so we touch VIDEO only basically.
                // But we need to make sure we don't break mic.
                if (isMuted && audioTrack) {
                    // Logic from before: we stopped track? 
                    // Let's stick to Soft Mute for video first.
                    // For now, let's keep audio logic as is or simple enabled=false?
                    // Previous init logic for mute:
                    // if (isMuted) currentStream.getAudioTracks().forEach(t => { t.stop(); ... });
                    // If we do that, we have no track to "enable" later.
                    // Let's try Soft Mute for Audio too? It's safer.
                    // But if we want to respect "mic working good", we should emulate previous behavior?
                    // Previous behavior: "Hardware Stop" for Mic.
                    // Let's leave Audio largely alone? 
                    // Wait, if I use replaceTrack for Mic later, I need a 'stream' that has tracks.

                    // Lets Use Soft Mute for Video, keep Audio as is?
                    // Actually, if I change 'stream' reference in toggleVideo, I break toggleMute...
                    // With Soft Mute, I NEVER change 'stream' reference.
                    // So toggleMute needs to handle 'stream' correctly.

                    // Let's just Soft Mute everything for Init phase simplicity
                    if (isMuted && audioTrack) audioTrack.enabled = false;
                }

                setStream(currentStream);
                if (userVideo.current) {
                    userVideo.current.srcObject = currentStream;
                }

                setParticipants((p) => ({ ...p, [socket.id]: { name: user.name, userId: user.id, role: user.role, isMuted, isVideoOff } }));


                socket.emit("join-room", {
                    roomId,
                    userId: user.id,
                    name: user.name,
                    // [SYNC] Send initial state
                    isVideoOff,
                    isMuted
                });

                socket.on("all-users", (users) => {
                    const map = {};
                    users.forEach((u) => {
                        map[u.socketId] = { name: u.name, userId: u.userId, role: u.role, isMuted: u.isMuted || false, isVideoOff: u.isVideoOff || false };
                    });
                    setParticipants((p) => ({ ...p, ...map }));

                    users.forEach((u) => {
                        createPeer(u.socketId, socket.id, currentStream);
                    });
                });

                socket.on("user-joined", ({ signal, callerID }) => {
                    addPeer(signal, callerID, currentStream);
                });

                socket.on("receiving-returned-signal", ({ id, signal }) => {
                    const peerObj = peersRef.current.find((p) => p.peerID === id);
                    if (peerObj && !peerObj.peer.destroyed) {
                        peerObj.peer.signal(signal);
                    }
                });

                socket.on("user-connected", ({ userId, name, socketId, role, isVideoOff, isMuted }) => {
                    setParticipants((p) => ({ ...p, [socketId]: { name, userId, role, isMuted: isMuted || false, isVideoOff: isVideoOff || false } }));
                    toast.success(`${name} joined`);
                });

                socket.on("user-disconnected", ({ userId, socketId }) => {
                    const peerObj = peersRef.current.find((p) => p.peerID === socketId);
                    if (peerObj) peerObj.peer.destroy();

                    peersRef.current = peersRef.current.filter(
                        (p) => p.peerID !== socketId
                    );
                    setPeers((p) => p.filter((x) => x.peerID !== socketId));

                    setParticipants((p) => {
                        const copy = { ...p };
                        delete copy[socketId];
                        return copy;
                    });

                    setRaisedHands((s) => {
                        const n = new Set(s);
                        n.delete(userId);
                        return n;
                    });
                });

                socket.on("receive-message", (msg) => {
                    setMessages((m) => [...m, msg]);
                    // Auto-open chat if closed and message received (optional, maybe just show a badge)
                    if (!showRightPanel) {
                        toast("New message received", { icon: "💬" });
                    }
                });

                socket.on("user-raised-hand", (id) => {
                    setRaisedHands((s) => new Set([...s, id]));
                    // Find name
                    const participant = Object.values(participants).find(p => p.userId === id);
                    const name = participant ? participant.name : 'Someone';

                    // [UX UPDATE] Only notify Teacher
                    if (user.role === 'teacher') {
                        toast(`${name} raised hand`, { icon: "✋" });
                    }
                });

                socket.on("user-lowered-hand", (id) => {
                    setRaisedHands((s) => {
                        const n = new Set(s);
                        n.delete(id);
                        return n;
                    });
                    if (id === user.id) setHandRaised(false);
                });

                socket.on("user-toggled-media", ({ userId, isVideoOff, isMuted }) => {
                    setParticipants((prev) => {
                        const copy = { ...prev };
                        const socketId = Object.keys(copy).find(key => copy[key].userId === userId);
                        if (socketId) {
                            copy[socketId] = { ...copy[socketId], isVideoOff, isMuted };
                        }
                        return copy;
                    });
                });

                socket.on("class-ended", () => {
                    toast.success("Class ended");
                    if (currentStream) {
                        currentStream.getTracks().forEach((t) => t.stop());
                    }
                    navigate("/dashboard");
                });
            })
            .catch(err => {
                console.error("Error accessing media devices:", err);
                toast.error("Could not access camera/microphone");
            });

        return () => {
            // [LEAVE LOGIC] Explicitly tell server we are leaving
            // This handles back button, tab close (sometimes), component unmount
            socket.emit("leave-room", { roomId, userId: user.id });

            socket.removeAllListeners();
            peersRef.current.forEach((p) => p.peer.destroy());
            peersRef.current = [];
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [roomId, user, socket, navigate]);

    // 🔗 Peer helpers
    const createPeer = (userToSignal, callerID, stream) => {
        if (peersRef.current.find((p) => p.peerID === userToSignal)) return;

        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream,
        });

        peer.on("signal", (signal) => {
            socket.emit("sending-signal", {
                userToSignal,
                callerID,
                signal,
            });
        });

        peersRef.current.push({ peerID: userToSignal, peer });
        setPeers((p) => [...p, { peerID: userToSignal, peer }]);
    };

    const addPeer = (signal, callerID, stream) => {
        if (peersRef.current.find((p) => p.peerID === callerID)) return;

        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream,
        });

        peer.on("signal", (s) => {
            socket.emit("returning-signal", { signal: s, callerID });
        });

        peer.signal(signal);

        peersRef.current.push({ peerID: callerID, peer });
        setPeers((p) => [...p, { peerID: callerID, peer }]);
    };

    // 🎛 Controls
    const toggleMute = () => {
        if (!stream) return;
        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) return;

        // Use Soft Mute for Mic as well to ensure stream integrity (no replaceTrack needed)
        // Checks local enabled state logic

        if (isMuted) {
            // TURN ON
            audioTrack.enabled = true;
            setIsMuted(false);
            localStorage.setItem('isMuted', 'false');
            socket.emit("toggle-media", { roomId, userId: user.id, isVideoOff, isMuted: false });
        } else {
            // TURN OFF
            audioTrack.enabled = false;
            setIsMuted(true);
            localStorage.setItem('isMuted', 'true');
            socket.emit("toggle-media", { roomId, userId: user.id, isVideoOff, isMuted: true });
        }
    };

    const toggleVideo = () => {
        if (!stream) return;
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        if (isVideoOff) {
            // TURN ON
            videoTrack.enabled = true;
            setIsVideoOff(false);
            localStorage.setItem('isVideoOff', 'false');
            socket.emit("toggle-media", { roomId, userId: user.id, isVideoOff: false, isMuted });
        } else {
            // TURN OFF
            videoTrack.enabled = false;
            setIsVideoOff(true);
            localStorage.setItem('isVideoOff', 'true');
            socket.emit("toggle-media", { roomId, userId: user.id, isVideoOff: true, isMuted });
        }
    };

    const toggleHand = () => {
        if (user.role === 'teacher') return; // Teachers cannot raise hand
        socket.emit(handRaised ? "lower-hand" : "raise-hand", {
            roomId,
            userId: user.id,
        });
        setHandRaised(!handRaised);
    };

    const handleLowerHand = (targetUserId) => {
        socket.emit("lower-hand", { roomId, userId: targetUserId });
        // Optimistically update local state if needed, but socket event handles it
        setRaisedHands((s) => {
            const n = new Set(s);
            n.delete(targetUserId);
            return n;
        });
    };

    const toggleScreenShare = () => {
        if (isScreenSharing) {
            // STOP SHARING (Manual Click)
            // 1. Stop Screen Tracks
            isScreenSharing.getTracks().forEach(t => t.stop());

            // 2. Restore Webcam Track to Peers
            const webcamTrack = stream ? stream.getVideoTracks()[0] : null;
            // The screen track was what we were sending. accessing it via the screen stream object
            const screenTrack = isScreenSharing.getVideoTracks()[0];

            if (webcamTrack && screenTrack) {
                peersRef.current.forEach(({ peer }) => {
                    // Replace screen track back with webcam track 
                    // Note: third arg 'stream' is the stream we are modifying/sending
                    peer.replaceTrack(screenTrack, webcamTrack, stream);
                });
            }

            // 3. Restore Local Video View
            if (userVideo.current && stream) {
                userVideo.current.srcObject = stream;
            }

            setIsScreenSharing(false);
        } else {
            // START SHARING
            navigator.mediaDevices.getDisplayMedia({ cursor: true })
                .then(screenStream => {
                    const screenTrack = screenStream.getVideoTracks()[0];

                    // Handle user stopping via browser UI (e.g., "Stop Sharing" floating bar)
                    screenTrack.onended = () => {
                        // Restore Webcam Logic (Duplicate of above)
                        if (userVideo.current && stream) userVideo.current.srcObject = stream;

                        const webcamTrack = stream ? stream.getVideoTracks()[0] : null;
                        if (webcamTrack) {
                            peersRef.current.forEach(({ peer }) => {
                                peer.replaceTrack(screenTrack, webcamTrack, stream);
                            });
                        }
                        setIsScreenSharing(false);
                    };

                    const webcamTrack = stream ? stream.getVideoTracks()[0] : null;
                    if (webcamTrack) {
                        peersRef.current.forEach(({ peer }) => {
                            peer.replaceTrack(webcamTrack, screenTrack, stream);
                        });
                    }

                    // Show Screen locally
                    if (userVideo.current) userVideo.current.srcObject = screenStream;

                    setIsScreenSharing(screenStream);
                })
                .catch(err => {
                    console.error("Failed to share screen", err);
                    toast.error("Failed to share screen");
                });
        }
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!inputMsg.trim()) return;

        socket.emit("send-message", {
            roomId,
            user: user.name,
            text: inputMsg,
            time: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            }),
        });

        setInputMsg("");
    };

    const togglePanel = (tab) => {
        if (showRightPanel && activeTab === tab) {
            setShowRightPanel(false);
        } else {
            setActiveTab(tab);
            setShowRightPanel(true);
        }
    };

    const handleLeave = () => {
        if (window.confirm("Are you sure you want to leave the meeting?")) {
            // [LEAVE LOGIC] Explicit emit
            socket.emit("leave-room", { roomId, userId: user.id });

            if (stream) stream.getTracks().forEach(t => t.stop());
            navigate("/dashboard");
        }
    };

    const handleEndClass = () => {
        if (window.confirm("End class for everyone?")) {
            socket.emit("end-class", { roomId, userId: user.id });
            // We wait for the 'class-ended' event to navigate, or do it optimistically.
            // 'class-ended' listener handles the navigation for everyone including sender, usually.
        }
    };

    // Helper to determine active speaker or priority (Teacher always first logic)
    const sortedPeers = [...peers].sort((a, b) => {
        const pA = participants[a.peerID];
        const pB = participants[b.peerID];
        const roleA = pA?.role || 'student';
        const roleB = pB?.role || 'student';
        if (roleA === 'teacher') return -1;
        if (roleB === 'teacher') return 1;
        return 0;
    });

    // [PAGINATION] Peer Categorization with Stable Sorting
    // 1. Identify Teacher Peer (Remote or Self)
    // 2. Identify Student Peers (Remote or Self)

    const isSelfTeacher = user.role === 'teacher';
    const teacherPeer = isSelfTeacher
        ? { isSelf: true, id: socket.id }
        : sortedPeers.find(p => participants[p.peerID]?.role === 'teacher') || null;

    // Collect all student items (Self + Remotes who are not teacher)
    const allStudents = [];

    // Add Self if Student
    if (!isSelfTeacher) {
        allStudents.push({ isSelf: true, id: socket.id });
    }

    // Add Remote Students
    sortedPeers.forEach(p => {
        if (participants[p.peerID]?.role !== 'teacher') {
            allStudents.push({ isSelf: false, ...p });
        }
    });

    // Pagination Calculations
    const totalStudentPages = Math.ceil(Math.max(allStudents.length, 1) / STUDENTS_PER_PAGE);
    const totalPages = 1 + totalStudentPages; // Page 0 is Teacher

    const handleNextPage = () => setPage(p => Math.min(p + 1, totalPages - 1));
    const handlePrevPage = () => setPage(p => Math.max(p - 1, 0));

    // [FIX] Sync local video stream to ref always (it's always rendered)
    useEffect(() => {
        if (userVideo.current && stream && !isVideoOff) {
            userVideo.current.srcObject = stream;
        }
    }, [stream, isVideoOff]);

    return (
        <div className="flex flex-col h-screen bg-[#1c1c1e] text-white overflow-hidden relative">

            {/* MAIN LAYOUT */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* UNIFIED PAGINATED AREA */}
                <div className={`flex-1 flex flex-col items-center justify-center p-4 transition-all duration-300 ${showRightPanel ? 'pr-0' : ''} relative`}>

                    {/* NAVIGATION OVERLAY (Floating on sides or Bottom) */}
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-40 px-4">
                        <button
                            onClick={handlePrevPage}
                            disabled={page === 0}
                            className={`p-3 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur pointer-events-auto transition-all ${page === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        >
                            <ChevronRight className="rotate-180" size={32} />
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={page === totalPages - 1}
                            className={`p-3 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur pointer-events-auto transition-all ${page === totalPages - 1 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                        >
                            <ChevronRight size={32} />
                        </button>
                    </div>

                    {/* CONTENT CONTAINER - Renders ALL, Shows ONE Page */}
                    <div className="w-full h-full max-w-[1600px] relative">

                        {/* PAGE 0: TEACHER (Always Rendered, Hidden if page != 0) */}
                        <div className={`w-full h-full absolute inset-0 transition-opacity duration-300 ${page === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                            {teacherPeer ? (
                                teacherPeer.isSelf ? (
                                    // Self Teacher
                                    <div className="w-full h-full bg-[#2c2c2e] rounded-2xl overflow-hidden shadow-2xl relative border border-blue-500/30">
                                        <video
                                            playsInline
                                            autoPlay
                                            muted
                                            ref={userVideo}
                                            className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoOff ? 'invisible' : 'visible'}`}
                                        />
                                        {isVideoOff && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center text-5xl font-bold">
                                                    {user.name.charAt(0)}
                                                </div>
                                            </div>
                                        )}
                                        <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg text-white font-bold flex items-center gap-2">
                                            You (Teacher) {isMuted && <MicOff size={14} className="text-red-400" />}
                                        </div>
                                    </div>
                                ) : (
                                    // Remote Teacher
                                    <VideoCard
                                        peer={teacherPeer.peer}
                                        name={participants[teacherPeer.peerID]?.name}
                                        isTeacher={true}
                                        isVideoOff={participants[teacherPeer.peerID]?.isVideoOff}
                                        isMuted={participants[teacherPeer.peerID]?.isMuted}
                                        isHandRaised={false}
                                        isSpotlight={true} // Large View
                                    />
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-[#1c1c1e] rounded-2xl border border-white/5">
                                    <p>Waiting for Teacher...</p>
                                </div>
                            )}
                        </div>

                        {/* STUDENT PAGES LOOP */}
                        {/* We render ALL student pages? Or better: Render the Student Grid Container, and populate it with the SLICE of students */}
                        {/* Wait, to keep connection alive we must render Peer components. */}
                        {/* Strategy: Render ALL Student VideoCards in a hidden container? NO. */}
                        {/* render VideoCard... if we unmount it, does it kill audio? YES. */}
                        {/* So we MUST map `allStudents` and assign them to a page, rendering them with `hidden` if wrong page. */}

                        {/* GRID CONTAINER FOR ALL STUDENTS */}
                        <div className={`w-full h-full grid gap-4 auto-rows-fr ${page > 0 ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'} ${
                            // Grid columns for CURRENT PAGE count
                            // We can just pick a standard grid e.g. 3x3
                            'grid-cols-2 md:grid-cols-3 lg:grid-cols-3'
                            }`}>

                            {/* Render ALL Students. Hide those not on current page */}
                            {allStudents.map((student, idx) => {
                                const studentPage = Math.floor(idx / STUDENTS_PER_PAGE) + 1; // 1-based page index
                                const isVisible = page === studentPage;

                                if (!isVisible) {
                                    // Render Hidden (Absolute, tiny) to keep audio alive
                                    // Note: If 'isSelf', we must use `userVideo` ref?
                                    // Problem: userVideo ref is single. We used it above for Teacher View.
                                    // If Self is Student, we use it here.
                                    // If Self is Teacher, we used it above.
                                    // What if Self Student is hidden but Teacher Page is active?
                                    // We need to render Self somewhere.
                                    // Let's modify the Self Render logic:
                                    // If isSelfTeacher, `userVideo` is in Page 0.
                                    // If !isSelfTeacher, `userVideo` is in `allStudents`.

                                    if (student.isSelf) {
                                        return (
                                            <div key="self-hidden" className="hidden">
                                                <video ref={userVideo} autoPlay playsInline muted />
                                            </div>
                                        );
                                    } else {
                                        // Remote Student Hidden
                                        return (
                                            <div key={student.peerID} className="hidden">
                                                <VideoCard
                                                    peer={student.peer}
                                                    name={participants[student.peerID]?.name}
                                                    isVideoOff={participants[student.peerID]?.isVideoOff}
                                                    isMuted={participants[student.peerID]?.isMuted}
                                                />
                                            </div>
                                        );
                                    }
                                }

                                // VISIBLE STUDENT
                                if (student.isSelf) {
                                    return (
                                        <div key="self" className="relative bg-[#2c2c2e] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
                                            <video
                                                playsInline
                                                autoPlay
                                                muted
                                                ref={userVideo}
                                                className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoOff ? 'invisible' : 'visible'}`}
                                            />
                                            {isVideoOff && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center text-3xl font-bold">
                                                        {user.name.charAt(0)}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded text-xs font-bold text-white">You</div>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <VideoCard
                                            key={student.peerID}
                                            peer={student.peer}
                                            name={participants[student.peerID]?.name}
                                            isHandRaised={raisedHands.has(participants[student.peerID]?.userId)}
                                            isTeacher={false}
                                            isVideoOff={participants[student.peerID]?.isVideoOff}
                                            isMuted={participants[student.peerID]?.isMuted}
                                        />
                                    );
                                }
                            })}

                            {/* Empty Placeholders to fill grid if needed (optional) */}
                        </div>
                    </div>

                    {/* Page Indicator */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1.5 rounded-full text-sm font-bold text-white z-50 pointer-events-none">
                        {page === 0 ? "Teacher Stage" : `Students Page ${page} / ${totalStudentPages}`}
                    </div>
                </div>

                {/* RIGHT SIDEBAR (CHAT & PEOPLE) */}
                <div className={`w-[360px] bg-[#1c1c1e] border-l border-white/10 flex flex-col transition-all duration-300 absolute right-0 top-0 bottom-0 z-20 transform ${showRightPanel ? 'translate-x-0' : 'translate-x-full'}`}>

                    {/* Sidebar Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#2c2c2e]">
                        <h2 className="font-bold text-lg">
                            {activeTab === 'chat' ? 'In-Call Messages' : 'Participants'}
                        </h2>
                        <button onClick={() => setShowRightPanel(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Chat Content */}
                    {activeTab === 'chat' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {messages.length === 0 && (
                                    <div className="text-center text-gray-500 py-10">
                                        <MessageSquare size={48} className="mx-auto mb-2 opacity-20" />
                                        <p>No messages yet. Start the conversation!</p>
                                    </div>
                                )}
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex flex-col ${msg.user === user.name ? 'items-end' : 'items-start'}`}>
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-300">{msg.user}</span>
                                            <span className="text-[10px] text-gray-500">{msg.time}</span>
                                        </div>
                                        <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] ${msg.user === user.name
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-[#3a3a3c] text-white rounded-bl-none'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Area */}
                            <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-[#2c2c2e]">
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        className="w-full bg-[#3a3a3c] text-white rounded-full pl-5 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                                        value={inputMsg}
                                        onChange={(e) => setInputMsg(e.target.value)}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!inputMsg.trim()}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}

                    {/* Participants Content */}
                    {activeTab === 'participants' && (
                        <div className="flex-1 overflow-y-auto p-2">
                            {/* Display count */}
                            <div className="px-4 py-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                                {Object.keys(participants).length} Participants
                            </div>
                            {Object.entries(participants)
                                .sort(([, a], [, b]) => {
                                    // 1. Teacher first
                                    const roleA = (a.role === 'teacher') ? 1 : 0;
                                    const roleB = (b.role === 'teacher') ? 1 : 0;
                                    if (roleA !== roleB) return roleB - roleA;

                                    // 2. Hand Raised second
                                    const handA = raisedHands.has(a.userId) ? 1 : 0;
                                    const handB = raisedHands.has(b.userId) ? 1 : 0;
                                    if (handA !== handB) return handB - handA;

                                    // 3. Alphabetical / Stable
                                    return (a.name || "").localeCompare(b.name || "");
                                })
                                .map(([sId, participant]) => {
                                    const name = participant.name || "Unknown";
                                    const userId = participant.userId;
                                    const isUserMuted = participant.isMuted;

                                    return (
                                        <div key={sId} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center font-bold text-white relative">
                                                    {name.charAt(0)}
                                                    {participant.role === 'teacher' && (
                                                        <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] px-1 rounded-full border border-[#1c1c1e]">HOST</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{name} {userId === user.id && '(You)'}</p>
                                                    <p className="text-xs text-green-400">Connected</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {raisedHands.has(userId) && (
                                                    <>
                                                        <Hand size={16} className="text-yellow-400 animate-pulse" />
                                                        {user.role === 'teacher' && (
                                                            <button
                                                                onClick={() => handleLowerHand(userId)}
                                                                className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-[10px] text-white"
                                                                title="Lower Hand"
                                                            >
                                                                Lower
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                {isUserMuted ? (
                                                    <MicOff size={16} className="text-red-400" />
                                                ) : (
                                                    <Mic size={16} className="text-gray-500" />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>


            {/* BOTTOM CONTROL BAR */}
            <div className="h-24 bg-[#1c1c1e] border-t border-white/10 flex items-center justify-between px-6 z-30 relative shadow-2xl">

                {/* Left: Info */}
                <div className="hidden md:flex flex-col">
                    <span className="font-bold text-lg">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs text-gray-400">Room: {roomId}</span>
                </div>

                {/* Center Controls */}
                <div className="flex items-center gap-3 md:gap-6 absolute left-1/2 -translate-x-1/2">
                    <ControlButton
                        onClick={toggleMute}
                        isActive={!isMuted}
                        activeIcon={<Mic />}
                        inactiveIcon={<MicOff />}
                        label="Mute"
                        activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                        inactiveClass="bg-red-500/20 text-red-500 hover:bg-red-500/30"
                    />

                    <ControlButton
                        onClick={toggleVideo}
                        isActive={!isVideoOff}
                        activeIcon={<Video />}
                        inactiveIcon={<VideoOff />}
                        label="Stop Video"
                        activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                        inactiveClass="bg-red-500/20 text-red-500 hover:bg-red-500/30"
                    />

                    {user.role === 'teacher' && (
                        <ControlButton
                            onClick={toggleScreenShare}
                            isActive={!!isScreenSharing}
                            activeIcon={<MonitorUp size={22} />}
                            label={isScreenSharing ? "Stop Share" : "Share"}
                            activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c] text-green-500"
                            inactiveClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                        />
                    )}

                    {user.role === 'student' && (
                        <ControlButton
                            onClick={toggleHand}
                            isActive={!handRaised}
                            activeIcon={<Hand />}
                            inactiveIcon={<Hand fill="currentColor" className="text-yellow-400" />}
                            label={handRaised ? "Lower Hand" : "Raise Hand"}
                            activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                            inactiveClass="bg-[#3a3a3c] text-yellow-500"
                        />
                    )}

                    {user.role === 'teacher' ? (
                        <button
                            onClick={handleEndClass}
                            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-all ml-4"
                        >
                            End Class
                        </button>
                    ) : (
                        <button
                            onClick={handleLeave}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-xl font-bold transition-all ml-4"
                        >
                            Leave
                        </button>
                    )}
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                    {/* Return to Stage shortcuts */}
                    {page > 0 && (
                        <button
                            onClick={() => setPage(0)}
                            className="bg-[#2c2c2e] hover:bg-[#3a3a3c] text-white px-3 py-2 rounded-lg text-sm font-bold transition-all"
                        >
                            Return to Stage
                        </button>
                    )}
                    <ControlButton
                        onClick={() => togglePanel('participants')}
                        isActive={!(showRightPanel && activeTab === 'participants')}
                        activeIcon={<Users size={20} />}
                        inactiveIcon={<Users size={20} className="text-blue-500" />}
                        label="People"
                        activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                        inactiveClass="bg-blue-500/20 text-blue-500"
                        badge={Object.keys(participants).length}
                    />
                    <ControlButton
                        onClick={() => togglePanel('chat')}
                        isActive={!(showRightPanel && activeTab === 'chat')}
                        activeIcon={<MessageSquare size={20} />}
                        inactiveIcon={<MessageSquare size={20} className="text-blue-500" />}
                        label="Chat"
                        activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                        inactiveClass="bg-blue-500/20 text-blue-500"
                        badge={messages.length > 0 ? messages.length : null}
                    />
                </div>

            </div> {/* End Bottom Control Bar */}

        </div> /* End Main Flex Container */
    );
};

const ControlButton = React.memo(({ onClick, isActive, activeIcon, inactiveIcon, label, activeClass, inactiveClass, badge }) => (
    <div className="flex flex-col items-center gap-1 group">
        <button
            onClick={onClick}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 relative ${isActive ? activeClass : inactiveClass}`}
        >
            {isActive ? activeIcon : (inactiveIcon || activeIcon)}
            {badge && (
                <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#1c1c1e] font-bold">
                    {badge}
                </div>
            )}
        </button>
        <span className="text-[10px] text-gray-400 group-hover:text-white transition-colors font-medium">{label}</span>
    </div>
));

const VideoCard = React.memo(({ peer, name = "Unknown", isHandRaised, isTeacher, isVideoOff, isMuted }) => {
    const ref = useRef();
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        // [FIX] Blank Video Issue:
        // Peer 'stream' event only fires once. If the component re-mounts (e.g., layout toggle),
        // we might miss it. We must check if the peer already has a stream and attach it manually.
        const existingStream = peer._remoteStreams ? peer._remoteStreams[0] : null;
        if (existingStream && ref.current) {
            ref.current.srcObject = existingStream;
        }

        peer.on("stream", (stream) => {
            if (ref.current) ref.current.srcObject = stream;

            // Audio Analysis for Active Speaker
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (stream.getAudioTracks().length > 0) {
                    const analyser = audioContext.createAnalyser();
                    const microphone = audioContext.createMediaStreamSource(stream);
                    const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);

                    analyser.smoothingTimeConstant = 0.8;
                    analyser.fftSize = 1024;

                    microphone.connect(analyser);
                    analyser.connect(scriptProcessor);
                    scriptProcessor.connect(audioContext.destination);

                    scriptProcessor.onaudioprocess = () => {
                        const array = new Uint8Array(analyser.frequencyBinCount);
                        analyser.getByteFrequencyData(array);
                        const arraySum = array.reduce((a, value) => a + value, 0);
                        const average = arraySum / array.length;
                        // Threshold for speech
                        setIsSpeaking(average > 10); // Sensitivity threshold
                    };

                    // Cleanup specific to this effect instance
                    return () => {
                        scriptProcessor.disconnect();
                        analyser.disconnect();
                        microphone.disconnect();
                        if (audioContext.state !== 'closed') audioContext.close();
                    };
                }
            } catch (e) {
                console.error("Audio Analysis Error:", e);
            }
        });
    }, [peer]);

    return (
        <div className={`relative bg-[#2c2c2e] rounded-xl overflow-hidden shadow-lg ring-1 transition-all duration-200 
            ${isSpeaking ? 'ring-4 ring-green-500 scale-[1.02] z-10' : 'ring-white/10'} 
            ${isHandRaised ? 'ring-2 ring-yellow-500' : ''}`}>

            {/* [FIX] Always render video to keep audio playing, even if "Video Off" UI is shown */}
            <video
                playsInline
                autoPlay
                ref={ref}
                className={`w-full h-full object-cover ${isVideoOff ? 'invisible' : 'visible'}`}
            />

            {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1c1c1e] z-10">
                    <div className="flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-3xl font-bold text-white mb-2 shadow-xl">
                            {name.charAt(0)}
                        </div>
                        <span className="text-gray-400 text-sm font-medium">Video Off</span>
                    </div>
                </div>
            )}

            {/* Name Tag */}
            <div className={`absolute bottom-3 left-3 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 z-30 ${isTeacher ? 'bg-blue-600/80 text-white' : 'bg-black/50'}`}>
                {name}
                {isTeacher && <span className="text-[10px] bg-white text-blue-600 px-1 rounded font-bold uppercase">HOST</span>}
                {isMuted && <MicOff size={12} className="text-red-400" />}
            </div>

            {isHandRaised && (
                <div className="absolute top-3 left-3 bg-yellow-500 text-black px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg animate-bounce z-30">
                    <Hand size={12} fill="currentColor" /> Raised Hand
                </div>
            )}
        </div>
    );
});

export default Room;
