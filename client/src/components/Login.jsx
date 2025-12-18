import React, { useState } from 'react';
import { Lock, User } from 'lucide-react';

function Login({ onLogin }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/login' : '/api/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (data.success) {
                onLogin({ userId: data.userId, username: data.username });
            } else {
                setError(data.error || 'Something went wrong');
            }
        } catch (err) {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100vw',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Decorative background elements */}
            <div style={{
                position: 'absolute', width: '300px', height: '300px', background: 'var(--primary)',
                filter: 'blur(150px)', borderRadius: '50%', top: '-100px', left: '-100px', opacity: 0.2
            }} />
            <div style={{
                position: 'absolute', width: '400px', height: '400px', background: 'var(--accent)',
                filter: 'blur(150px)', borderRadius: '50%', bottom: '-100px', right: '-100px', opacity: 0.2
            }} />

            <div className="glass-panel" style={{
                padding: '3rem',
                borderRadius: '2rem',
                width: '400px',
                zIndex: 10,
                boxShadow: '0 20px 50px rgba(0,0,0,0.3)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{
                        fontSize: '2.5rem',
                        background: 'linear-gradient(to right, white, #94a3b8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        margin: 0
                    }}>
                        Minhe
                    </h1>
                    <p style={{ color: 'var(--text-dim)' }}>{isLogin ? 'Welcome back, traveler.' : 'Begin your journey.'}</p>
                </div>

                {error && <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#fca5a5',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    marginBottom: '1.5rem',
                    textAlign: 'center',
                    fontSize: '0.9rem'
                }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                    <div style={{ position: 'relative' }}>
                        <User size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                        <input
                            type="text"
                            className="input-capsule"
                            placeholder="Username"
                            style={{ paddingLeft: '3rem' }}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Lock size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                        <input
                            type="password"
                            className="input-capsule"
                            placeholder="Password"
                            style={{ paddingLeft: '3rem' }}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn-modern" disabled={loading} style={{ marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}>
                        {loading ? 'Processing...' : (isLogin ? 'Enter System' : 'Create Identity')}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            transition: 'color 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.color = 'white'}
                        onMouseOut={(e) => e.target.style.color = 'var(--text-dim)'}
                    >
                        {isLogin ? 'Need an account? Sign up' : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;
