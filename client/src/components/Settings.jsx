import React, { useState, useRef } from 'react';
import { Shuffle, Eye, EyeOff, User as UserIcon, Camera, Check } from 'lucide-react';

function Settings({ user, onChangeStatus, onUpdateUser }) {
    const [isSaved, setIsSaved] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [status, setStatus] = useState(user.status || 'online');
    const [bio, setBio] = useState(user.bio || '');
    const fileInputRef = useRef(null);

    const handleStatusChange = (newStatus) => {
        setStatus(newStatus);
        onChangeStatus(newStatus);
    };

    const saveBio = async () => {
        await fetch('/api/user/bio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, bio })
        });
        onUpdateUser({ bio }); // Sync local state
        alert('Bio updated!');
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result;
                await fetch('/api/user/avatar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.userId, avatar: base64 })
                });
                onUpdateUser({ avatar: base64 }); // Sync local state
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div style={{ padding: '2rem', width: '100%', maxWidth: '600px', margin: '0 auto', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                System Settings
            </h2>

            {/* Profile & Status */}
            <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: '1rem', marginBottom: '2rem' }}>
                <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <UserIcon size={20} color="var(--primary)" />
                    Identity
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginTop: '1.5rem' }}>
                    <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                        {user.avatar ? (
                            <img src={user.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                        ) : (
                            <div className="avatar-gradient" style={{ width: '100%', height: '100%', fontSize: '2rem' }}>
                                {user?.username?.slice(0, 2).toUpperCase()}
                            </div>
                        )}

                        {/* PFP Change Button */}
                        <button
                            onClick={() => fileInputRef.current.click()}
                            style={{
                                position: 'absolute', bottom: -5, left: -5, background: 'var(--bg-card)',
                                border: '1px solid var(--border)', borderRadius: '50%', width: '30px', height: '30px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white'
                            }}
                        >
                            <Camera size={16} />
                        </button>
                        <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />

                        {/* Status Dot */}
                        <div style={{
                            position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderRadius: '50%',
                            border: '3px solid var(--bg-glass)',
                            background: status === 'online' ? '#22c55e' : (status === 'dnd' ? '#ef4444' : '#94a3b8')
                        }} />
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{user?.username}</div>
                        <div style={{ color: 'var(--text-dim)', marginBottom: '0.5rem' }}>ID: #{user?.userId}</div>

                        {/* Status Selector */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {['online', 'dnd', 'invisible'].map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleStatusChange(s)}
                                    style={{
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: status === s ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        fontSize: '0.8rem',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* BIO Input */}
                <div style={{ marginTop: '1.5rem' }}>
                    <label style={{ fontSize: '0.9rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.5rem' }}>Bio</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            className="input-capsule"
                            maxLength={60}
                            placeholder="About yourself..."
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                        />
                        <button className="btn-modern" onClick={saveBio} style={{ padding: '0.6rem 1rem' }}>
                            <Check size={18} />
                        </button>
                    </div>
                </div>

                {/* Token */}
                <div style={{ marginTop: '1.5rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-dim)' }}>
                        <span>Secret Token</span>
                        <button onClick={() => setShowToken(!showToken)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
                            {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <code style={{
                        display: 'block',
                        wordBreak: 'break-all',
                        filter: showToken ? 'none' : 'blur(4px)',
                        transition: 'filter 0.2s',
                        color: 'var(--accent)'
                    }}>
                        {user?.token || 'Generates on re-login'}
                    </code>
                </div>
            </div>
        </div>
    );
}

export default Settings;
