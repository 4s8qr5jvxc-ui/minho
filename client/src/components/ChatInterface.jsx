import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MessageArea from './MessageArea';

function ChatInterface({ socket, user, onCallUser }) {
    const [selectedUser, setSelectedUser] = useState(null);

    // We will lift some state here or use Context later if needed.
    // For now, Sidebar handles finding friends, MessageArea handles chatting.

    return (
        <div className="chat-interface" style={{
            display: 'flex',
            width: '100%',
            height: '100vh',
            overflow: 'hidden'
        }}>
            <Sidebar
                user={user}
                socket={socket}
                onSelectUser={setSelectedUser}
                selectedUserId={selectedUser?.id}
            />

            {selectedUser ? (
                <MessageArea
                    currentUser={user}
                    selectedUser={selectedUser}
                    socket={socket}
                    onCallUser={onCallUser}
                />
            ) : (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <h3>Welcome to Minhe Chat</h3>
                        <p>Select a friend to start messaging</p>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ChatInterface;
