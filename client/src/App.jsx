import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Peer from 'peerjs';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import MessageArea from './components/MessageArea';
import Settings from './components/Settings';
import CallModal from './components/CallModal';
import LiquidCursor from './components/LiquidCursor';

// Smart environment detection for server URL
// Development: Uses localhost:3001
// Production: Uses current page origin (same domain as served files)
// Override: Set VITE_SERVER_URL environment variable for custom configuration
const getServerUrl = () => {
    // Check for explicit override
    if (import.meta.env.VITE_SERVER_URL) {
        return import.meta.env.VITE_SERVER_URL;
    }

    // Development mode: use localhost
    if (import.meta.env.DEV) {
        return 'http://localhost:3001';
    }

    // Production mode: use same origin as the current page
    // This works because the built client is served from server/public
    return window.location.origin;
};

const ENDPOINT = getServerUrl();

function App() {
    const [user, setUser] = useState(null);
    const [socket, setSocket] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'settings'
    const [callState, setCallState] = useState({ incoming: null, active: null, video: false });
    const [myPeerId, setMyPeerId] = useState(null);
    // Mobile state
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Browser detection for Safari/iOS WebRTC fixes
    const [isSafari] = useState(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
    const [isIOS] = useState(/iPad|iPhone|iPod/.test(navigator.userAgent));


    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const remoteScreenStreamRef = useRef(null);

    // Detect screen resize for responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
            if (window.innerWidth > 768) {
                setSidebarOpen(false); // Auto-close sidebar on desktop
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load user from storage
    useEffect(() => {
        const saved = localStorage.getItem('minhe_user');
        if (saved) {
            const parsed = JSON.parse(saved);
            // CRITICAL FIX: Ensure userId exists (migration for existing sessions)
            if (!parsed.userId && parsed.id) {
                parsed.userId = parsed.id;
                localStorage.setItem('minhe_user', JSON.stringify(parsed));
            }
            setUser(parsed);
        }
    }, []);

    // Socket & Peer Init
    useEffect(() => {
        if (user) {
            const newSocket = io(ENDPOINT);
            // Register user with socket
            const userId = user.userId || user.id; // handle both cases
            console.log('[APP] Joining socket as user:', userId);
            newSocket.emit('join', userId);

            // Wait for join before setting global socket? 
            // setSocket(newSocket) happens after connection, but join is emitted immediately.
            // This is race-condition prone if server processes 'set_status' before 'join'?
            // But 'set_status' is user triggered, so 'join' definitely happened first.

            // Set socket state
            setSocket(newSocket);
            // PeerJS configuration - dynamically set host/port based on environment
            const peerConfig = import.meta.env.DEV
                ? { host: 'localhost', port: 3001, path: '/peerjs' }
                : { host: window.location.hostname, port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80), path: '/peerjs', secure: window.location.protocol === 'https:' };

            const peer = new Peer(undefined, peerConfig);
            peer.on('open', (id) => {
                setMyPeerId(id);
                console.log('My Peer ID:', id);
                // Broadcast peer ID to socket so others can call
                newSocket.emit('register_peer', { userId: user.userId, peerId: id });
            });

            peer.on('call', (call) => {
                if (call.metadata?.type === 'screen') {
                    // ... (existing screen logic)
                }

                // Group Call identification
                const isGroup = !!call.metadata?.groupId;
                const groupId = call.metadata?.groupId;

                // Incoming Call - Use robust fallback strategy
                const videoCall = call.metadata?.type !== 'audio'; // Assume video unless specified (or passed in metadata)

                // 1. ADVANCED
                const getAdvancedConstraints = () => ({
                    video: videoCall ? (isIOS ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : true) : false,
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
                });

                // 2. BASIC
                const getBasicConstraints = () => ({ video: videoCall, audio: true });

                // 3. AUDIO ONLY
                const getAudioOnlyConstraints = () => ({ video: false, audio: true });

                const getMedia = async () => {
                    try {
                        return await navigator.mediaDevices.getUserMedia(getAdvancedConstraints());
                    } catch (err1) {
                        try {
                            return await navigator.mediaDevices.getUserMedia(getBasicConstraints());
                        } catch (err2) {
                            if (videoCall && (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError')) {
                                return await navigator.mediaDevices.getUserMedia(getAudioOnlyConstraints());
                            }
                            throw err2;
                        }
                    }
                };

                // Don't auto-answer. Just set incoming call state and wait for user to click "Answer"
                // The stream is acquired only when they click Answer (in answerCall function) on some apps, 
                // BUT PeerJS architecture is easier if we get stream now or just set state.
                // Actually, wait... current logic gets stream IMMEDIATELY upon receiving call signal, before user accepts.
                // This is bad UX (camera light turns on before they toggle answer!).
                // BETTER: Just set state, get media later.

                console.log('[CALL] Incoming call from:', call.metadata?.username, call);

                // HYPER-DETAIL: Start a timeout timer for ignored calls (Busy)
                const callTimeout = setTimeout(() => {
                    setCallState(prev => {
                        if (prev && prev.incoming && prev.incoming.peer === call.peer) {
                            console.log('[CALL] Call ignored (Busy)');
                            socket.emit('register_call_event', {
                                fromUserId: user.userId, // The one who ignored it
                                toUserId: prev.callerUserId || call.metadata?.userId || call.peer, // Approximate ID from Peer ID if possible, or just the peer id
                                type: videoCall ? 'video' : 'voice',
                                status: 'Busy'
                            });
                            call.close();
                            return { ...prev, incoming: null };
                        }
                        return prev;
                    });
                }, 30000); // 30 seconds timeout

                setCallState(prev => ({
                    ...prev,
                    incoming: call,
                    incomingTimeout: callTimeout,
                    video: videoCall,
                    callerName: call.metadata?.username || 'Unknown User',
                    callerAvatar: call.metadata?.avatar,
                    callerUserId: call.metadata?.userId // Store for event registration
                }));
            });
            peerRef.current = peer;

            return () => {
                newSocket.disconnect();
                peer.destroy();
            };
        }
    }, [user, isIOS]);

    const [isIdle, setIsIdle] = useState(false);

    // Idle Detection & Heartbeat
    useEffect(() => {
        if (!user || !socket) return;

        let idleTimer;
        let heartbeatInterval;

        const resetIdleTimer = () => {
            // Only reset to 'online' if we were idle AND the user hasn't manually set a special status
            // If user is 'invisible' or 'dnd', we don't want to force them to 'online' just because they moved the mouse.
            // We mainly want to prevent 'offline' -> 'online' if they are supposed to be 'invisible'.

            if (isIdle) {
                setIsIdle(false);
                // Respect manual status preference
                const currentManualStatus = user.status || 'online';
                if (currentManualStatus !== 'invisible') {
                    // If they were 'dnd', keep 'dnd'. If 'online', go 'online'.
                    // Use the persisted status to restore.
                    socket.emit('set_status', { status: currentManualStatus });
                    handleUpdateUser({ status: currentManualStatus });
                } else {
                    // Even if active, if invisible, reassure server we are invisible (or just do nothing)
                    socket.emit('set_status', { status: 'invisible' });
                }
            }

            clearTimeout(idleTimer);
            // Set idle after 2 minutes (120000 ms)
            idleTimer = setTimeout(() => {
                // If user manually set DnD or Invisible, DO NOT force offline
                // We trust they want that status even if idle.
                if (user.status === 'dnd' || user.status === 'invisible') {
                    // Do nothing, keep status.
                    return;
                }

                setIsIdle(true);
                socket.emit('set_status', { status: 'offline' });
                handleUpdateUser({ status: 'offline' });
            }, 120000);
        };

        // Events that count as "activity"
        window.addEventListener('mousemove', resetIdleTimer);
        window.addEventListener('keypress', resetIdleTimer);
        window.addEventListener('click', resetIdleTimer);
        window.addEventListener('scroll', resetIdleTimer);

        // Initial start
        resetIdleTimer();

        // Heartbeat to server every 30s to verify connection
        heartbeatInterval = setInterval(() => {
            if (socket.connected) {
                if (!isIdle) socket.emit('heartbeat');
            }
        }, 30000);

        return () => {
            clearTimeout(idleTimer);
            clearInterval(heartbeatInterval);
            window.removeEventListener('mousemove', resetIdleTimer);
            window.removeEventListener('keypress', resetIdleTimer);
            window.removeEventListener('click', resetIdleTimer);
            window.removeEventListener('scroll', resetIdleTimer);
        };
    }, [user, socket, isIdle]);

    // Socket Listeners
    useEffect(() => {
        if (socket) {
            // Update local friends list when status changes
            socket.on('user_status_change', ({ userId, status }) => {
                // This event can be listened to in Sidebar or here to update global state if needed
                // For now, we rely on Sidebar's listener or a context could be used.
            });

            // Listen for new message notifications
            socket.on('new_message_notification', ({ from, message }) => {
                // Show browser notification
                if (Notification.permission === 'granted') {
                    new Notification('New Message', {
                        body: message.content || 'You have a new message',
                        icon: '/logo.png',
                        tag: `msg-${message.id}`
                    });
                }

                // Play notification sound (optional)
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSBATTK/m77FcFgU+lu/zxnMoCTCA0fPdizsIGGS56+SdTA0PUrXo6qVYEwdBnOLxvXAkBSuA0PbRgzYIG2W+7uygUBELTrHo7ahbGAU5j9X0znkuBSl40PXWgjgOHW3A8OKcSg8PTrTq7qldFgo+muH3wmwmBSh90PPXQAI');
                audio.play().catch(() => { });
            });

            socket.on('call_user', ({ from, signal, video }) => {
                // This is redundant if using PeerJS 'call' event for signaling,
                // but if we do custom signaling:
            });

            socket.on('call_termination', () => {
                console.log('[CALL] Received termination signal from other party');
                if (callState.incomingTimeout) clearTimeout(callState.incomingTimeout);
                if (callState.active && typeof callState.active === 'object' && callState.active.close) {
                    callState.active.close();
                }
                if (callState.incoming && callState.incoming.close) {
                    callState.incoming.close();
                }
                if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
                setCallState({ incoming: null, active: null, video: false, incomingTimeout: null });
            });

            socket.on('group_call_started', ({ groupId, fromUserId }) => {
                if (fromUserId === user.userId) return;
                setCallState({
                    id: groupId,
                    type: 'group',
                    callerName: 'Incoming Group Call...',
                    incoming: true,
                    video: false
                });
            });

            socket.on('group_peer_discovered', ({ userId, peerId }) => {
                // Log discovery - CallModal will handle the calling
                console.log(`[GROUP] Peer discovered: ${userId} (${peerId})`);
            });

            return () => {
                socket.off('new_message_notification');
                socket.off('call_user');
                socket.off('call_termination');
            };
        }
    }, [socket]);

    // Notification Request
    useEffect(() => {
        if ("Notification" in window) {
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        }
    }, []);

    const handleLogin = (userData) => {
        setUser(userData);
        localStorage.setItem('minhe_user', JSON.stringify(userData));
    };

    const handleRegister = (userData) => {
        setUser(userData);
        localStorage.setItem('minhe_user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        setSocket(null);
        setSelectedUser(null);
        localStorage.removeItem('minhe_user');
    };

    const handleUpdateUser = (updates) => {
        setUser(prev => ({ ...prev, ...updates }));
    };

    const handleStatusChange = (newStatus) => {
        if (socket) {
            socket.emit('set_status', { status: newStatus });
        }
        // CRITICAL FIX: Update local state so Idle Timer knows our manual preference!
        setUser(prev => ({ ...prev, status: newStatus }));
    };

    // --- ROBUST MEDIA FALLBACK STRATEGY ---
    const getMediaStream = async (preferVideo = true) => {
        // 1. ADVANCED Constraints (Best Quality)
        const getAdvancedConstraints = () => ({
            video: preferVideo ? (isIOS ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : true) : false,
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        // 2. BASIC Constraints (Compatibility)
        const getBasicConstraints = () => ({
            video: preferVideo ? true : false,
            audio: true
        });

        // 3. AUDIO ONLY Constraints (Fallback if no camera)
        const getAudioOnlyConstraints = () => ({
            video: false,
            audio: true
        });

        try {
            // Try 1: Advanced
            console.log('[MEDIA] Trying ADVANCED constraints');
            if (!preferVideo) return await navigator.mediaDevices.getUserMedia(getAudioOnlyConstraints());

            try {
                return await navigator.mediaDevices.getUserMedia(getAdvancedConstraints());
            } catch (err) {
                console.warn('[MEDIA] Advanced failed:', err.name);
                throw err; // Go to fallback
            }
        } catch (err) {
            try {
                // Try 2: Basic
                console.log('[MEDIA] Trying BASIC constraints');
                return await navigator.mediaDevices.getUserMedia(getBasicConstraints());
            } catch (err2) {
                console.warn('[MEDIA] Basic failed:', err2.name);

                // Try 3: Audio Only (only if we were trying video and it failed with device error)
                if (preferVideo && (err2.name === 'NotFoundError' || err2.name === 'DevicesNotFoundError' || err2.name === 'NotReadableError')) {
                    console.log('[MEDIA] Video failed, switching to AUDIO ONLY');
                    alert('Camera issue detected. Switching to voice call.');
                    return await navigator.mediaDevices.getUserMedia(getAudioOnlyConstraints());
                }
                throw err2; // Re-throw if it wasn't a camera issue
            }
        }
    };

    const handleMediaError = (err) => {
        console.error('[MEDIA ERROR]', err);
        if (err.name === 'NotAllowedError') {
            alert('Please ALLOW Camera/Microphone access to call.');
        } else if (err.name === 'NotFoundError') {
            alert('No camera/microphone found.');
        } else {
            alert(`Context blocked: ${err.message}`);
        }
    };

    // Call Logic with Safari/iOS support
    const startCall = (targetUserId, video, type = 'direct') => {
        console.log('[CALL] startCall triggered:', { targetUserId, video, type, hasPeer: !!peerRef.current, hasSocket: !!socket });

        if (type === 'group') {
            socket.emit('group_call_init', { groupId: targetUserId, fromUserId: user.userId });
            setCallState({
                id: targetUserId,
                type: 'group',
                callerName: 'Group Call',
                active: true,
                video: false // Audio-only group calls for now
            });
            return;
        }

        if (!peerRef.current) {
            console.error('[CALL] Peer not ready');
            alert('Call system not ready. Please wait a moment and try again.');
            return;
        }

        if (!socket) {
            console.error('[CALL] Socket not connected');
            alert('Connection not ready. Please refresh the page and try again.');
            return;
        }

        // First, get the peer ID from the server
        console.log('[CALL] Requesting peer ID for user:', targetUserId);
        socket.emit('get_peer_id', { userId: targetUserId }, (response) => {
            console.log('[CALL] Received peer ID response:', response);

            if (!response || !response.peerId || response.peerId === 'null') {
                console.log('[CALL] User offline, simulating call attempt');

                // Show Calling UI for 6 seconds to feel like a real "ringing out"
                setCallState({
                    incoming: null,
                    active: true,
                    video: video,
                    callerName: selectedUser.username,
                    callerAvatar: selectedUser.avatar,
                    targetUserId: targetUserId,
                    isSimulated: true
                });

                setTimeout(() => {
                    setCallState(prev => {
                        if (prev && prev.isSimulated) {
                            socket.emit('register_call_event', {
                                fromUserId: user.userId,
                                toUserId: targetUserId,
                                type: video ? 'video' : 'voice',
                                status: 'Busy'
                            });
                            return { incoming: null, active: null, video: false };
                        }
                        return prev;
                    });
                }, 6000);

                return;
            }

            const targetPeerId = response.peerId;
            console.log('[CALL] Calling peer:', targetPeerId);

            // Validate peer ID
            if (!targetPeerId || targetPeerId === null || targetPeerId === 'null') {
                console.error('[CALL] Invalid peer ID received:', targetPeerId);
                return;
            }

            getMediaStream(video)
                .then((stream) => {
                    localStreamRef.current = stream;

                    // Check if we actually got video tracks (in case of fallback)
                    const hasVideo = stream.getVideoTracks().length > 0;
                    // setVideo(hasVideo); // This is local state, not global. CallState will handle it.

                    // Make the call with METADATA (username/avatar)
                    const call = peerRef.current.call(targetPeerId, stream, {
                        metadata: {
                            username: user.username,
                            avatar: user.avatar,
                            userId: user.userId, // CRITICAL for event registration
                            type: hasVideo ? 'video' : 'audio' // Indicate call type
                        }
                    });
                    console.log('[CALL] Call object created:', call);

                    if (!call) {
                        console.error('[CALL] Call object is undefined!');
                        alert('Failed to initiate call. Check connection.');
                        stream.getTracks().forEach(track => track.stop());
                        return;
                    }

                    setCallState({
                        incoming: null,
                        active: call,
                        video: hasVideo,
                        targetUserId: targetUserId,
                        // Set remote user info for the UI
                        callerName: selectedUser?.username || 'Unknown User',
                        callerAvatar: selectedUser?.avatar
                    });

                    call.on('error', (err) => {
                        console.error('[CALL] Call error:', err);
                        alert(`Call error: ${err.message || 'Unknown error'}`);
                        endCall();
                    });

                    call.on('stream', (remoteStream) => {
                        console.log('[CALL] Received remote stream:', remoteStream);
                        remoteStreamRef.current = remoteStream;
                        // CRITICAL: Force re-render so CallModal sees the new stream
                        setCallState(prev => ({ ...prev, hasRemoteStream: true }));
                    });

                    call.on('close', () => {
                        console.log('[CALL] Call closed');
                        endCall();
                    });
                })
                .catch(handleMediaError);
        });
    };


    const answerCall = () => {
        const isGroup = callState.type === 'group';
        const call = callState.incoming;
        if (!call) return;

        // Determine if incoming call has video based on metadata or default
        const isVideoCall = isGroup ? callState.video : (call.metadata?.type !== 'audio');

        getMediaStream(isVideoCall)
            .then((stream) => {
                localStreamRef.current = stream;

                // Check if we actually got video tracks
                const hasVideo = stream.getVideoTracks().length > 0;

                // For 1:1 calls, answer the peer connection. For groups, discovery handles it.
                if (!isGroup && call.answer) {
                    call.answer(stream);
                }

                // CRITICAL: Clear timeout if answered!
                if (callState.incomingTimeout) clearTimeout(callState.incomingTimeout);

                setCallState(prev => ({
                    ...prev,
                    incoming: null,
                    incomingTimeout: null,
                    active: isGroup ? true : call,
                    video: hasVideo,
                    callerName: prev.callerName,
                    callerAvatar: prev.callerAvatar,
                    callerUserId: prev.callerUserId
                }));

                if (!isGroup && call.on) {
                    call.on('stream', (remoteStream) => {
                        remoteStreamRef.current = remoteStream;
                        setCallState(prev => ({ ...prev, hasRemoteStream: true }));
                    });

                    call.on('close', () => {
                        console.log('[CALL] Call closed');
                        endCall();
                    });
                    call.on('error', (e) => {
                        console.error('[CALL] Answer Call error:', e);
                        endCall();
                    });
                }
            })
            .catch(handleMediaError);
    };

    const rejectCall = () => {
        if (callState.incoming) {
            // CRITICAL: Clear timeout!
            if (callState.incomingTimeout) clearTimeout(callState.incomingTimeout);

            // Register Canceled event as requested
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });

            socket.emit('register_call_event', {
                fromUserId: user.userId,
                toUserId: callState.callerUserId || callState.incoming.metadata?.userId || callState.incoming.peer,
                type: callState.video ? 'video' : 'voice',
                status: `cancelled the call at [${dateStr}:${timeStr}]`
            });

            // NEW: Signal the other party to close their modal
            socket.emit('call_termination', {
                toUserId: callState.callerUserId || callState.incoming.metadata?.userId || callState.incoming.peer
            });

            callState.incoming.close();
        }
        setCallState({ ...callState, incoming: null, incomingTimeout: null });
    };

    const endCall = () => {
        if (callState.active) {
            // Determine who to signal (targetUserId for outgoing, callerUserId for incoming that reached 'active' state)
            const otherPartyId = callState.targetUserId || callState.callerUserId;
            if (otherPartyId) {
                socket.emit('call_termination', { toUserId: otherPartyId });
            }

            // Register Canceled only if it was an outgoing attempt that didn't connect
            // (Simulated calls or states where it's still 'Calling...')
            if (callState.targetUserId && !callState.hasRemoteStream) {
                socket.emit('register_call_event', {
                    fromUserId: user.userId,
                    toUserId: callState.targetUserId,
                    type: callState.video ? 'video' : 'voice',
                    status: 'Canceled'
                });
            }

            if (typeof callState.active === 'object' && callState.active.close) {
                callState.active.close();
            }
        }
        if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
        if (remoteStreamRef.current) remoteStreamRef.current.getTracks().forEach(t => t.stop());
        if (remoteScreenStreamRef.current) remoteScreenStreamRef.current.getTracks().forEach(t => t.stop());

        setCallState({ incoming: null, active: null, video: false, incomingTimeout: null, hasRemoteStream: false, hasRemoteScreen: null });
    };

    return (
        <div style={{ display: 'flex', height: '100%', width: '100%', background: 'var(--bg-dark)', color: 'white' }}>
            <LiquidCursor />

            {!user ? (
                <Login onLogin={handleLogin} onRegister={handleRegister} />
            ) : (
                <>
                    {/* Mobile Hamburger Menu Button */}
                    {isMobile && !sidebarOpen && (
                        <button
                            className="mobile-menu-btn"
                            onClick={() => setSidebarOpen(true)}
                            aria-label="Open menu"
                            style={{
                                animation: 'pulse 2s infinite'
                            }}
                        >
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                        </button>
                    )}

                    {/* Sidebar Overlay for Mobile (click outside to close) - MUST BE BEFORE SIDEBAR */}
                    {isMobile && sidebarOpen && (
                        <div
                            style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                zIndex: 999
                            }}
                            onClick={() => setSidebarOpen(false)}
                        />
                    )}

                    {/* Sidebar Container - RESPONSIVE */}
                    <div
                        className={`sidebar ${isMobile && sidebarOpen ? 'mobile-open' : ''}`}
                        style={{
                            width: isMobile ? '100%' : '350px',
                            flexShrink: 0,
                            height: '100%',
                            borderRight: '1px solid var(--border)'
                        }}
                    >
                        <Sidebar
                            user={user}
                            socket={socket}
                            onSelectUser={(u) => {
                                setSelectedUser(u);
                                setActiveTab('chat');
                                if (isMobile) setSidebarOpen(false); // Close sidebar on mobile after selection
                            }}
                            selectedUserId={selectedUser?.id}
                            activeTab={activeTab}
                            onTabChange={setActiveTab}
                            onLogout={handleLogout}
                        />
                    </div>

                    {/* Main Content Area - FLEX GROW & FULL HEIGHT */}
                    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                        {/* Dynamic Content */}
                        {activeTab === 'settings' ? (
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <Settings
                                    user={user}
                                    onChangeStatus={handleStatusChange}
                                    onUpdateUser={handleUpdateUser}
                                />
                            </div>
                        ) : (
                            selectedUser ? (
                                <MessageArea
                                    currentUser={user}
                                    selectedUser={selectedUser}
                                    socket={socket}
                                    onCallUser={startCall}
                                />
                            ) : (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-chat)' }}>
                                    <div style={{ textAlign: 'center', opacity: 0.5 }}>
                                        <h2 style={{ fontSize: '2rem', background: 'linear-gradient(to right, var(--accent), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>MINHE</h2>
                                        <p>Select a chat to start messaging</p>
                                    </div>
                                </div>
                            )
                        )}
                    </div>

                    {/* Unified Call Modal */}
                    {(callState.incoming || callState.active) && (
                        <CallModal
                            currentUser={user}
                            socket={socket}
                            callState={callState}
                            peer={peerRef.current}
                            localStreamRef={localStreamRef}
                            remoteStreamRef={remoteStreamRef}
                            remoteScreenStreamRef={remoteScreenStreamRef}
                            onAnswer={answerCall}
                            onReject={rejectCall}
                            onEnd={endCall}
                        />
                    )}
                </>
            )}
        </div>
    );
}

export default App;
