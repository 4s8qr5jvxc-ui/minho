import React, { useEffect, useRef, useState, useLayoutEffect, memo } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Maximize2, Minimize2, GripHorizontal, ScreenShare, StopCircle, Settings, Monitor, Volume2, Loader2, Activity, Zap, RefreshCw, Layers, Signal, ShieldCheck, Cpu, HardDrive } from 'lucide-react';

// Memoized Participant Card for Hyper-Fast Performance
// Memoized Voice Card for 50-Person Matrix
// Shared Audio Context (Lazy Initialized to prevent early crash)
let globalAudioCtx = null;
const getAudioCtx = () => {
    if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return globalAudioCtx;
};

const VoiceMatrixCard = memo(({ name, avatar, isSpeaking, isMuted, stream, colorIdx }) => {
    const canvasRef = useRef(null);
    const audioRef = useRef(null);
    const analyserRef = useRef(null);
    const colors = ['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'];
    const accentColor = colors[colorIdx % colors.length];

    useEffect(() => {
        if (stream && audioRef.current) {
            audioRef.current.srcObject = stream;
            audioRef.current.play().catch(() => { });

            const ctx = getAudioCtx();
            let source = null;
            let analyser = null;

            try {
                if (ctx.state === 'suspended') ctx.resume();
                source = ctx.createMediaStreamSource(stream);
                analyser = ctx.createAnalyser();
                analyser.fftSize = 128;
                source.connect(analyser);
                analyserRef.current = analyser;
            } catch (e) { console.warn('[AUDIO] Shared context attach failed:', e); }

            return () => {
                if (source) source.disconnect();
                if (analyser) analyser.disconnect();
                analyserRef.current = null;
            };
        }
    }, [stream]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        const bufferLength = 64;
        const dataArray = new Uint8Array(bufferLength);

        let animation;
        const draw = () => {
            if (analyserRef.current && isSpeaking) {
                analyserRef.current.getByteFrequencyData(dataArray);
            } else {
                dataArray.fill(0);
            }

            ctx.clearRect(0, 0, 100, 100);
            const level = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
            const radius = 33 + (level / 255) * 22;

            // 1. NEON VOID GLOW
            if (isSpeaking) {
                const grad = ctx.createRadialGradient(50, 50, 5, 50, 50, radius + 15);
                grad.addColorStop(0, `${accentColor}44`);
                grad.addColorStop(0.5, `${accentColor}11`);
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(50, 50, radius + 15, 0, Math.PI * 2); ctx.fill();
            }

            // 2. CYBER PULSE RING
            ctx.beginPath();
            ctx.arc(50, 50, radius, 0, Math.PI * 2);
            ctx.strokeStyle = isSpeaking ? accentColor : 'rgba(255,255,255,0.06)';
            ctx.lineWidth = isSpeaking ? 3 : 1;
            ctx.setLineDash(isSpeaking ? [] : [2, 4]);
            ctx.stroke();

            // 3. WAVEFORM ORBITALS
            if (isSpeaking) {
                ctx.setLineDash([]);
                for (let i = 0; i < 4; i++) {
                    const r = radius + 3 + (i * 4);
                    const alpha = Math.max(0, 0.6 - (i * 0.15));
                    ctx.beginPath();
                    for (let a = 0; a < Math.PI * 2; a += 0.2) {
                        const freqIdx = Math.floor((a / (Math.PI * 2)) * bufferLength);
                        const push = (dataArray[freqIdx] / 255) * 8;
                        const x = 50 + (r + push) * Math.cos(a + (i * 0.5));
                        const y = 50 + (r + push) * Math.sin(a + (i * 0.5));
                        if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.closePath();
                    ctx.strokeStyle = `${accentColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
            animation = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(animation);
    }, [isSpeaking, accentColor]);

    return (
        <div style={{
            width: '95px', height: '125px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            background: isSpeaking ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '22px', padding: '14px', position: 'relative',
            border: isSpeaking ? `1px solid ${accentColor}` : '1px solid rgba(255,255,255,0.04)',
            boxShadow: isSpeaking ? `0 0 35px ${accentColor}22` : 'rgba(0,0,0,0.3) 0 10px 20px',
            transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
            cursor: 'pointer', overflow: 'hidden'
        }}>
            {/* CYBER BACKGROUND ELEMENTS */}
            {isSpeaking && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(45deg, ${accentColor}05, transparent)`, zIndex: 0 }} />}
            <div style={{ position: 'absolute', top: 5, left: 10, width: '20px', height: '1px', background: isSpeaking ? accentColor : 'rgba(255,255,255,0.1)', opacity: 0.5 }} />

            <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }} width={100} height={100} />
            <audio ref={audioRef} autoPlay style={{ display: 'none' }} />

            <div style={{ position: 'relative', width: '52px', height: '52px', borderRadius: '50%', padding: '2px', background: isSpeaking ? accentColor : 'rgba(255,255,255,0.1)', transition: 'all 0.4s', zIndex: 2 }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#08080c', border: '2px solid #08080c' }}>
                    {avatar ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: '1rem', color: isSpeaking ? accentColor : 'rgba(255,255,255,0.4)', background: 'linear-gradient(135deg, #181825, #11111a)' }}>{name.charAt(0).toUpperCase()}</div>}
                </div>
                {isSpeaking && <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `1px solid ${accentColor}`, opacity: 0.4, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />}
            </div>

            <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                <span style={{ fontSize: '0.65rem', color: isSpeaking ? 'white' : 'rgba(255,255,255,0.6)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                <div style={{ fontSize: '0.45rem', color: isSpeaking ? accentColor : 'rgba(255,255,255,0.2)', fontWeight: 800, letterSpacing: '1px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    {isSpeaking ? (
                        <>
                            <div style={{ width: '4px', height: '4px', borderRadius: '1px', background: accentColor, animation: 'pulse 0.5s infinite' }} />
                            SYNCING_UPLINK
                        </>
                    ) : 'SECURE_NODE'}
                </div>
            </div>

            <div style={{ position: 'absolute', top: 5, right: 8, display: 'flex', gap: '4px' }}>
                {isMuted && <MicOff size={10} color="#ef4444" />}
                <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: isSpeaking ? accentColor : 'rgba(255,255,255,0.1)' }} />
            </div>
        </div>
    );
});

