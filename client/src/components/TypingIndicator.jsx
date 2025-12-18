import React from 'react';

function TypingIndicator() {
    return (
        <div className="typing-indicator" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 15px', background: 'rgba(255,255,255,0.05)', width: 'fit-content', borderRadius: '18px', marginLeft: '2rem' }}>
            <div className="dot" style={{ animationDelay: '0s' }}></div>
            <div className="dot" style={{ animationDelay: '0.2s' }}></div>
            <div className="dot" style={{ animationDelay: '0.4s' }}></div>
            <div className="dot" style={{ animationDelay: '0.6s' }}></div>
            <style>{`
        .dot {
          width: 8px;
          height: 8px;
          background: var(--primary);
          border-radius: 50%;
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '5px' }}>typing...</span>
        </div>
    );
}

export default TypingIndicator;
