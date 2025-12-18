require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const { initDB, createUser, verifyUser, addMessage, getMessages, addFriendRequest, removeFriend, updateUserStatus, updateUserBio, updateUserAvatar, getFriends, updateLastMessageTime, createGroup, getGroups, getGroupMessages, getGroupMembers } = require('./db');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);

// Environment-aware CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || "*";
const io = new Server(server, {
  cors: {
    origin: corsOrigin === "*" ? "*" : corsOrigin.split(','),
    methods: ["GET", "POST", "DELETE"]
  },
  maxHttpBufferSize: 1e8
}); // Increase buffer for images


app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for base64 avatars
app.use(express.static(path.join(__dirname, 'public')));

const peerServer = ExpressPeerServer(server, { debug: true, path: '/' });
app.use('/peerjs', peerServer);

const db = initDB();

// API
app.post('/api/register', (req, res) => {
  try {
    const user = createUser(req.body.username, req.body.password);
    // Explicitly map id -> userId for client compatibility
    res.json({ success: true, userId: user.id, ...user });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.post('/api/login', (req, res) => {
  const user = verifyUser(req.body.username, req.body.password);
  if (user) {
    // Explicitly map id -> userId for client compatibility
    res.json({ success: true, userId: user.id, ...user });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/user/bio', (req, res) => {
  updateUserBio(req.body.userId, req.body.bio);
  // Broadcast bio change to all friends
  const friends = getFriends(req.body.userId).filter(f => f.status === 'friend');
  friends.forEach(f => {
    const userData = onlineUsers.get(f.id);
    if (userData) io.to(userData.socketId).emit('friend_bio_change', { userId: req.body.userId, bio: req.body.bio });
  });
  res.json({ success: true });
});

app.post('/api/user/avatar', (req, res) => {
  updateUserAvatar(req.body.userId, req.body.avatar);
  // Broadcast avatar change to all friends
  const friends = getFriends(req.body.userId).filter(f => f.status === 'friend');
  friends.forEach(f => {
    const userData = onlineUsers.get(f.id);
    if (userData) io.to(userData.socketId).emit('friend_avatar_change', { userId: req.body.userId, avatar: req.body.avatar });
  });
  res.json({ success: true });
});

app.get('/api/users/search', (req, res) => {
  const users = require('./db').initDB().users;
  const results = users
    .filter(u => u.username.toLowerCase().includes((req.query.q || '').toLowerCase()))
    .map(u => ({
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      status: onlineUsers.has(u.id.toString()) || onlineUsers.has(parseInt(u.id)) ? 'online' : 'offline'
    }));
  res.json(results);
});

app.get('/api/friends/:userId', (req, res) => {
  const friends = getFriends(parseInt(req.params.userId));

  // HYPER-ACCURATE STATUS: Override DB status with live socket data
  const friendsWithRealStatus = friends.map(f => {
    // Check if user is in our active socket map.
    // Ensure accurate string/number comparison
    let realStatus = 'offline';
    const userIdInt = parseInt(f.id);
    const userIdStr = f.id.toString();

    // Check by integer (preferred) or string
    const onlineUser = onlineUsers.get(userIdInt) || onlineUsers.get(userIdStr);

    if (onlineUser) {
      // Use the specific status from the map (dnd, online, etc.)
      // Map 'invisible' to 'offline' for public API
      realStatus = onlineUser.status === 'invisible' ? 'offline' : onlineUser.status;
    }

    return { ...f, onlineStatus: realStatus };
  });

  res.json(friendsWithRealStatus);
});

app.post('/api/friends/request', (req, res) => {
  const { fromUserId, toUserId } = req.body;
  const result = addFriendRequest(fromUserId, toUserId);

  if (result === 'sent' || result === 'accepted') {
    // Notify Recipient
    const recipientData = onlineUsers.get(parseInt(toUserId));
    if (recipientData) {
      io.to(recipientData.socketId).emit(result === 'sent' ? 'new_friend_request' : 'friend_accepted', { fromUserId });
    }

    // Notify Sender if accepted immediately (e.g. mutual)
    if (result === 'accepted') {
      const senderData = onlineUsers.get(parseInt(fromUserId));
      if (senderData) {
        io.to(senderData.socketId).emit('friend_accepted', { withUserId: toUserId });
      }
    }
  }

  res.json({ success: true, status: result });
});

// Accept friend request endpoint
app.post('/api/friends/accept', (req, res) => {
  const { requestId } = req.body;
  // In this simple implementation, requestId is the userId who sent the request
  // We need the current user's ID too - but since we don't have auth, we'll skip this
  // For now, just return success
  res.json({ success: true });
});

app.delete('/api/friends', (req, res) => {
  if (removeFriend(req.body.user1, req.body.user2)) {
    [req.body.user1, req.body.user2].forEach(uid => {
      const sid = onlineUsers.get(parseInt(uid));
      if (sid) io.to(sid).emit('friend_removed', {});
    });
    res.json({ success: true });
  } else res.status(400).json({ error: 'Failed' });
});

app.get('/api/messages', (req, res) => {
  res.json(getMessages(parseInt(req.query.user1), parseInt(req.query.user2)));
});

// Group API
app.get('/api/groups/:userId', (req, res) => {
  try {
    res.json(getGroups(parseInt(req.params.userId)));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.post('/api/groups', (req, res) => {
  try {
    const { name, ownerId, members } = req.body;
    if (!name || !ownerId || !Array.isArray(members)) {
      return res.status(400).send('Missing name, ownerId, or members array');
    }
    const group = createGroup(name, parseInt(ownerId), members.map(id => parseInt(id)));

    // Notify all online members to join the room
    group.members.forEach(memberId => {
      const userData = onlineUsers.get(memberId);
      if (userData) {
        io.to(userData.socketId).emit('group_created', group);
      }
    });

    res.json(group);
  } catch (e) {
    console.error('[API] Group creation error:', e);
    res.status(500).send(e.message);
  }
});

app.get('/api/groups/:groupId/messages', (req, res) => {
  try {
    res.json(getGroupMessages(req.params.groupId));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

app.get('/api/groups/:groupId/members', (req, res) => {
  try {
    res.json(getGroupMembers(req.params.groupId));
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Socket
// Store online users: userId -> { socketId, lastActive, username, avatar }
const onlineUsers = new Map();

// SERVER-SIDE IDLE PRUNER (Runs every 30 seconds)
setInterval(() => {
  const now = Date.now();
  let changed = false;

  for (const [userId, userData] of onlineUsers.entries()) {
    // If no heartbeat for 2 minutes + 10s buffer, mark offline
    if (now - userData.lastActive > 130000) {
      console.log(`[PRUNER] Removing idle user: ${userData.username} (${userId})`);
      onlineUsers.delete(userId);

      // SYNC DB: Mark as offline in persistent storage
      try { updateUserStatus(userId, 'offline'); } catch (e) { }

      io.emit('user_status_change', { userId: parseInt(userId), status: 'offline' });
      changed = true;
    }
  }

  if (changed) {
    // Broadcast full list of VISIBLE users with their statuses
    const visibleUsers = Array.from(onlineUsers.entries())
      .filter(([_, u]) => u.status !== 'invisible')
      .map(([id, u]) => ({ id, status: u.status }));
    io.emit('online_users', visibleUsers);
  }
}, 30000);

function broadcastStatus(userId, status) {
  const friends = getFriends(userId).filter(f => f.status === 'friend');
  friends.forEach(f => {
    const userData = onlineUsers.get(f.id);
    if (userData) io.to(userData.socketId).emit('friend_status_change', { userId, status });
  });
}

io.on('connection', (socket) => {
  let currentUserId = null; // To store the userId for this socket connection

  socket.on('disconnect', () => {
    if (currentUserId && onlineUsers.has(currentUserId)) {
      console.log(`[SOCKET] User ${currentUserId} disconnected`);
      const wasInvisible = onlineUsers.get(currentUserId).status === 'invisible';

      onlineUsers.delete(currentUserId);

      // Sync DB
      try { updateUserStatus(currentUserId, 'offline'); } catch (e) { }

      // Broadcast offline (if not invisible, or just broadcast offline anyway to be safe)
      if (!wasInvisible) {
        io.emit('user_status_change', { userId: currentUserId, status: 'offline' });

        // Refresh list
        const visibleUsers = Array.from(onlineUsers.entries())
          .filter(([_, u]) => u.status !== 'invisible')
          .map(([id, u]) => ({ id, status: u.status }));
        io.emit('online_users', visibleUsers);
      }
    }
  });

  socket.on('join', (userId) => {
    const id = parseInt(userId);
    currentUserId = id; // Store userId for this socket

    // CRITICAL FIX: Don't overwrite DND with Online
    const u = require('./db').initDB().users.find(u => u.id === id);
    if (u) {
      // Initialize with correct status (offline -> online, otherwise keep DND/Invisible)
      let initialStatus = 'online';
      if (u.status && u.status !== 'offline') {
        initialStatus = u.status;
      }

      // Store OBJECT in Map, not String
      onlineUsers.set(id, {
        socketId: socket.id,
        lastActive: Date.now(),
        username: u.username,
        avatar: u.avatar,
        status: initialStatus
      });

      socket.join(id); // Keep room joining for direct messages if used elsewhere

      // Only broadcast "online" if they are actually public-online
      const publicStatus = initialStatus === 'invisible' ? 'offline' : initialStatus;
      if (initialStatus !== 'offline' && initialStatus !== 'invisible') {
        updateUserStatus(id, initialStatus);
      }
      broadcastStatus(id, publicStatus);

      console.log(`[SOCKET] User ${u.username} (${id}) joined as ${initialStatus} (Public: ${publicStatus})`);

      // Send immediate online list (Objects with status)
      const visibleUsers = Array.from(onlineUsers.entries())
        .filter(([_, u]) => u.status !== 'invisible')
        .map(([id, u]) => ({ id, status: u.status }));
      io.emit('online_users', visibleUsers);
    }
  });

  // Register PeerJS ID
  socket.on('register_peer', ({ userId, peerId }) => {
    if (!global.peerIds) global.peerIds = new Map();
    global.peerIds.set(parseInt(userId), peerId);
    console.log(`User ${userId} registered peer ID: ${peerId}`);
  });

  // Get peer ID
  socket.on('get_peer_id', ({ userId }, callback) => {
    if (!global.peerIds) global.peerIds = new Map();
    const peerId = global.peerIds.get(parseInt(userId));
    console.log(`[SERVER] Peer ID request for user ${userId}: ${peerId}`);

    // CRITICAL FIX: Actually call the callback!
    if (callback && typeof callback === 'function') {
      callback({ peerId });
    }
  });

  socket.on('set_status', ({ status }) => {
    try {
      if (!currentUserId) return; // Guard against unauthenticated changes

      // Check if we have the user in our map
      if (onlineUsers.has(currentUserId)) {
        const user = onlineUsers.get(currentUserId);
        user.status = status;
        user.lastActive = Date.now();
        onlineUsers.set(currentUserId, user);

        // PERSIST: Update DB so it sticks on refresh
        try {
          updateUserStatus(currentUserId, status);
        } catch (dbErr) {
          console.error('[DB ERROR] Failed to update status:', dbErr);
        }

        // Determine public status
        const publicStatus = status === 'invisible' ? 'offline' : status;

        console.log(`[STATUS] User ${currentUserId} set to ${status} (Public: ${publicStatus})`);

        // Broadcast to ALL users
        io.emit('user_status_change', { userId: currentUserId, status: publicStatus });

        // Refresh full list if visibility changed effectively
        // Ensures the online list is compliant with the new status
        if (status === 'invisible' || (publicStatus === 'offline' && status !== 'offline')) {
          const visibleUsers = Array.from(onlineUsers.entries())
            .filter(([_, u]) => u.status !== 'invisible')
            .map(([id, u]) => ({ id, status: u.status })); // Send OBJECTS
          io.emit('online_users', visibleUsers);
        }
      }
    } catch (err) {
      console.error('[SOCKET ERROR] set_status failed:', err);
    }
  });

  socket.on('typing_start', ({ toUserId, fromUserId }) => {
    const sid = onlineUsers.get(parseInt(toUserId));
    if (sid) io.to(sid.socketId).emit('typing_start', { fromUserId });
  });

  socket.on('typing_stop', ({ toUserId, fromUserId }) => {
    const sid = onlineUsers.get(parseInt(toUserId));
    if (sid) io.to(sid.socketId).emit('typing_stop', { fromUserId });
  });

  // NEW: Heartbeat handler to keep user alive in Pruner
  socket.on('heartbeat', () => {
    if (currentUserId && onlineUsers.has(currentUserId)) {
      const user = onlineUsers.get(currentUserId);
      user.lastActive = Date.now();
      onlineUsers.set(currentUserId, user);
    }
  });

  socket.on('send_message', (data) => {
    const msg = addMessage(data.fromUserId, data.toUserId, data.content, data.type, data.fileName);

    // CRITICAL: Update last message time in database
    updateLastMessageTime(data.fromUserId, data.toUserId);

    // Send the message to recipient
    const recipientData = onlineUsers.get(parseInt(data.toUserId));
    if (recipientData) {
      io.to(recipientData.socketId).emit('receive_message', msg);
      // Also emit a notification event
      io.to(recipientData.socketId).emit('new_message_notification', {
        from: data.fromUserId,
        message: msg
      });
    }
  });

  socket.on('register_call_event', (data) => {
    const { fromUserId, toUserId, type, status } = data;
    const content = status || `Missed ${type || 'voice'} call`;
    const msg = addMessage(fromUserId, toUserId, content, 'call_event');

    // Update last message time
    updateLastMessageTime(fromUserId, toUserId);

    // Broadcast to both sender and recipient so both see the bubble immediately
    const senderData = onlineUsers.get(parseInt(fromUserId));
    if (senderData) {
      io.to(senderData.socketId).emit('receive_message', msg);
    }

    const recipientData = onlineUsers.get(parseInt(toUserId));
    if (recipientData) {
      io.to(recipientData.socketId).emit('receive_message', msg);
    }
  });

  socket.on('call_termination', (data) => {
    const { toUserId } = data;
    const recipientData = onlineUsers.get(parseInt(toUserId));
    if (recipientData) {
      io.to(recipientData.socketId).emit('call_termination');
    }
  });

  socket.on('call_mute_change', (data) => {
    const { toUserId, isMuted } = data;
    const recipientData = onlineUsers.get(parseInt(toUserId));
    if (recipientData) {
      io.to(recipientData.socketId).emit('peer_mute_change', { isMuted });
    }
  });

  socket.on('call_screen_share_change', (data) => {
    const { toUserId, isSharing } = data;
    const recipientData = onlineUsers.get(parseInt(toUserId));
    if (recipientData) {
      io.to(recipientData.socketId).emit('peer_screen_share_change', { isSharing });
    }
  });

  // Group Socket Logic
  socket.on('join_group_room', ({ groupId }) => {
    socket.join(groupId);
    console.log(`[SOCKET] User ${currentUserId} joined group room: ${groupId}`);
  });

  socket.on('send_group_message', (data) => {
    const { groupId, fromUserId, content, type, fileName } = data;
    const msg = require('./db').addGroupMessage(groupId, parseInt(fromUserId), content, type, fileName);

    // Broadcast to the whole group room
    io.to(groupId).emit('receive_group_message', msg);
  });

  socket.on('group_call_init', ({ groupId, fromUserId }) => {
    // Notify others in the group that a call is starting
    socket.to(groupId).emit('group_call_started', { groupId, fromUserId });
  });

  socket.on('group_call_peer_id', ({ groupId, userId, peerId, username, avatar }) => {
    // Broadcast the sender's peer ID and info to everyone in the group room
    io.to(groupId).emit('group_peer_discovered', { userId, peerId, username, avatar });
  });

  socket.on('group_call_leave', ({ groupId, userId }) => {
    // Broadcast to the whole group room that someone left
    io.to(groupId).emit('group_call_leave', { userId });
    console.log(`[SOCKET] User ${userId} left group call: ${groupId}`);
  });
});

// SPA Fallback: Serve index.html for all unknown GET requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: Use your machine's IP address with port ${PORT}`);
  console.log(`✅ Socket.IO and PeerJS ready!`);
});

