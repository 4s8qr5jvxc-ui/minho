import React from 'react';
import { X, Calendar, Clock, User } from 'lucide-react';

function ProfileModal({ user, onClose }) {
    if (!user) return null;

    const formatDate = (iso) => {
        if (!iso) return 'Unknown';
        return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const getDayDiff = (iso) => {
        if (!iso) return 0;
        const diff = new Date() - new Date(iso);
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)'
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="glass-panel"
                style={{ width: '350px', padding: '2rem', borderRadius: '24px', position: 'relative' }}
            >
                <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', border: '3px solid var(--primary)', marginBottom: '1rem' }}>
                        {user.avatar ? (
                            <img src={user.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <div className="avatar-gradient" style={{ width: '100%', height: '100%', fontSize: '3rem' }}>
                                {user.username?.[0]?.toUpperCase()}
                            </div>
                        )}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.8rem' }}>{user.username}</h2>
                    <div style={{ color: user.onlineStatus === 'online' ? '#22c55e' : (user.onlineStatus === 'dnd' ? '#ef4444' : '#94a3b8'), textTransform: 'capitalize' }}>
                        {user.onlineStatus}
                    </div>
                </div>

                {/* Bio */}
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', fontStyle: 'italic', textAlign: 'center', color: 'var(--accent)' }}>
                    "{user.bio || 'No bio yet.'}"
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-dim)' }}>
                        <User size={18} />
                        <div>
                            <div style={{ fontSize: '0.8rem' }}>Joined</div>
                            <div style={{ color: 'white' }}>{formatDate(user.member_since)}</div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-dim)' }}>
                        <Clock size={18} />
                        <div>
                            <div style={{ fontSize: '0.8rem' }}>Friendship Duration</div>
                            <div style={{ color: 'white' }}>{getDayDiff(user.friendship_created_at)} Days</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default ProfileModal;
