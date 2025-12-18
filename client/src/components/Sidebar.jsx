import React, { useState, useEffect } from 'react';
import { Search, UserPlus, User, Settings as SettingsIcon, MessageSquare, LogOut, Check, Trash2, Circle } from 'lucide-react';

function Sidebar({ user, socket, onSelectUser, selectedUserId, onTabChange, activeTab, onLogout }) {
    const [friends, setFriends] = useState([]);
    const [groups, setGroups] = useState([]);
    const [friendRequests, setFriendRequests] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedFriendIds, setSelectedFriendIds] = useState([]);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        fetchFriends();
        fetchGroups();
        fetchFriendRequests();

        // Refresh friend list every 10 seconds for backup synchronization
        // (Real-time updates are handled by socket events below)
        const refreshInterval = setInterval(() => {
            fetchFriends();
        }, 10000);

        if (socket) {
            socket.on('new_friend_request', () => { fetchFriends(); fetchFriendRequests(); });
            socket.on('friend_accepted', () => { fetchFriends(); });
            socket.on('friend_removed', () => { fetchFriends(); });

            // FIXED: Listen for correct event name 'user_status_change'
            socket.on('user_status_change', ({ userId, status }) => {
                // console.log('[SIDEBAR] Status update:', userId, status);
                setFriends(prev => prev.map(f =>
                    f.id === userId ? { ...f, onlineStatus: status } : f
                ));
            });

            // FIXED: Listen for 'online_users' broadcast (Full Sync)
            // Payload is now: [{ id: 1, status: 'online' }, { id: 2, status: 'dnd' }]
            socket.on('online_users', (activeUsers) => {
                // console.log('[SIDEBAR] Syncing online users:', activeUsers);
                setFriends(prev => prev.map(f => {
                    const match = activeUsers.find(u => u.id === f.id || u.id === parseInt(f.id));
                    return {
                        ...f,
                        onlineStatus: match ? match.status : 'offline'
                    };
                }));
            });

            // NEW: Move chat to top when new message received
            socket.on('new_message_notification', ({ from }) => {
                setFriends(prev => prev.map(f =>
                    f.id === from ? { ...f, hasNewMessage: true } : f
                ));
            });

            // NEW: Listen for bio and avatar updates
            socket.on('friend_bio_change', ({ userId, bio }) => {
                setFriends(prev => prev.map(f => f.id === userId ? { ...f, bio } : f));
            });
            socket.on('friend_avatar_change', ({ userId, avatar }) => {
                setFriends(prev => prev.map(f => f.id === userId ? { ...f, avatar } : f));
            });

            socket.on('group_created', (group) => {
                setGroups(prev => [...prev, group]);
                socket.emit('join_group_room', { groupId: group.id });
            });
        }

        return () => {
            clearInterval(refreshInterval); // Clean up interval on unmount
            if (socket) {
                socket.off('new_friend_request');
                socket.off('friend_accepted');
                socket.off('friend_removed');
                // socket.off('friend_status_change'); // Old status handling cleanup
                socket.off('online_users'); // NEW cleanup
                socket.off('user_status_change'); // NEW cleanup
                socket.off('new_message_notification');
                socket.off('friend_bio_change');
                socket.off('friend_avatar_change');
            }
        };
    }, [user, socket]);

    const fetchFriends = async () => {
        try {
            const res = await fetch(`/api/friends/${user.userId}`);
            if (res.ok) {
                setFriends(await res.json());
            }
        } catch (e) { console.error(e); }
    };

    const fetchGroups = async () => {
        try {
            const res = await fetch(`/api/groups/${user.userId}`);
            if (res.ok) {
                const data = await res.json();
                setGroups(data);
                // Join all group rooms on connect
                data.forEach(g => {
                    socket.emit('join_group_room', { groupId: g.id });
                });
            }
        } catch (e) { console.error(e); }
    };

    const fetchFriendRequests = async () => {
        try {
            const res = await fetch(`/api/friends/${user.userId}`);
            if (res.ok) {
                const allFriends = await res.json();
                setFriendRequests(allFriends.filter(f => f.status === 'received'));
            }
        } catch (e) { console.error(e); }
    };

    const handleSearch = async (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        if (term.length > 0) {
            try {
                const res = await fetch(`/api/users/search?q=${term}`);
                if (res.ok) setSearchResults(await res.json());
            } catch (e) { }
        } else {
            setSearchResults([]);
        }
    };

    const addFriend = async (targetId) => {
        try {
            await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fromUserId: user.userId, toUserId: targetId })
            });
            fetchFriends();
            fetchFriendRequests();
        } catch (e) { alert('Failed to send'); }
    };

    const removeFriend = async (friendId) => {
        if (!confirm('Remove this friend?')) return;
        try {
            await fetch('/api/friends', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user1: user.userId, user2: friendId })
            });
            fetchFriends();
            if (selectedUserId === friendId) onSelectUser(null);
        } catch (e) { alert('Failed to remove'); }
    };

    const handleCreateGroup = async () => {
        if (!newGroupName.trim()) {
            alert("Please enter a Matrix Group name.");
            return;
        }
        if (selectedFriendIds.length === 0) {
            alert("Select at least one friend to join your Matrix Group.");
            return;
        }

        setIsCreating(true);
        try {
            const res = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newGroupName.trim(),
                    ownerId: user.userId,
                    members: selectedFriendIds
                })
            });

            if (res.ok) {
                const groupData = await res.json();
                const group = { ...groupData, type: 'group' };
                setGroups(prev => [...prev, group]);
                setIsCreatingGroup(false);
                setNewGroupName('');
                setSelectedFriendIds([]);
                onSelectUser(group); // Switch to the new group chat
            } else {
                const err = await res.text();
                alert('Server Error: ' + err);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to connect to the Matrix server.');
        } finally {
            setIsCreating(false);
        }
    };

    // Helper component for tabs (assuming it's defined elsewhere or needs to be created)
    const TabButton = ({ icon: Icon, label, active, onClick, badge }) => (
        <button className={`btn-icon ${active ? 'active' : ''}`} onClick={onClick} style={{ position: 'relative' }}>
            <Icon size={24} />
            {badge > 0 && (
                <span style={{
                    position: 'absolute', top: '-5px', right: '-5px',
                    background: 'var(--primary)', color: 'white',
                    borderRadius: '50%', width: '20px', height: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 'bold'
                }}>{badge}</span>
            )}
            {/* <span style={{ fontSize: '0.7rem', marginTop: '0.2rem' }}>{label}</span> */}
        </button>
    );

    const renderChatList = () => {
        // Combine friends and groups
        const allChats = [
            ...friends.map(f => ({ ...f, type: 'direct' })),
            ...groups.map(g => ({ ...g, type: 'group' }))
        ].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

        return (
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem' }}>
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Conversations</div>
                    <button
                        onClick={() => setIsCreatingGroup(true)}
                        className="btn-icon"
                        style={{ padding: '4px 8px', borderRadius: '8px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent)', fontSize: '0.7rem', fontWeight: 800 }}
                    >
                        + NEW GROUP
                    </button>
                </div>

                {allChats.map(item => (
                    <div
                        key={item.id}
                        onClick={() => {
                            onSelectUser(item);
                            if (item.type === 'direct') {
                                setFriends(prev => prev.map(f => f.id === item.id ? { ...f, hasNewMessage: false } : f));
                            }
                        }}
                        style={{
                            padding: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            cursor: 'pointer',
                            borderRadius: '16px',
                            marginBottom: '0.5rem',
                            background: selectedUserId === item.id ? 'hsla(210, 90%, 60%, 0.1)' : 'transparent',
                            border: selectedUserId === item.id ? '1px solid hsla(210, 90%, 60%, 0.3)' : '1px solid transparent',
                            transition: 'all 0.3s ease',
                            position: 'relative'
                        }}
                    >
                        <div style={{ position: 'relative' }}>
                            <div className={item.type === 'group' ? 'avatar-gradient-group' : 'avatar-gradient'}
                                style={{
                                    width: '50px', height: '50px', fontSize: '1.2rem',
                                    background: item.type === 'group' ? 'linear-gradient(135deg, #7c3aed, #db2777)' : undefined
                                }}>
                                {item.avatar ? <img src={item.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (item.username || item.name).substring(0, 2).toUpperCase()}
                            </div>
                            {item.type === 'direct' && item.onlineStatus === 'online' && (
                                <div style={{ position: 'absolute', bottom: '2px', right: '2px', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid var(--bg-sidebar)', background: '#22c55e' }}></div>
                            )}
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>
                                {item.username || item.name}
                                {item.type === 'group' && <span style={{ marginLeft: '0.5rem', fontSize: '0.6rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', verticalAlign: 'middle' }}>GROUP</span>}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.type === 'group' ? `${item.members.length} members` : (item.bio || (item.onlineStatus || 'offline'))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderAddFriend = () => (
        <div>
            <div style={{ padding: '0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Search Results</div>
            {searchResults.length === 0 && searchTerm.length > 0 && (
                <div style={{ padding: '1rem', color: 'var(--text-dim)' }}>No users found.</div>
            )}
            {searchResults.map(u => (
                u.id !== user.userId && (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="avatar-gradient" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>{u.avatar ? <img src={u.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : u.username.substring(0, 2).toUpperCase()}</div>
                            <div style={{ fontWeight: 600 }}>{u.username}</div>
                        </div>
                        <button className="btn-icon" onClick={() => addFriend(u.id)} style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
                            <UserPlus size={18} />
                        </button>
                    </div>
                )
            ))}
        </div>
    );

    const renderRequests = () => (
        <div>
            <div style={{ padding: '0.5rem', color: 'var(--text-dim)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Friend Requests</div>
            {friendRequests.length === 0 && (
                <div style={{ padding: '1rem', color: 'var(--text-dim)' }}>No pending friend requests.</div>
            )}
            {friendRequests.map(friend => (
                <div
                    key={friend.id}
                    style={{
                        padding: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        borderRadius: '16px',
                        marginBottom: '0.5rem',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid transparent',
                        transition: 'background 0.2s',
                        position: 'relative'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <div className="avatar-gradient" style={{ width: '50px', height: '50px', fontSize: '1.2rem' }}>
                            {friend.avatar ? <img src={friend.avatar} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : friend.username.substring(0, 2).toUpperCase()}
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{friend.username}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>Request Received</div>
                    </div>

                    <button
                        className="btn-icon"
                        style={{ padding: '0', color: '#22c55e', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        onClick={(e) => { e.stopPropagation(); acceptFriendRequest(friend.id); }}
                    >
                        <Check size={16} />
                    </button>
                </div>
            ))}
        </div>
    );

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            background: 'var(--bg-sidebar)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Search Header */}
            <div style={{ padding: '1.5rem', paddingBottom: '0.5rem' }}>
                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                    <Search size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                    <input
                        type="text"
                        className="input-capsule"
                        placeholder="Search people..."
                        value={searchTerm}
                        onChange={handleSearch}
                        style={{ paddingLeft: '3rem' }}
                    />
                </div>
            </div>

            {/* Tabs list */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '0.5rem'
            }}>
                <TabButton icon={MessageSquare} label="Chats" active={activeTab === 'chat'} onClick={() => onTabChange('chat')} />
                <TabButton icon={UserPlus} label="Add" active={activeTab === 'add'} onClick={() => onTabChange('add')} />
                <TabButton icon={User} label="Requests" active={activeTab === 'requests'} onClick={() => onTabChange('requests')} badge={friendRequests.length} />
                <TabButton icon={SettingsIcon} label="Settings" active={activeTab === 'settings'} onClick={() => onTabChange('settings')} />
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.5rem' }}>
                {activeTab === 'chat' && renderChatList()}
                {activeTab === 'add' && renderAddFriend()}
                {activeTab === 'requests' && renderRequests()}
                {activeTab === 'settings' && (
                    <div style={{ padding: '0.5rem' }}>
                        <button
                            onClick={onLogout}
                            className="btn-modern"
                            style={{
                                width: '100%',
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                marginTop: '1rem'
                            }}
                        >
                            <LogOut size={18} />
                            <span>Logout</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Group Creation Modal */}
            {isCreatingGroup && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '1.5rem', textAlign: 'center' }}>NEW MATRIX GROUP</h2>
                    <input
                        className="input-capsule"
                        placeholder="Group Name..."
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        style={{ marginBottom: '1.5rem' }}
                    />
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Select Friends</div>
                        {friends.filter(f => f.status === 'friend').length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
                                You need at least one friend to create a group.
                            </div>
                        ) : (
                            friends.filter(f => f.status === 'friend').map(friend => (
                                <div
                                    key={friend.id}
                                    onClick={() => {
                                        if (selectedFriendIds.includes(friend.id)) {
                                            setSelectedFriendIds(prev => prev.filter(id => id !== friend.id));
                                        } else {
                                            setSelectedFriendIds(prev => [...prev, friend.id]);
                                        }
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '16px',
                                        background: selectedFriendIds.includes(friend.id) ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255,255,255,0.03)',
                                        marginBottom: '0.6rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        border: selectedFriendIds.includes(friend.id) ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div className="avatar-gradient" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                            {friend.avatar ? <img src={friend.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : friend.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div style={{ fontWeight: 600, color: selectedFriendIds.includes(friend.id) ? 'white' : 'var(--text-main)' }}>{friend.username}</div>
                                    </div>

                                    {/* Standard Explicit Checkbox */}
                                    <div style={{
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '6px',
                                        border: `2px solid ${selectedFriendIds.includes(friend.id) ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        background: selectedFriendIds.includes(friend.id) ? 'var(--accent)' : 'rgba(0,0,0,0.2)',
                                        boxShadow: selectedFriendIds.includes(friend.id) ? '0 0 10px rgba(124, 58, 237, 0.4)' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}>
                                        {selectedFriendIds.includes(friend.id) && <Check size={14} color="white" strokeWidth={3} />}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            disabled={isCreating}
                            onClick={() => setIsCreatingGroup(false)}
                            style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                        <button
                            disabled={isCreating}
                            onClick={handleCreateGroup}
                            style={{
                                flex: 2, padding: '1rem', borderRadius: '12px',
                                background: isCreating ? 'var(--text-dim)' : 'var(--accent)',
                                border: 'none', color: 'white', fontWeight: 800, cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: isCreating ? 'none' : '0 4px 15px rgba(216, 180, 254, 0.4)'
                            }}
                        >
                            {isCreating ? 'ASSEMBLING...' : 'CREATE MATRIX'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Sidebar;
