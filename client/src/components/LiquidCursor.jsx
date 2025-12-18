import React, { useEffect, useRef } from 'react';

function LiquidCursor() {
    const cursorRef = useRef(null);
    const followerRef = useRef(null);

    useEffect(() => {
        const onMouseMove = (e) => {
            const { clientX, clientY } = e;
            if (cursorRef.current) {
                cursorRef.current.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
            }
            if (followerRef.current) {
                // Simple direct follow for now, can add spring physics if needed
                // For liquid effect, use CSS transition on the follower
                followerRef.current.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        return () => window.removeEventListener('mousemove', onMouseMove);
    }, []);

    return (
        <>
            {/* Main Dot */}
            <div
                ref={cursorRef}
                style={{
                    position: 'fixed', top: -4, left: -4, width: '8px', height: '8px',
                    background: 'var(--accent)', borderRadius: '50%', pointerEvents: 'none',
                    zIndex: 9999, mixBlendMode: 'screen'
                }}
            />
            {/* Liquid Follower */}
            <div
                ref={followerRef}
                className="liquid-follower"
                style={{
                    position: 'fixed', top: -15, left: -15, width: '30px', height: '30px',
                    border: '2px solid var(--primary)', borderRadius: '50%', pointerEvents: 'none',
                    zIndex: 9998, transition: 'transform 0.15s cubic-bezier(0.075, 0.82, 0.165, 1)',
                    opacity: 0.6
                }}
            />
        </>
    );
}

export default LiquidCursor;