const ParticipantCard = memo(({ name, avatar, isSpeaking, isMuted, stream, isLocal, canvasRef, small, overlay, isExpanded, hasVideo, isRemoteSharing, localVideoRef, remoteVideoRef }) => {
    return (
        <div style={{
            flex: small ? 'none' : 1,
            width: small ? '110px' : 'auto',
            height: small ? '110px' : (isExpanded ? '180px' : '80px'),
            position: overlay ? 'absolute' : 'relative',
            top: overlay ? '15px' : 'auto',
            right: overlay ? '15px' : 'auto',
            background: 'rgba(20, 20, 30, 0.9)',
            backdropFilter: 'blur(15px)',
            borderRadius: '24px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: isExpanded && !small ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid',
            borderColor: isSpeaking ? '#9476f5' : 'rgba(255,255,255,0.1)',
            boxShadow: isSpeaking ? '0 0 30px rgba(148, 118, 245, 0.3)' : 'none',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            padding: small ? '0.5rem' : (isExpanded ? '1rem' : '0.5rem'),
            gap: '1rem',
            zIndex: overlay ? 10 : 1,
            willChange: 'transform, border-color, box-shadow',
            transform: 'translate3d(0,0,0)'
        }}>
            {hasVideo && stream && !small && !overlay && (
                <video
                    ref={isLocal ? localVideoRef : (isRemoteSharing ? null : remoteVideoRef)}
                    autoPlay
                    playsInline
                    muted={isLocal}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, zIndex: 1, opacity: 0.7 }}
                />
            )}
            <canvas ref={canvasRef} style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '40px', zIndex: 3, pointerEvents: 'none', opacity: 0.6 }} width={200} height={40} />

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: (isExpanded && !small) || overlay ? 'column' : 'row', alignItems: 'center', gap: '1rem' }}>
                <div style={{ position: 'relative', width: small ? '40px' : (isExpanded ? '70px' : '40px'), height: small ? '40px' : (isExpanded ? '70px' : '40px') }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: '2px', background: isSpeaking ? '#9476f5' : 'rgba(255,255,255,0.15)', boxShadow: isSpeaking ? '0 0 20px #9476f5' : 'none', transition: '0.3s' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#12121a' }}>
                            {avatar ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: small ? '1rem' : (isExpanded ? '1.8rem' : '1rem'), fontWeight: 900, color: 'white' }}>{name.charAt(0).toUpperCase()}</div>}
                        </div>
                    </div>
                </div>
                {(!small || overlay) && <strong style={{ fontSize: isExpanded ? '0.9rem' : '0.8rem', color: 'white', whiteSpace: 'nowrap', textShadow: '0 2px 10px rgba(0,0,0,0.8)', fontWeight: 800 }}>{name}</strong>}
            </div>
        </div>
    );
});

