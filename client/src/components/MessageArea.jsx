import React, { useState, useEffect, useRef } from 'react';
import { Send, ImageIcon, Phone, Video, MoreVertical, Paperclip, Smile, ArrowUpRight, CheckCheck, Users, ChevronRight } from 'lucide-react';
import ProfileModal from './ProfileModal';
import TypingIndicator from './TypingIndicator';

function MessageArea({ currentUser, selectedUser, socket, onCallUser }) {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [showProfile, setShowProfile] = useState(false);
    const [activeUserStatus, setActiveUserStatus] = useState(selectedUser.onlineStatus || 'offline');
    const [isTyping, setIsTyping] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [showMemberSidebar, setShowMemberSidebar] = useState(true);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Sync internal state when prop changes (switching users)
    useEffect(() => {
        if (selectedUser?.type === 'group') {
            setActiveUserStatus(`${selectedUser.members.length} members`);
            fetchGroupMembers();
        } else {
            setActiveUserStatus(selectedUser?.onlineStatus || 'offline');
            setGroupMembers([]);
        }
        setIsTyping(false);
    }, [selectedUser]);

    const fetchGroupMembers = async () => {
        try {
            const res = await fetch(`/api/groups/${selectedUser.id}/members`);
            if (res.ok) {
                setGroupMembers(await res.json());
            }
        } catch (e) { console.error('Failed to fetch members', e); }
    };


    // STATUS LISTENERS & TYPING & HISTORY
    useEffect(() => {
        setMessages([]);
        if (selectedUser) {
            console.log(`[MessageArea] Setting up polling for user ${selectedUser.username}`);

            // 1. Fetch History
            const fetchMessages = () => {
                const isGroup = selectedUser.type === 'group';
                const url = isGroup
                    ? `/api/groups/${selectedUser.id}/messages`
                    : `/api/messages?user1=${currentUser.userId}&user2=${selectedUser.id}`;

                console.log(`[MessageArea] Fetching ${isGroup ? 'group' : 'direct'} messages from: ${url}`);
                fetch(url)
                    .then(res => res.ok ? res.json() : [])
                    .then(data => setMessages(data))
                    .catch(err => console.error('[MessageArea] Fetch error:', err));
            };

            fetchMessages();

            // AUTO-REFRESH
            const messageRefreshInterval = setInterval(fetchMessages, 1000);

            // Cleanup interval
            const cleanup = () => {
                console.log('[MessageArea] Cleaning up interval');
                clearInterval(messageRefreshInterval);
            };

            if (socket) {
                console.log('[MessageArea] Socket available, setting up listeners');
                // 2. Message Listener (instant via WebSocket)
                const handleReceive = (msg) => {
                    if (selectedUser.type === 'group') return; // Handled by receive_group_message
                    if (
                        (msg.from_user_id === selectedUser.id && msg.to_user_id === currentUser.userId) ||
                        (msg.from_user_id === currentUser.userId && msg.to_user_id === selectedUser.id)
                    ) {
                        setMessages(prev => [...prev, msg]);
                        if (msg.from_user_id === selectedUser.id) setIsTyping(false);
                    }
                };

                const handleGroupReceive = (msg) => {
                    if (selectedUser.type === 'group' && msg.group_id === selectedUser.id) {
                        setMessages(prev => [...prev, msg]);
                    }
                };

                // 3. Status Change Listener
                const handleStatusChange = ({ userId, status }) => {
                    if (selectedUser.type !== 'group' && userId === selectedUser.id) {
                        setActiveUserStatus(status);
                    }
                };

                const handleTypingStart = ({ fromUserId }) => {
                    if (selectedUser.type !== 'group' && fromUserId === selectedUser.id) {
                        setIsTyping(true);
                    }
                };

                const handleTypingStop = ({ fromUserId }) => {
                    if (selectedUser.type !== 'group' && fromUserId === selectedUser.id) {
                        setIsTyping(false);
                    }
                };

                socket.on('receive_message', handleReceive);
                socket.on('receive_group_message', handleGroupReceive);
                socket.on('typing_start', handleTypingStart);
                socket.on('typing_stop', handleTypingStop);
                socket.on('friend_status_change', handleStatusChange);

                // NEW: Listen for group member status changes
                const handleMemberStatusChange = ({ userId, status }) => {
                    if (selectedUser.type === 'group') {
                        setGroupMembers(prev => prev.map(m =>
                            m.id === userId ? { ...m, onlineStatus: status } : m
                        ));
                    }
                };
                socket.on('user_status_change', handleMemberStatusChange);

                return () => {
                    cleanup();
                    socket.off('receive_message', handleReceive);
                    socket.off('receive_group_message', handleGroupReceive);
                    socket.off('friend_status_change', handleStatusChange);
                    socket.off('typing_start', handleTypingStart);
                    socket.off('typing_stop', handleTypingStop);
                    socket.off('user_status_change', handleMemberStatusChange);
                };
            } else {
                console.warn('[MessageArea] No socket available!');
            }

            return cleanup;
        }
    }, [selectedUser, socket, currentUser]);


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    const handleInput = (e) => {
        setInputText(e.target.value);

        // Emit Typing
        if (socket) {
            socket.emit('typing_start', { toUserId: selectedUser.id, fromUserId: currentUser.userId });

            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit('typing_stop', { toUserId: selectedUser.id, fromUserId: currentUser.userId });
            }, 2000);
        }
    };

    const sendMessage = (type = 'text', content, fileName) => {
        const isGroup = selectedUser.type === 'group';
        const msgData = {
            ...(isGroup ? { groupId: selectedUser.id } : { toUserId: selectedUser.id }),
            fromUserId: currentUser.userId,
            content: content,
            type: type,
            fileName: fileName,
            timestamp: new Date()
        };
        const tempMsg = { ...msgData, id: Date.now(), from_user_id: currentUser.userId };
        setMessages(prev => [...prev, tempMsg]);

        if (isGroup) {
            socket.emit('send_group_message', msgData);
        } else {
            socket.emit('send_message', msgData);
            socket.emit('typing_stop', { toUserId: selectedUser.id, fromUserId: currentUser.userId });
        }
        if (type === 'text') setInputText('');
    };

    const handleSendText = (e) => {
        e.preventDefault();
        if (!inputText.trim()) return;
        sendMessage('text', inputText);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                const type = file.type.startsWith('image/') ? 'image' : 'file';
                sendMessage(type, reader.result, file.name);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div style={{ flex: 1, display: 'flex', height: '100%', overflow: 'hidden' }}>
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',  // CRITICAL: Prevent outer scroll
                background: 'var(--bg-chat)',
                position: 'relative'
            }}>
                {showProfile && <ProfileModal user={{ ...selectedUser, onlineStatus: activeUserStatus }} onClose={() => setShowProfile(false)} />}

                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none',
                    backgroundImage: 'radial-gradient(var(--text-dim) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }} />

                {/* HEADER - FIXED TOP */}
                <div style={{
                    flex: '0 0 auto',
                    padding: '0.8rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 50,
                    background: 'rgba(19, 20, 38, 0.95)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                        onClick={() => setShowProfile(true)}
                    >
                        <div style={{ position: 'relative' }}>
                            <div
                                className={selectedUser.type === 'group' ? 'avatar-gradient-group' : 'avatar-gradient'}
                                style={{
                                    width: '45px', height: '45px', fontSize: '1.1rem',
                                    background: selectedUser.type === 'group' ? 'linear-gradient(135deg, #7c3aed, #db2777)' : undefined
                                }}
                            >
                                {selectedUser.avatar ? <img src={selectedUser.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (selectedUser.username || selectedUser.name).substring(0, 2).toUpperCase()}
                            </div>
                            {selectedUser.type !== 'group' && (
                                <div style={{
                                    position: 'absolute', bottom: '2px', right: '2px', width: '10px', height: '10px',
                                    borderRadius: '50%', border: '2px solid var(--bg-chat)',
                                    background: activeUserStatus === 'online' ? '#22c55e' : (activeUserStatus === 'dnd' ? '#ef4444' : '#94a3b8')
                                }}></div>
                            )}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'white' }}>{selectedUser.username || selectedUser.name}</div>
                            <div style={{ fontSize: '0.75rem', color: isTyping ? 'var(--primary)' : 'var(--text-dim)', fontWeight: isTyping ? '600' : 'normal', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {isTyping ? (
                                    'typing...'
                                ) : selectedUser.type === 'group' ? (
                                    <><Users size={12} /> {activeUserStatus}</>
                                ) : (
                                    <>
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeUserStatus === 'online' ? '#22c55e' : (activeUserStatus === 'dnd' ? '#ef4444' : '#94a3b8') }}></div>
                                        {activeUserStatus.toUpperCase()}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-icon" onClick={() => onCallUser(selectedUser.id, false, selectedUser.type)} title="Voice Call"><Phone size={20} /></button>
                        <button className="btn-icon" onClick={() => onCallUser(selectedUser.id, true, selectedUser.type)} title="Video Call"><Video size={20} /></button>
                        {selectedUser.type === 'group' && (
                            <button
                                className="btn-icon"
                                onClick={() => setShowMemberSidebar(!showMemberSidebar)}
                                style={{ color: showMemberSidebar ? 'var(--accent)' : 'inherit', background: showMemberSidebar ? 'rgba(124, 58, 237, 0.1)' : 'transparent' }}
                                title="Member Matrix"
                            >
                                <Users size={20} />
                            </button>
                        )}
                        <button className="btn-icon"><MoreVertical size={20} /></button>
                    </div>
                </div>

                {/* MESSAGES - SCROLLABLE MIDDLE */}
                <div
                    className="messages-container"
                    style={{
                        flex: 1,
                        overflowX: 'hidden',
                        overflowY: 'auto',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        scrollBehavior: 'smooth'
                    }}
                >
                    {messages.map((m, i) => {
                        const isMe = m.from_user_id === currentUser.userId;

                        // Handle call event special rendering if needed, 
                        // but let's stick to the consolidated standard for now as per current file structure
                        if (m.type === 'call_event') {
                            const isOutgoing = m.from_user_id === currentUser.userId;
                            return (
                                <div key={i} style={{ alignSelf: isOutgoing ? 'flex-end' : 'flex-start', maxWidth: '280px', margin: '0.5rem 0' }}>
                                    <div style={{
                                        background: '#9476f5', borderRadius: '18px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px',
                                        boxShadow: '0 10px 25px rgba(118, 92, 245, 0.3)', color: 'white'
                                    }}>
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Phone size={20} fill="white" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{isOutgoing ? 'Outgoing Matrix Call' : 'Incoming Matrix Call'}</div>
                                            <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{m.content}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={m.id || i}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: isMe ? 'flex-end' : 'flex-start'
                                }}
                            >
                                {selectedUser.type === 'group' && !isMe && (
                                    <div style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, marginLeft: '0.5rem', marginBottom: '0.2rem' }}>
                                        {m.username || `User ${m.from_user_id}`}
                                    </div>
                                )}
                                <div style={{
                                    maxWidth: '70%',
                                    padding: '0.8rem 1.2rem',
                                    borderRadius: isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                                    background: isMe ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                                    color: 'white',
                                    position: 'relative',
                                    boxShadow: isMe ? '0 4px 15px rgba(124, 58, 237, 0.3)' : 'none',
                                    animation: 'messagePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                }}>
                                    {m.type === 'image' ? (
                                        <img src={m.content} alt="sent" style={{ maxWidth: '100%', borderRadius: '12px' }} />
                                    ) : m.type === 'file' ? (
                                        <a href={m.content} download={m.fileName} style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                                            <Paperclip size={16} /> {m.fileName}
                                        </a>
                                    ) : (
                                        <div style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            {m.content}
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '0.65rem',
                                        color: 'rgba(255,255,255,0.5)',
                                        marginTop: '0.5rem',
                                        textAlign: 'right',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'flex-end',
                                        gap: '4px'
                                    }}>
                                        {new Date(m.created_at || m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {isMe && <CheckCheck size={12} />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {isTyping && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>

                {/* INPUT AREA */}
                <div style={{ padding: '1rem', zIndex: 10 }}>
                    <form onSubmit={handleSendText} style={{
                        background: 'var(--bg-glass)',
                        padding: '0.3rem 0.5rem',
                        borderRadius: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                        border: '1px solid var(--border)'
                    }}>
                        <button type="button" className="btn-icon" onClick={() => fileInputRef.current.click()} style={{ color: 'var(--text-dim)', padding: '8px' }}>
                            <Paperclip size={20} />
                        </button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden />
                        <button type="button" className="btn-icon" style={{ color: 'var(--text-dim)', padding: '8px' }}><Smile size={20} /></button>

                        <input
                            type="text"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                flex: 1,
                                fontSize: '0.95rem',
                                outline: 'none',
                                padding: '0.6rem 0.2rem'
                            }}
                            placeholder="Type a message into the Matrix..."
                            value={inputText}
                            onChange={handleInput}
                        />

                        <button
                            type="submit"
                            style={{
                                borderRadius: '50%',
                                width: '42px',
                                height: '42px',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: inputText.trim() ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.05)',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                transform: inputText.trim() ? 'scale(1)' : 'scale(0.9)',
                                boxShadow: inputText.trim() ? '0 4px 15px rgba(124, 58, 237, 0.4)' : 'none'
                            }}
                            disabled={!inputText.trim()}
                        >
                            <Send size={18} style={{ marginLeft: '2px' }} />
                        </button>
                    </form>
                </div>
            </div>

            {/* MEMBER SIDEBAR - DISCORD STYLE ULTIMATE DETAIL */}
            {selectedUser.type === 'group' && showMemberSidebar && (
                <div style={{
                    width: '260px',
                    background: 'rgba(15, 16, 32, 0.98)',
                    borderLeft: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInRight 0.3s ease-out',
                    zIndex: 100
                }}>
                    <div style={{ padding: '1.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                        <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Member Matrix</div>
                        <div style={{ fontSize: '0.7rem', background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>{groupMembers.length}</div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 0.5rem', scrollbarWidth: 'thin' }}>
                        {['online', 'dnd', 'offline'].map(status => {
                            const members = groupMembers.filter(m => (m.onlineStatus || 'offline') === status);
                            if (members.length === 0) return null;

                            return (
                                <div key={status} style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 700, textTransform: 'uppercase', paddingLeft: '0.5rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {status} — {members.length}
                                    </div>
                                    {members.map(member => (
                                        <div
                                            key={member.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.8rem',
                                                borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                position: 'relative', overflow: 'hidden'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ position: 'relative' }}>
                                                <div className="avatar-gradient" style={{
                                                    width: '34px', height: '34px', fontSize: '0.8rem',
                                                    background: member.onlineStatus === 'offline' ? 'rgba(255,255,255,0.05)' : undefined
                                                }}>
                                                    {member.avatar ? <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : member.username.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div style={{
                                                    position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px',
                                                    borderRadius: '50%', border: '2px solid rgba(15, 16, 32, 1)',
                                                    background: member.onlineStatus === 'online' ? '#22c55e' : (member.onlineStatus === 'dnd' ? '#ef4444' : '#94a3b8')
                                                }}></div>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '0.85rem', fontWeight: 600,
                                                    color: member.onlineStatus === 'offline' ? 'var(--text-dim)' : 'white',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    {member.username}
                                                </div>
                                                {member.bio && <div style={{
                                                    fontSize: '0.65rem', color: 'var(--text-dim)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    {member.bio}
                                                </div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default MessageArea;
