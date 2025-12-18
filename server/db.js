const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ELECTRON SUPPORT: Use writable user data path if provided
const DB_PATH = process.env.MINHE_DATA_PATH
  ? path.join(process.env.MINHE_DATA_PATH, 'minhe_secure.enc')
  : path.join(__dirname, 'minhe_secure.enc');

const ENCRYPTION_KEY = crypto.scryptSync('minhe-secret-key-salt', 'salt', 32);
const IV_LENGTH = 16;

let data = {
  users: [],
  messages: [],
  friendships: [],
  groups: [],
  groupMessages: []
};

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString('hex'), content: encrypted.toString('hex') };
}

function decrypt(encryptedObj) {
  const iv = Buffer.from(encryptedObj.iv, 'hex');
  const encryptedText = Buffer.from(encryptedObj.content, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function saveData() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(encrypt(JSON.stringify(data, null, 2)), null, 2));
  } catch (err) { console.error('Save failed:', err); }
}

function initDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      try {
        const json = JSON.parse(content);
        let loadedData;
        if (json.iv) loadedData = JSON.parse(decrypt(json));
        else { loadedData = json; saveData(); }

        // MIGRATION: Ensure all fields exist
        data = {
          ...data,
          ...loadedData,
          groups: loadedData.groups || [],
          groupMessages: loadedData.groupMessages || []
        };
      } catch (e) { saveData(); }
    } else { saveData(); }
  } catch (e) { console.error(e); }
  return data;
}

function createUser(username, password) {
  if (data.users.find(u => u.username === username)) throw new Error('Taken');
  const u = {
    id: data.users.length + 1,
    username, password,
    token: crypto.randomBytes(32).toString('hex'),
    status: 'online', bio: '', avatar: null,
    created_at: new Date().toISOString()
  };
  data.users.push(u);
  saveData();
  return u;
}

function verifyUser(username, password) {
  return data.users.find(u => u.username === username && u.password === password);
}

function updateUserAvatar(userId, base64) {
  const u = data.users.find(u => u.id === userId);
  if (u) {
    u.avatar = base64;
    saveData();
  }
}

function updateUserBio(userId, bio) {
  const u = data.users.find(u => u.id === userId);
  if (u) { u.bio = bio; saveData(); }
}

function updateUserStatus(userId, status) {
  const u = data.users.find(u => u.id === userId);
  if (u) { u.status = status; saveData(); }
}

function addMessage(from, to, content, type, file) {
  const m = {
    id: data.messages.length + 1,
    from_user_id: from, to_user_id: to,
    content, type, fileName: file,
    created_at: new Date().toISOString()
  };
  data.messages.push(m);
  saveData();
  return m;
}

function getMessages(u1, u2) {
  return data.messages.filter(m =>
    (m.from_user_id === u1 && m.to_user_id === u2) ||
    (m.from_user_id === u2 && m.to_user_id === u1)
  );
}

function updateLastMessageTime(user1, user2) {
  const now = Date.now();
  const u1 = parseInt(user1);
  const u2 = parseInt(user2);

  // Update friendship record with lastMessageTime
  data.friendships.forEach(f => {
    if ((f.user_a === u1 && f.user_b === u2) || (f.user_a === u2 && f.user_b === u1)) {
      f.lastMessageTime = now;
    }
  });
  saveData();
}

function addFriendRequest(from, to) {
  const existing = data.friendships.find(f =>
    (f.user_a === from && f.user_b === to) || (f.user_a === to && f.user_b === from)
  );
  if (existing) {
    if (existing.status === 'pending' && existing.user_b === from) {
      existing.status = 'accepted';
      existing.created_at = new Date().toISOString(); // Timestamp friendship
      saveData();
      return 'accepted';
    }
    return 'exists';
  }
  data.friendships.push({
    id: data.friendships.length + 1,
    user_a: from, user_b: to, status: 'pending',
    created_at: new Date().toISOString()
  });
  saveData();
  return 'sent';
}

function removeFriend(u1, u2) {
  const idx = data.friendships.findIndex(f =>
    (f.user_a === u1 && f.user_b === u2) || (f.user_a === u2 && f.user_b === u1)
  );
  if (idx !== -1) {
    data.friendships.splice(idx, 1);
    saveData();
    return true;
  }
  return false;
}

function getFriends(userId) {
  return data.friendships
    .filter(f => (f.user_a === userId || f.user_b === userId))
    .map(f => {
      const fid = f.user_a === userId ? f.user_b : f.user_a;
      const u = data.users.find(user => user.id == fid);
      if (!u) return null;
      return {
        id: u.id, username: u.username, bio: u.bio, avatar: u.avatar,
        status: f.status === 'pending' ? (f.user_a === userId ? 'sent' : 'received') : 'friend',
        friendship_created_at: f.created_at, // For stats
        member_since: u.created_at, // For stats
        onlineStatus: u.status || 'offline',
        lastMessageTime: f.lastMessageTime || 0
      };
    }).filter(Boolean);
}

function createGroup(name, ownerId, members) {
  const g = {
    id: 'grp_' + Date.now(),
    name,
    ownerId,
    members: [...new Set([ownerId, ...members])],
    avatar: null,
    created_at: new Date().toISOString(),
    lastMessageTime: Date.now()
  };
  data.groups.push(g);
  saveData();
  return g;
}

function getGroups(userId) {
  return data.groups.filter(g => g.members.includes(userId));
}

function addGroupMessage(groupId, fromId, content, type, file) {
  const m = {
    id: data.groupMessages.length + 1,
    group_id: groupId,
    from_user_id: fromId,
    content, type, fileName: file,
    created_at: new Date().toISOString()
  };
  data.groupMessages.push(m);

  // Update lastMessageTime for the group
  const g = data.groups.find(group => group.id === groupId);
  if (g) g.lastMessageTime = Date.now();

  saveData();
  return m;
}

function getGroupMessages(groupId) {
  return data.groupMessages.filter(m => m.group_id === groupId);
}

function getGroupMembers(groupId) {
  const g = data.groups.find(group => group.id === groupId);
  if (!g) return [];
  return g.members.map(mid => {
    const u = data.users.find(user => user.id === mid);
    if (!u) return null;
    return {
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      bio: u.bio,
      onlineStatus: u.status || 'offline'
    };
  }).filter(Boolean);
}

module.exports = {
  initDB, createUser, verifyUser, updateUserAvatar, updateUserBio, updateUserStatus,
  addMessage, getMessages, addFriendRequest, removeFriend, getFriends, updateLastMessageTime,
  createGroup, getGroups, addGroupMessage, getGroupMessages, getGroupMembers
};