function CallModal({ currentUser, socket, callState, peer, localStreamRef, remoteStreamRef, remoteScreenStreamRef, onAnswer, onReject, onEnd }) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const gridLocalVideoRef = useRef(null);
    const gridRemoteVideoRef = useRef(null);
    const sideLocalVideoRef = useRef(null);
    const sideRemoteVideoRef = useRef(null);
    const maxLocalVideoRef = useRef(null);
    const maxRemoteVideoRef = useRef(null);
    const audioOutRef = useRef(null);
    const sharedScreenRef = useRef(null);
    const windowRef = useRef(null);

    // UI State
    const [isMuted, setIsMuted] = useState(false);
    const [isRemoteMuted, setIsRemoteMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(callState.video);
    const [callStatus, setCallStatus] = useState('Connecting...');
    const [duration, setDuration] = useState(0);
    const [isExpanded, setIsExpanded] = useState(true);

    // Screen Share State
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [showShareSettings, setShowShareSettings] = useState(false);
    const [shareSystemAudio, setShareSystemAudio] = useState(false);
    const [isRemoteSharing, setIsRemoteSharing] = useState(false);
    const [isStreamLoading, setIsStreamLoading] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const screenStreamRef = useRef(null);
    const screenCallRef = useRef(null);
    const [resyncKey, setResyncKey] = useState(0);
    const [remoteParticipants, setRemoteParticipants] = useState({}); // userId -> {stream, username, avatar, isSpeaking, isMuted}

    // Audio Activity State
    const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
    const [isRemoteSpeaking, setIsRemoteSpeaking] = useState(false);

    // Connection Reliability State
    const [iceState, setIceState] = useState('new');
    const [signalStrength, setSignalStrength] = useState(3);
    const [isUplinkSyncing, setIsUplinkSyncing] = useState(false);

    // --- DERIVED STATE (CRITICAL: Declare before use in hooks) ---
    const isIncoming = !!callState?.incoming;
    const isConnected = callStatus === 'Connected';
    const otherPartyId = callState?.targetUserId || callState?.callerUserId;
    const formatDuration = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    const myPeerId = peer?.id;

    // --- AUDIO ANALYSIS & VISUALIZER CORE ---
    const localCanvasRef = useRef(null);
    const remoteCanvasRef = useRef(null);

    const remoteParticipantsRef = useRef({});

    // --- GROUP CALL ENGINE ---
    useEffect(() => {
        if (isConnected && callState.type === 'group' && socket && myPeerId) {
            console.log(`[GROUP] Joining matrix for ${callState.id}`);
            socket.emit('group_call_peer_id', {
                groupId: callState.id,
                userId: currentUser.userId,
                peerId: myPeerId,
                username: currentUser.username,
                avatar: currentUser.avatar
            });

            const handlePeerDiscovered = ({ userId, peerId: remotePeerId, username, avatar }) => {
                if (userId === currentUser.userId) return;
                // Use ref to check for existing participants to avoid stale closure
                if (remoteParticipantsRef.current[userId]) return;

                console.log(`[GROUP] Calling discovered peer ${userId} (${username})...`);
                const call = peer.call(remotePeerId, localStreamRef.current, {
                    metadata: { type: 'voice', groupId: callState.id, userId: currentUser.userId, username: currentUser.username, avatar: currentUser.avatar }
                });

                if (call) {
                    call.on('stream', (stream) => {
                        const newParticipant = { stream, username: username || `User ${userId}`, avatar: avatar, isSpeaking: false, isMuted: false };
                        remoteParticipantsRef.current[userId] = newParticipant;
                        setRemoteParticipants(prev => ({
                            ...prev,
                            [userId]: newParticipant
                        }));
                    });
                }
            };

            const handlePeerLeave = ({ userId }) => {
                console.log(`[GROUP] Peer left: ${userId}`);
                delete remoteParticipantsRef.current[userId];
                setRemoteParticipants(prev => {
                    const next = { ...prev };
                    delete next[userId];
                    return next;
                });
            };

            socket.on('group_peer_discovered', handlePeerDiscovered);
            socket.on('group_call_leave', handlePeerLeave);
            return () => {
                socket.off('group_peer_discovered', handlePeerDiscovered);
                socket.off('group_call_leave', handlePeerLeave);
            };
        }
    }, [isConnected, callState.type, socket, myPeerId, localStreamRef, currentUser]);

    // Handle incoming calls while in a group
    useEffect(() => {
        if (!peer) return;
        const handleIncoming = (call) => {
            if (call.metadata?.groupId === callState?.id) {
                console.log(`[GROUP] Answering incoming group link from ${call.metadata.username}`);
                call.answer(localStreamRef.current);
                call.on('stream', (stream) => {
                    const newParticipant = { stream, username: call.metadata.username, isSpeaking: false, isMuted: false };
                    remoteParticipantsRef.current[call.metadata.userId] = newParticipant;
                    setRemoteParticipants(prev => ({
                        ...prev,
                        [call.metadata.userId]: newParticipant
                    }));
                });
            }
        };
        peer.on('call', handleIncoming);
        return () => peer.off('call', handleIncoming);
    }, [peer, callState?.id, localStreamRef]);

    useEffect(() => {
        return () => {
            // CRITICAL CLEANUP: Stop all remote streams when leaving group to prevent leaks
            console.log('[GROUP] Tearing down participants...');
            Object.values(remoteParticipantsRef.current || {}).forEach(p => {
                if (p.stream) p.stream.getTracks().forEach(t => t.stop());
            });
            remoteParticipantsRef.current = {};
        };
    }, []);

    useEffect(() => {
        let audioContext;
        let animationFrame;

        const drawVisualizer = (canvas, analyser, color) => {
            if (!canvas || !analyser) return;
            const ctx = canvas.getContext('2d');
            analyser.fftSize = 64;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const renderFrame = () => {
                analyser.getByteFrequencyData(dataArray);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const barWidth = (canvas.width / bufferLength) * 2.5;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * canvas.height;
                    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
                    gradient.addColorStop(0, 'rgba(148, 118, 245, 0.2)');
                    gradient.addColorStop(1, color);
                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
                    x += barWidth;
                }
                animationFrame = requestAnimationFrame(renderFrame);
            };
            renderFrame();
        };

        const setupAnalyser = (stream, callback, canvas, color) => {
            if (!stream || stream.getAudioTracks().length === 0) return null;
            try {
                if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') audioContext.resume();
                const source = audioContext.createMediaStreamSource(stream);
                const analyser = audioContext.createAnalyser();
                source.connect(analyser);
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const checkAudio = () => {
                    if (audioContext?.state === 'closed') return;
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < 16; i++) sum += dataArray[i];
                    callback(sum / 16 > 25);
                    animationFrame = requestAnimationFrame(checkAudio);
                };
                checkAudio();
                if (canvas) drawVisualizer(canvas, analyser, color);
                return analyser;
            } catch (e) {
                console.warn('[Audio] Analyser setup failed:', e);
                return null;
            }
        };

        if (callStatus === 'Connected') {
            if (localStreamRef?.current) setupAnalyser(localStreamRef.current, setIsLocalSpeaking, localCanvasRef.current, '#9476f5');
            if (remoteStreamRef?.current) setupAnalyser(remoteStreamRef.current, setIsRemoteSpeaking, remoteCanvasRef.current, '#4da3ff');
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
            if (audioContext) audioContext.close();
        };
    }, [isConnected]); // Use simple boolean to avoid loop

    // --- SOCKET SIGNALING ---
    useEffect(() => {
        if (!socket) return;
        socket.on('peer_mute_change', ({ isMuted }) => setIsRemoteMuted(isMuted));
        socket.on('peer_screen_share_change', ({ isSharing }) => {
            setIsRemoteSharing(isSharing);
            if (isSharing) {
                setIsStreamLoading(true);
                setResyncKey(k => k + 1);
                // The loading will now be cleared by onPlaying event
            } else {
                setIsStreamLoading(false);
                setResyncKey(k => k + 1);
            }
        });
        return () => {
            socket.off('peer_mute_change');
            socket.off('peer_screen_share_change');
        };
    }, [socket]);

    // --- ROBUST WEB-RTC CONNECTION MONITORING ---
    useEffect(() => {
        if (callState.active && callState.active.peerConnection) {
            const pc = callState.active.peerConnection;

            const updateState = () => {
                setIceState(pc.iceConnectionState);
                if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                    setTimeout(() => {
                        setCallStatus('Connected');
                        setIsUplinkSyncing(false);
                    }, 500);
                }
            };

            pc.oniceconnectionstatechange = updateState;
            pc.onconnectionstatechange = updateState;

            pc.ontrack = (event) => {
                console.log('[CALL] Track detected:', event.track.kind);
                setResyncKey(k => k + 1);

                // Fallback: Ensure remoteStreamRef is populated if missing
                if (!remoteStreamRef.current && event.streams && event.streams[0]) {
                    remoteStreamRef.current = event.streams[0];
                }

                if (callStatus !== 'Connected') {
                    setIsUplinkSyncing(true);
                    setTimeout(() => {
                        setCallStatus('Connected');
                        setIsUplinkSyncing(false);
                    }, 1200);
                }
            };

            const pollInterval = setInterval(() => {
                if (pc.iceConnectionState === 'connected') {
                    setSignalStrength(Math.floor(Math.random() * 2) + 2);
                }
            }, 5000);

            return () => {
                pc.oniceconnectionstatechange = null;
                pc.onconnectionstatechange = null;
                clearInterval(pollInterval);
            };
        }
    }, [callState.active, callStatus]);

    useEffect(() => {
        if (callState.hasRemoteStream && callStatus !== 'Connected') setCallStatus('Connected');
        if (callState.incoming) setCallStatus('Incoming Call...');
        else if (callState.active) {
            if (callState.isSimulated) setCallStatus('Ringing...');
            else if (callState.type === 'group') setCallStatus('Connected'); // Group calls connect immediately locally
            else if (callState.hasRemoteStream || (remoteStreamRef?.current && remoteStreamRef.current.active)) setCallStatus('Connected');
            else if (iceState === 'connected' || iceState === 'completed') setCallStatus('Connected');
            else setCallStatus('Establishing Connection...');
        }
    }, [callState.incoming, callState.active, callState.hasRemoteStream, remoteStreamRef, iceState, callState.type]);

    useEffect(() => {
        let interval;
        if (callStatus === 'Connected') interval = setInterval(() => setDuration(prev => prev + 1), 1000);
        return () => clearInterval(interval);
    }, [callStatus]);

    // --- BULLETPROOF STREAM ATTACHMENT ---
    useLayoutEffect(() => {
        let loadingTimeout;

        const attachStream = () => {
            // 0. Fallback Stream Capture (If ref is null but PC has streams)
            if (!remoteStreamRef?.current && callState?.active?.peerConnection) {
                const streams = callState.active.peerConnection.getRemoteStreams();
                if (streams && streams[0]) {
                    console.log('[CALL] Captured remote stream from PeerConnection fallback');
                    remoteStreamRef.current = streams[0];
                }
            }

            // 1. Audio Consumption (Always active if connected)
            if (remoteStreamRef?.current && audioOutRef.current) {
                audioOutRef.current.srcObject = remoteStreamRef.current;
                audioOutRef.current.play().catch(() => { });
            }

            // 2. Local Camera Preview (Grid or Side)
            const activeLocalRef = isMaximized ? maxLocalVideoRef : ((isSharingScreen || isRemoteSharing) ? sideLocalVideoRef : gridLocalVideoRef);
            if (activeLocalRef?.current && localStreamRef?.current) {
                activeLocalRef.current.srcObject = localStreamRef.current;
                activeLocalRef.current.play().catch(() => { });
            }

            // 3. Remote Video Preview (Grid or Side)
            const activeRemoteRef = isMaximized ? maxRemoteVideoRef : ((isSharingScreen || isRemoteSharing) ? sideRemoteVideoRef : gridRemoteVideoRef);
            if (activeRemoteRef?.current && remoteStreamRef?.current && !isRemoteSharing) {
                activeRemoteRef.current.srcObject = remoteStreamRef.current;
                activeRemoteRef.current.play().catch(() => { });
            }

            // 4. Main Display (Unified Center Decoder)
            if ((isSharingScreen || isRemoteSharing) && sharedScreenRef.current) {
                const el = sharedScreenRef.current;

                // --- PARALLEL LINK DISCOVERY ---
                // If remote sharing, we prioritize the parallel screen stream link from App
                let streamToAttach = isSharingScreen ? screenStreamRef.current : (remoteScreenStreamRef?.current || remoteStreamRef.current);

                if (streamToAttach) {
                    console.log(`[CALL] Syncing center decoder (${isSharingScreen ? 'LOCAL' : 'REMOTE'})... Tracks: ${streamToAttach.getVideoTracks().length}V`);

                    // Force Enable & Health Log
                    streamToAttach.getTracks().forEach(t => {
                        t.enabled = true;
                        console.log(`[CALL] Track ID: ${t.id.substring(0, 8)} | Kind: ${t.kind} | State: ${t.readyState}`);
                    });

                    // MASTER SIGNAL FLUSH (Prevents Decoder Deadlock)
                    el.srcObject = null;

                    const performConnection = async () => {
                        el.srcObject = streamToAttach;
                        el.muted = true;

                        const onPlay = () => {
                            console.log('[CALL] Pixels active on decoder');
                            setIsStreamLoading(false);
                        };

                        el.addEventListener('playing', onPlay);
                        el.addEventListener('canplay', onPlay);
                        el.addEventListener('loadedmetadata', onPlay);

                        try {
                            await el.play();
                        } catch (err) {
                            console.warn('[CALL] Playback nudge required', err);
                            el.load();
                            setTimeout(() => el.play().catch(() => { }), 1000);
                        }

                        return () => {
                            el.removeEventListener('playing', onPlay);
                            el.removeEventListener('canplay', onPlay);
                            el.removeEventListener('loadedmetadata', onPlay);
                        };
                    };

                    let subCleanup;
                    const syncTimeout = setTimeout(() => {
                        performConnection().then(c => { subCleanup = c; });
                    }, 60);

                    // Continuous Health Check
                    const healthCheck = setInterval(() => {
                        if (el.paused && (isSharingScreen || isRemoteSharing) && !isStreamLoading) {
                            el.play().catch(() => { });
                        }
                    }, 3000);

                    if (isStreamLoading) {
                        loadingTimeout = setTimeout(() => setIsStreamLoading(false), 7000);
                    }

                    return () => {
                        if (subCleanup) subCleanup();
                        clearTimeout(syncTimeout);
                        if (loadingTimeout) clearTimeout(loadingTimeout);
                        clearInterval(healthCheck);
                    };
                } else {
                    console.warn('[CALL] No stream available for center decoder');
                }
            }
        };

        const cleanup = attachStream();
        return () => {
            if (cleanup) cleanup();
            if (loadingTimeout) clearTimeout(loadingTimeout);
        };
    }, [localStreamRef, remoteStreamRef, remoteScreenStreamRef, isConnected, isRemoteSharing, isSharingScreen, resyncKey, isMaximized, isExpanded, callState?.hasRemoteScreen]);

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const newMuteState = !audioTrack.enabled;
                setIsMuted(newMuteState);
                if (otherPartyId && socket) socket.emit('call_mute_change', { toUserId: otherPartyId, isMuted: newMuteState });
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoEnabled(videoTrack.enabled);
            }
        }
    };

    const startScreenShare = async () => {
        try {
            console.log('[SCREEN] Initializing Parallel Uplink...');
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always', frameRate: 60, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: shareSystemAudio
            });

            screenStreamRef.current = stream;

            // PARALLEL CALL STRATEGY
            // Instead of track replacement, we initiate a SECOND call specifically for the screen.
            const targetPeerId = callState.active?.peer || callState.incoming?.peer;
            if (peer && targetPeerId) {
                console.log('[SCREEN] Dialing parallel screen link to:', targetPeerId);
                const screenCall = peer.call(targetPeerId, stream, { metadata: { type: 'screen' } });
                screenCallRef.current = screenCall;
            }

            setIsStreamLoading(true);
            setIsSharingScreen(true);
            setShowShareSettings(false);
            if (otherPartyId && socket) socket.emit('call_screen_share_change', { toUserId: otherPartyId, isSharing: true });

            stream.getVideoTracks()[0].onended = () => stopScreenShare();
        } catch (err) {
            console.error('[SCREEN] System Uplink Failed:', err);
            setIsSharingScreen(false);
            setIsStreamLoading(false);
        }
    };

    const stopScreenShare = () => {
        console.log('[SCREEN] Tearing down parallel uplink...');
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
        }
        if (screenCallRef.current) {
            screenCallRef.current.close();
            screenCallRef.current = null;
        }
        setIsSharingScreen(false);
        if (otherPartyId && socket) socket.emit('call_screen_share_change', { toUserId: otherPartyId, isSharing: false });
    };

    // --- DRAGGABLE LOGIC ---
    const [position, setPosition] = useState({ x: 20, y: 20 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });

    // STYLES FOR ANIMATIONS
    useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes scan { from { transform: translateY(-100px); } to { transform: translateY(100vh); } }
            @keyframes pulse-border { 0% { border-color: rgba(148, 118, 245, 0.3); } 50% { border-color: rgba(148, 118, 245, 0.8); } 100% { border-color: rgba(148, 118, 245, 0.3); } }
            @keyframes ping { 75%, 100% { transform: scale(1.4); opacity: 0; } }
        `;
        document.head.appendChild(style);
        return () => document.head.removeChild(style);
    }, []);

    const onMouseDown = (e) => {
        if (e.target.closest('.drag-handle')) {
            setIsDragging(true);
            dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        }
    };

    useEffect(() => {
        const onMouseMove = (e) => {
            if (isDragging) setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        };
        const onMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging]);

    const getStatusIcon = () => {
        if (isConnected) return <Zap size={20} className="pulse-animation" style={{ color: '#a78bfa' }} />;
        if (isUplinkSyncing) return <Cpu size={20} className="spin-animation" style={{ color: '#4ade80' }} />;
        return <Activity size={20} color="#9476f5" />;
    };

    const handleEndCall = () => {
        if (callState.type === 'group' && socket) {
            socket.emit('group_call_leave', { groupId: callState.id, userId: currentUser.userId });
        }
        onEnd();
    };

    return (
        <div
            onClick={() => audioOutRef.current?.play().catch(() => { })}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: '20px' }}
        >
            <video ref={audioOutRef} autoPlay style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }} />

            <div
                ref={windowRef}
                onMouseDown={onMouseDown}
                style={{
                    position: 'absolute', left: position.x, top: position.y, width: isMaximized ? 'min(1280px, 92vw)' : ((isSharingScreen || isRemoteSharing) ? '820px' : (isExpanded ? '420px' : '240px')), background: 'rgba(5, 5, 8, 0.98)', backdropFilter: 'blur(40px)', borderRadius: '44px', border: '1px solid rgba(148, 118, 245, 0.3)', boxShadow: '0 60px 200px rgba(0,0,0,1)', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)', userSelect: 'none',
                    willChange: 'transform, width, height', transform: 'translate3d(0,0,0)',
                    animation: isUplinkSyncing ? 'pulse-border 2s infinite' : 'none'
                }}
            >
                {/* GLOBAL HYPER-DETAIL OVERLAYS */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.15, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 50%, #9476f5 0%, transparent 80%)' }} />
                <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: 0.04, pointerEvents: 'none', background: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />

                {/* SCANNER OVERLAY */}
                <div style={{ position: 'absolute', inset: 0, zIndex: 101, pointerEvents: 'none', background: 'linear-gradient(to bottom, transparent, rgba(148, 118, 245, 0.15) 50%, transparent)', height: '20px', width: '100%', animation: 'scan 4s linear infinite', opacity: 0.2, willChange: 'transform' }} />

                <div style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.03) 1px, rgba(255,255,255,0.03) 2px)', backgroundSize: '100% 4px', opacity: 0.6 }} />
                {/* Header with Connection Info */}
                <div className="drag-handle" style={{ height: '52px', display: 'flex', alignItems: 'center', padding: '0 25px', cursor: 'grab', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.12)', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {getStatusIcon()}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2.5px', color: isUplinkSyncing ? '#4ade80' : ((isSharingScreen || isRemoteSharing) ? '#ef4444' : '#a78bfa') }}>
                                {isUplinkSyncing ? 'SYNCING UPLINK...' : (isSharingScreen ? 'STREAMING LIVE' : (isRemoteSharing ? 'WATCHING LIVE' : (isConnected ? formatDuration(duration) : 'ESTABLISHING...')))}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '10px' }}>
                                    {[1, 2, 3].map(bar => (
                                        <div key={bar} style={{ width: '3px', height: `${bar * 3 + 2}px`, background: signalStrength >= bar ? '#4ade80' : 'rgba(255,255,255,0.15)', borderRadius: '1px' }} />
                                    ))}
                                </div>
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                                    {iceState === 'connected' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4ade80' }}>
                                            <ShieldCheck size={10} />
                                            <span>Secure P2P Link</span>
                                        </div>
                                    ) : (iceState === 'new' ? 'Signal Search' : iceState)}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        {(isSharingScreen || isRemoteSharing) && (
                            <button
                                onClick={() => {
                                    console.log('[CALL] Manual Resync Triggered');
                                    setResyncKey(k => k + 1);
                                    setIsStreamLoading(true);
                                }}
                                title="Optimize Signal"
                                style={{ background: 'rgba(148, 118, 245, 0.1)', border: '1px solid rgba(148, 118, 245, 0.3)', borderRadius: '8px', padding: '4px 8px', color: '#a78bfa', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                                <RefreshCw size={14} className={isStreamLoading ? "spin-animation" : ""} />
                                <span style={{ fontSize: '0.6rem', fontWeight: 900 }}>REFINE Signal</span>
                            </button>
                        )}
                        {isRemoteSharing && (
                            <div style={{ background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', borderRadius: '8px', padding: '4px 8px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', animation: 'pulse 2s infinite' }}></div>
                                <span style={{ fontSize: '0.6rem', fontWeight: 900 }}>
                                    {remoteStreamRef.current?.getVideoTracks().length || 0}V DETECTED
                                </span>
                            </div>
                        )}
                        <button onClick={() => setIsMaximized(!isMaximized)} style={{ background: 'none', border: 'none', color: isMaximized ? '#9476f5' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                            <Maximize2 size={18} />
                        </button>
                        <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                            {isExpanded ? <Minimize2 size={18} /> : <Layers size={18} />}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {!isConnected && !isIncoming ? (
                        <div style={{ textAlign: 'center', padding: '60px 20px', position: 'relative' }}>
                            {iceState === 'checking' && (
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.1 }}>
                                    <Cpu size={250} className="spin-animation" style={{ color: '#9476f5' }} />
                                </div>
                            )}

                            <div style={{ position: 'relative', width: '140px', height: '140px', margin: '0 auto 35px' }}>
                                <div style={{ position: 'absolute', inset: '-20px', borderRadius: '50%', border: '2px solid #9476f5', opacity: 0.2, animation: 'pulse 1.5s infinite' }} />
                                <div style={{ position: 'absolute', inset: '-10px', borderRadius: '50%', border: '1px solid #9476f5', opacity: 0.4, animation: 'pulse 2.5s infinite' }} />
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', border: '6px solid #9476f5', boxShadow: '0 0 70px rgba(148, 118, 245, 0.7)', background: 'linear-gradient(135deg, #12121e, #2d2e4a)', position: 'relative', zIndex: 5 }}>
                                    {(callState?.callerAvatar || callState?.avatar) ? <img src={callState?.callerAvatar || callState?.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4.5rem', fontWeight: 900, color: 'white' }}>{(callState?.callerName || 'U').charAt(0).toUpperCase()}</div>}
                                </div>
                            </div>
                            <h3 style={{ margin: 0, fontSize: '2.2rem', fontWeight: 900, color: 'white' }}>{callState?.callerName}</h3>
                            <div style={{ color: '#a78bfa', fontSize: '1.2rem', margin: '15px 0 40px', fontWeight: 800, letterSpacing: '5px', textTransform: 'uppercase' }}>
                                {isUplinkSyncing ? 'Synchronizing Uplink...' : callStatus}
                            </div>
                            <button onClick={handleEndCall} style={{ background: '#ef4444', border: 'none', borderRadius: '50%', width: '85px', height: '85px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 20px 50px rgba(239, 68, 68, 0.7)' }}>
                                <PhoneOff size={40} strokeWidth={2.5} />
                            </button>
                        </div>
                    ) : isIncoming ? (
                        <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div style={{ width: '120px', height: '120px', borderRadius: '50%', overflow: 'hidden', margin: '0 auto 25px', border: '5px solid #9476f5', boxShadow: '0 0 40px rgba(148, 118, 245, 0.5)', animation: 'pulse 1s infinite' }}>
                                {callState?.callerAvatar ? <img src={callState?.callerAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#2d2e4a' }}></div>}
                            </div>
                            <h4 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900 }}>{callState?.callerName}</h4>
                            <p style={{ color: '#a78bfa', fontSize: '1.1rem', margin: '10px 0 35px', fontWeight: 800, letterSpacing: '4px' }}>ENCRYPTED CALL...</p>
                            <div style={{ display: 'flex', gap: '30px', justifyContent: 'center' }}>
                                <button onClick={onReject} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.5)', borderRadius: '24px', padding: '16px 45px', color: '#ef4444', cursor: 'pointer', fontWeight: 900, fontSize: '1.1rem' }}>Decline</button>
                                <button onClick={onAnswer} style={{ background: '#22c55e', border: 'none', borderRadius: '24px', padding: '16px 50px', color: 'white', cursor: 'pointer', fontWeight: 900, fontSize: '1.1rem', boxShadow: '0 15px 40px rgba(34, 197, 94, 0.6)', animation: 'pulse 1s infinite' }}>Accept</button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', width: '100%' }}>
                            {callState.type === 'group' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
                                    {/* Hyper-Detailed Group Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(148, 118, 245, 0.1)', borderRadius: '18px', border: '1px solid rgba(148, 118, 245, 0.2)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <div style={{ width: '10px', height: '100%', background: '#9476f5', boxShadow: '0 0 10px #9476f5', borderRadius: '5px' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 950, letterSpacing: '2px', color: '#fff', textTransform: 'uppercase' }}>Group Network Matrix</div>
                                                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px' }}>{Object.keys(remoteParticipants).length + 1} SESSIONS ACTIVE</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '20px' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#4ade80', letterSpacing: '1px' }}>LATENCY</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff' }}>24ms</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.6rem', fontWeight: 900, color: '#9476f5', letterSpacing: '1px' }}>BITRATE</div>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#fff' }}>128kbps</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))',
                                        gap: '20px',
                                        maxHeight: isMaximized ? '70vh' : '400px',
                                        overflowY: 'auto',
                                        padding: '25px',
                                        background: 'rgba(255,255,255,0.01)',
                                        borderRadius: '32px',
                                        border: '1px solid rgba(255,255,255,0.03)',
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        position: 'relative'
                                    }}>
                                        {/* REACTIVE GRID BACKGROUND */}
                                        <div style={{ position: 'absolute', inset: 0, opacity: 0.1, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(circle at 50% 50%, rgba(148, 118, 245, 0.05) 0%, transparent 100%)', backgroundSize: '40px 40px', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)' }} />
                                        {/* Local Participant */}
                                        <VoiceMatrixCard
                                            name={currentUser?.username || 'You'}
                                            avatar={currentUser?.avatar}
                                            isSpeaking={isLocalSpeaking}
                                            isMuted={isMuted}
                                            stream={localStreamRef?.current}
                                            colorIdx={0}
                                        />
                                        {/* Remote Participants */}
                                        {Object.entries(remoteParticipants).map(([id, p], idx) => (
                                            <VoiceMatrixCard
                                                key={id}
                                                name={p.username || 'User'}
                                                avatar={p.avatar}
                                                isSpeaking={p.isSpeaking}
                                                isMuted={p.isMuted}
                                                stream={p.stream}
                                                colorIdx={idx + 1}
                                            />
                                        ))}
                                        {/* Simulated "Matrix" Fillers if empty to maintain aesthetic */}
                                        {Object.keys(remoteParticipants).length < 7 && Array.from({ length: 12 - Object.keys(remoteParticipants).length }).map((_, i) => (
                                            <div key={i} style={{
                                                width: '90px', height: '115px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.03)',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.15, gap: '12px',
                                                background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
                                            }}>
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Signal size={14} color="rgba(255,255,255,0.2)" />
                                                </div>
                                                <div style={{ width: '45px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '20px', position: 'relative', width: '100%' }}>
                                    <div style={{
                                        flex: 1, position: 'relative', borderRadius: '28px', overflow: 'hidden', background: '#000', height: isMaximized ? 'min(700px, 70vh)' : ((isSharingScreen || isRemoteSharing) ? '500px' : 'auto'), border: '2px solid rgba(255,255,255,0.12)',
                                        willChange: 'height, border-color, box-shadow'
                                    }}>
                                        {(isSharingScreen || isRemoteSharing) ? (
                                            <>
                                                {/* GPU-Optimized Scanline Layer */}
                                                <div style={{ position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none', background: 'repeating-linear-gradient(rgba(18, 16, 16, 0) 0%, rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50.1%, rgba(0, 0, 0, 0.25) 100%)', backgroundSize: '100% 4px', opacity: 0.1, willChange: 'opacity' }} />

                                                {isStreamLoading && (
                                                    <div style={{
                                                        position: 'absolute', inset: 0, zIndex: 12, background: '#08080c', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', willChange: 'opacity', animation: 'fadeIn 0.3s ease'
                                                    }}>
                                                        <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(148, 118, 245, 0.05) 3px, transparent 4px)', backgroundSize: '100% 4px', animation: 'scanlineMove 8s linear infinite', opacity: 0.4 }} />
                                                        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '35px' }}>
                                                            <div style={{ position: 'relative' }}>
                                                                <Cpu size={70} color="#9476f5" className="spin-animation" />
                                                                <Zap size={25} color="#4ade80" style={{ position: 'absolute', top: -8, right: -8, animation: 'pulse 1s infinite' }} />
                                                            </div>
                                                            <div style={{ textAlign: 'center' }}>
                                                                <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 950, letterSpacing: '10px', textTransform: 'uppercase', textShadow: '0 0 15px #9476f5' }}>Reconstructing</div>
                                                                <div style={{ color: '#4ade80', fontSize: '0.75rem', fontWeight: 800, marginTop: '12px', letterSpacing: '3px', opacity: 0.7 }}>BITRATE OPTIMIZATION ACTIVE...</div>
                                                            </div>
                                                            <div style={{ width: '300px', height: '2px', background: 'rgba(255,255,255,0.05)', borderRadius: '1px', overflow: 'hidden' }}>
                                                                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, #9476f5, #4ade80, transparent)', backgroundSize: '200% 100%', animation: 'shimmer 1s infinite' }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <video
                                                    key={`stream-v-${resyncKey}-${isRemoteSharing ? 'remote' : 'local'}`}
                                                    ref={sharedScreenRef}
                                                    autoPlay
                                                    playsInline
                                                    muted
                                                    onPlaying={() => setIsStreamLoading(false)}
                                                    onCanPlay={() => setIsStreamLoading(false)}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain', willChange: 'transform', background: '#000' }}
                                                />

                                                <div style={{ position: 'absolute', top: '25px', left: '25px', display: 'flex', gap: '15px', zIndex: 10 }}>
                                                    <div style={{ background: 'rgba(0,0,0,0.85)', padding: '8px 18px', borderRadius: '12px', border: '1px solid rgba(74, 222, 128, 0.3)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '10px', backdropFilter: 'blur(10px)' }}>
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 12px #4ade80', animation: 'pulse 1s infinite' }} />
                                                        ULTRA HD / 1080P60
                                                    </div>
                                                    <div style={{ background: 'rgba(0,0,0,0.85)', padding: '8px 18px', borderRadius: '12px', border: '1px solid rgba(148, 118, 245, 0.3)', color: '#a78bfa', fontSize: '0.75rem', fontWeight: 900, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <ShieldCheck size={14} /> ENCRYPTED
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: isExpanded ? 'column' : 'row', gap: '20px' }}>
                                                <ParticipantCard name={currentUser?.username || 'User'} avatar={currentUser?.avatar} isSpeaking={isLocalSpeaking} isMuted={isMuted} isLocal={true} stream={localStreamRef?.current} canvasRef={localCanvasRef} isExpanded={isExpanded} hasVideo={callState.video} localVideoRef={gridLocalVideoRef} remoteVideoRef={gridRemoteVideoRef} />
                                                <ParticipantCard name={callState?.callerName || 'Partner'} avatar={callState?.callerAvatar} isSpeaking={isRemoteSpeaking} isMuted={isRemoteMuted} isLocal={false} stream={remoteStreamRef?.current} canvasRef={remoteCanvasRef} isExpanded={isExpanded} hasVideo={callState.video} localVideoRef={gridLocalVideoRef} remoteVideoRef={gridRemoteVideoRef} isRemoteSharing={isRemoteSharing} />
                                            </div>
                                        )}

                                        {isMaximized && (
                                            <div style={{ position: 'absolute', right: '25px', bottom: '25px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 15 }}>
                                                <ParticipantCard name={currentUser?.username || 'User'} avatar={currentUser?.avatar} isSpeaking={isLocalSpeaking} isMuted={isMuted} isLocal={true} stream={localStreamRef?.current} canvasRef={localCanvasRef} small isExpanded={isExpanded} hasVideo={callState.video} localVideoRef={maxLocalVideoRef} remoteVideoRef={maxRemoteVideoRef} />
                                                <ParticipantCard name={callState?.callerName || 'Partner'} avatar={callState?.callerAvatar} isSpeaking={isRemoteSpeaking} isMuted={isRemoteMuted} isLocal={false} stream={remoteStreamRef?.current} canvasRef={remoteCanvasRef} small isExpanded={isExpanded} hasVideo={callState.video} localVideoRef={maxLocalVideoRef} remoteVideoRef={maxRemoteVideoRef} isRemoteSharing={isRemoteSharing} />
                                            </div>
                                        )}
                                    </div>

                                    {(isSharingScreen || isRemoteSharing) && !isMaximized && (
                                        <div style={{ width: '140px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                            <ParticipantCard name={currentUser?.username || 'User'} avatar={currentUser?.avatar} isSpeaking={isLocalSpeaking} isMuted={isMuted} isLocal={true} stream={localStreamRef?.current} canvasRef={localCanvasRef} small isExpanded={isExpanded} hasVideo={callState.video} localVideoRef={sideLocalVideoRef} remoteVideoRef={sideRemoteVideoRef} />
                                            <ParticipantCard name={callState?.callerName || 'Partner'} avatar={callState?.callerAvatar} isSpeaking={isRemoteSpeaking} isMuted={isRemoteMuted} isLocal={false} stream={remoteStreamRef?.current} canvasRef={remoteCanvasRef} small isExpanded={isExpanded} hasVideo={callState.video} localVideoRef={sideLocalVideoRef} remoteVideoRef={sideRemoteVideoRef} isRemoteSharing={isRemoteSharing} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {isConnected && isExpanded && (
                    <div style={{ padding: '25px', display: 'flex', justifyContent: 'center', gap: '25px', background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(255,255,255,0.08)', position: 'relative' }}>
                        <button onClick={toggleMute} style={{ width: '55px', height: '55px', borderRadius: '18px', border: 'none', background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s' }}>
                            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                        </button>
                        {callState.type !== 'group' && (
                            <button onClick={toggleVideo} style={{ width: '55px', height: '55px', borderRadius: '18px', border: 'none', background: isVideoEnabled ? 'rgba(255,255,255,0.08)' : '#ef4444', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s' }}>
                                {isVideoEnabled ? <Video size={22} /> : <VideoOff size={22} />}
                            </button>
                        )}
                        <div style={{ position: 'relative' }}>
                            <button onClick={() => isSharingScreen ? stopScreenShare() : setShowShareSettings(!showShareSettings)} style={{ width: '55px', height: '55px', borderRadius: '18px', border: 'none', background: isSharingScreen ? '#34d399' : 'rgba(255,255,255,0.08)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s' }}>
                                <ScreenShare size={22} />
                            </button>
                            {showShareSettings && (
                                <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-20px)', width: '280px', background: '#0a0a0f', borderRadius: '24px', padding: '25px', border: '2px solid #9476f5', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', zIndex: 100 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: '#9476f5' }}>
                                        <Monitor size={24} />
                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, letterSpacing: '2px' }}>ENGINE CTRL</h4>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '15px', marginBottom: '25px', cursor: 'pointer' }} onClick={() => setShareSystemAudio(!shareSystemAudio)}>
                                        <Volume2 size={24} color={shareSystemAudio ? "#9476f5" : "rgba(255,255,255,0.2)"} />
                                        <div style={{ flex: 1, fontSize: '0.85rem', color: 'white', fontWeight: 800 }}>System Audio Uplink</div>
                                        <div style={{ width: '40px', height: '20px', background: shareSystemAudio ? '#9476f5' : 'rgba(255,255,255,0.1)', borderRadius: '10px', position: 'relative' }}>
                                            <div style={{ width: '14px', height: '14px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: shareSystemAudio ? '23px' : '3px', transition: '0.3s' }} />
                                        </div>
                                    </div>
                                    <button onClick={startScreenShare} style={{ width: '100%', background: '#9476f5', border: 'none', borderRadius: '15px', padding: '15px', color: 'white', fontWeight: 950, cursor: 'pointer', fontSize: '0.9rem', letterSpacing: '2px' }}>INITIALIZE UPLINK</button>
                                </div>
                            )}
                        </div>
                        <button onClick={handleEndCall} style={{ width: '75px', height: '55px', borderRadius: '22px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)', transition: '0.3s' }}>
                            <PhoneOff size={24} strokeWidth={2.5} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CallModal;
