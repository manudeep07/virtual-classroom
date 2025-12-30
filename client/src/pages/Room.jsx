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
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const [handRaised, setHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState(new Set());

    // UI States
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [activeTab, setActiveTab] = useState("chat"); // 'chat' or 'participants'
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    // 🔒 Auth check
    useEffect(() => {
        if (!user) navigate("/auth");
    }, [user, navigate]);

    // 🎥 Media + Socket setup
    useEffect(() => {
        if (!user) return;

        navigator.mediaDevices
            .getUserMedia({ video: true, audio: true })
            .then((currentStream) => {
                setStream(currentStream);
                if (userVideo.current) {
                    userVideo.current.srcObject = currentStream;
                }

                setParticipants((p) => ({ ...p, [user.id]: user.name }));

                socket.emit("join-room", {
                    roomId,
                    userId: user.id,
                    name: user.name,
                });

                socket.on("all-users", (users) => {
                    const map = {};
                    users.forEach((u) => (map[u.userId] = u.name));
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

                socket.on("user-connected", ({ userId, name }) => {
                    setParticipants((p) => ({ ...p, [userId]: name }));
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
                        delete copy[userId];
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
                    toast(`${participants[id] || 'Someone'} raised hand`, { icon: "✋" });
                });

                socket.on("user-lowered-hand", (id) => {
                    setRaisedHands((s) => {
                        const n = new Set(s);
                        n.delete(id);
                        return n;
                    });
                    if (id === user.id) setHandRaised(false);
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
        if (stream) {
            stream.getAudioTracks()[0].enabled = isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks()[0].enabled = isVideoOff;
            setIsVideoOff(!isVideoOff);
        }
    };

    const toggleHand = () => {
        socket.emit(handRaised ? "lower-hand" : "raise-hand", {
            roomId,
            userId: user.id,
        });
        setHandRaised(!handRaised);
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
            if (stream) stream.getTracks().forEach(t => t.stop());
            navigate("/dashboard");
        }
    };

    return (
        <div className="flex flex-col h-screen bg-[#1c1c1e] text-white overflow-hidden relative">

            {/* MAIN LAYOUT */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* VIDEO GRID AREA */}
                <div className={`flex-1 p-4 flex items-center justify-center transition-all duration-300 ${showRightPanel ? 'pr-0' : ''}`}>
                    <div className="w-full h-full max-w-[1600px] flex items-center justify-center">
                        <div className={`grid gap-4 w-full h-full auto-rows-fr transition-all duration-300 ${
                            // Dynamic Grid Layout based on peer count
                            peers.length === 0 ? 'grid-cols-1' :
                                peers.length === 1 ? 'grid-cols-1 md:grid-cols-2' :
                                    peers.length <= 3 ? 'grid-cols-1 md:grid-cols-2' :
                                        peers.length <= 5 ? 'grid-cols-2 md:grid-cols-3' :
                                            'grid-cols-3 md:grid-cols-4'
                            }`}>

                            {/* SELF VIDEO */}
                            <div className="relative bg-[#2c2c2e] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 group">
                                {isVideoOff ? (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white mb-2">
                                            {user.name.charAt(0)}
                                        </div>
                                    </div>
                                ) : (
                                    <video
                                        muted
                                        autoPlay
                                        playsInline
                                        ref={userVideo}
                                        className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
                                    />
                                )}

                                {/* Name Tag */}
                                <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2">
                                    <span>You {isMuted && '(Muted)'}</span>
                                    {isMuted && <MicOff size={12} className="text-red-400" />}
                                </div>

                                {/* Hand Raised Indicators */}
                                {handRaised && (
                                    <div className="absolute top-3 left-3 bg-yellow-500/90 text-black px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg animate-bounce">
                                        <Hand size={12} fill="currentColor" /> Raised Hand
                                    </div>
                                )}
                            </div>

                            {/* PEERS VIDEOS */}
                            {peers.map((p) => (
                                <VideoCard
                                    key={p.peerID}
                                    peer={p.peer}
                                    name={participants[p.peerID]}
                                    isHandRaised={raisedHands.has(p.peerID)}
                                />
                            ))}
                        </div>
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
                            {Object.entries(participants).map(([id, name]) => (
                                <div key={id} className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl group px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center font-bold text-white">
                                            {name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{name} {id === user.id && '(You)'}</p>
                                            <p className="text-xs text-green-400">Connected</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {raisedHands.has(id) && <Hand size={16} className="text-yellow-400 animate-pulse" />}
                                        <Mic size={16} className="text-gray-500" />
                                    </div>
                                </div>
                            ))}
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

                    {/* Share Screen (Placeholder) */}
                    <ControlButton
                        onClick={() => toast("Screen sharing coming soon!")}
                        isActive={true}
                        activeIcon={<MonitorUp size={22} />}
                        label="Share"
                        activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c] text-green-500"
                    />

                    <ControlButton
                        onClick={toggleHand}
                        isActive={!handRaised}
                        activeIcon={<Hand />}
                        inactiveIcon={<Hand fill="currentColor" className="text-yellow-400" />}
                        label="Raise Hand"
                        activeClass="bg-[#3a3a3c] hover:bg-[#4a4a4c]"
                        inactiveClass="bg-[#3a3a3c] text-yellow-500"
                    />

                    <button
                        onClick={handleLeave}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-bold transition-all ml-4"
                    >
                        Leave
                    </button>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
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
                        badge={messages.length > 0 ? messages.length : null} // Simple count, ideally unread count
                    />
                </div>
            </div>

        </div>
    );
};

const ControlButton = ({ onClick, isActive, activeIcon, inactiveIcon, label, activeClass, inactiveClass, badge }) => (
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
);

const VideoCard = ({ peer, name = "Unknown", isHandRaised }) => {
    const ref = useRef();

    useEffect(() => {
        peer.on("stream", (stream) => {
            ref.current.srcObject = stream;
        });
    }, [peer]);

    return (
        <div className={`relative bg-[#2c2c2e] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 ${isHandRaised ? 'ring-2 ring-yellow-500' : ''}`}>
            <video autoPlay playsInline ref={ref} className="w-full h-full object-cover" />

            {/* Name Tag */}
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg text-sm font-medium">
                {name}
            </div>

            {isHandRaised && (
                <div className="absolute top-3 left-3 bg-yellow-500 text-black px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg animate-bounce">
                    <Hand size={12} fill="currentColor" /> Raised Hand
                </div>
            )}
        </div>
    );
};

export default Room;
