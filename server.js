const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initDB, generateTripcode, createOrGetTripcodeUser, saveMessage, getRecentMessages } = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Store active users: socket.id -> { userId, fullDisplayName }
const users = new Map();
// Store user connections: fullDisplayName -> Set of socket.ids
const userConnections = new Map();
// Store users who are currently typing
const typingUsers = new Set();
// Store read receipts: messageId -> Set of usernames who read it
const messageReads = new Map();

// Validate username format
function validateUsername(input) {
  if (!input || !input.trim()) {
    return { valid: false, error: 'Username is required' };
  }

  const username = input.trim();

  // Check for multiple # symbols
  const hashCount = (username.match(/#/g) || []).length;
  if (hashCount > 1) {
    return { valid: false, error: 'Only one # symbol allowed' };
  }

  // Check format: only English letters, numbers, and optionally one #
  const validFormat = /^[a-zA-Z0-9]+#?[a-zA-Z0-9]*$/;
  if (!validFormat.test(username)) {
    return { valid: false, error: 'Only English letters and numbers allowed' };
  }

  // Check that # is not at the beginning or end
  if (username.startsWith('#') || username.endsWith('#')) {
    return { valid: false, error: 'Invalid # position' };
  }

  // Check username length (without secret)
  const parts = username.split('#');
  const usernameOnly = parts[0];

  if (usernameOnly.length < 2) {
    return { valid: false, error: 'Username too short (min 2 characters)' };
  }

  if (usernameOnly.length > 20) {
    return { valid: false, error: 'Username too long (max 20 characters)' };
  }

  return { valid: true };
}

// Helper function to parse tripcode input
function parseTripcodeInput(input) {
  // Format: "Username#secret" or just "Username"
  const parts = input.split('#');
  const username = parts[0].trim();
  const secret = parts[1] || ''; // Empty string if no secret

  const tripcode = secret ? generateTripcode(secret) : '';
  const fullDisplayName = tripcode ? `${username}!${tripcode}` : username;

  return { username, tripcode, fullDisplayName };
}

// API Routes
// Set username cookie (with tripcode support)
app.post('/api/login', async (req, res) => {
  const { username } = req.body;

  // Validate username format
  const validation = validateUsername(username);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error });
  }

  try {
    // Parse tripcode input (Username#secret or just Username)
    const { username: parsedUsername, tripcode, fullDisplayName } = parseTripcodeInput(username);

    // Create or get user from database
    const user = await createOrGetTripcodeUser(parsedUsername, tripcode);

    // Store full display name in cookie
    res.cookie('username', fullDisplayName, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow client-side access
      sameSite: 'strict'
    });

    // Also store user ID for quick lookups
    res.cookie('userId', user.id, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: false,
      sameSite: 'strict'
    });

    res.json({ success: true, username: fullDisplayName, userId: user.id });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Failed to login' });
  }
});

// Clear username cookie
app.post('/api/logout', (req, res) => {
  res.clearCookie('username');
  res.clearCookie('userId');
  res.json({ success: true });
});

// Get current username from cookie
app.get('/api/me', (req, res) => {
  const username = req.cookies.username;
  const userId = req.cookies.userId;
  if (username) {
    res.json({ username, userId: userId ? parseInt(userId) : null });
  } else {
    res.json({ username: null, userId: null });
  }
});

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining
  socket.on('user-joined', async (data) => {
    // data can be either string (username) or object { username, userId }
    const username = typeof data === 'string' ? data : data.username;
    const userId = typeof data === 'object' ? data.userId : null;

    // Store user info
    users.set(socket.id, { username, userId });

    // Track user connections
    if (!userConnections.has(username)) {
      userConnections.set(username, new Set());
    }
    userConnections.get(username).add(socket.id);

    // Only notify if this is the first connection for this user
    const isFirstConnection = userConnections.get(username).size === 1;

    if (isFirstConnection) {
      // Notify all users about new user
      io.emit('user-connected', {
        username,
        userId: socket.id,
        totalUsers: userConnections.size
      });
    } else {
      // Update this socket with current user count
      socket.emit('user-count-update', {
        totalUsers: userConnections.size
      });
    }

    // Send current users list to the new user
    socket.emit('users-list', Array.from(userConnections.keys()));

    // Send message history to the new user
    try {
      const messages = await getRecentMessages(50);
      socket.emit('message-history', messages);
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  });

  // Handle new messages
  socket.on('send-message', async (data) => {
    const user = users.get(socket.id);

    // Check if user exists (user must be logged in)
    if (!user || !user.username) {
      console.error('Message from undefined user:', socket.id);
      return;
    }

    // Remove from typing users when sending message
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      broadcastTypingUsers();
    }

    // Save message to database
    let savedMessage;
    try {
      savedMessage = await saveMessage(user.username, data.message, user.userId);
    } catch (error) {
      console.error('Error saving message to database:', error);
      return;
    }

    const messageData = {
      id: savedMessage.id,
      username: user.username,
      message: data.message,
      timestamp: savedMessage.timestamp.toISOString()
    };

    // Broadcast message to all users
    io.emit('new-message', messageData);
  });

  // Handle user typing
  socket.on('typing', () => {
    const user = users.get(socket.id);
    if (user && user.username && !typingUsers.has(socket.id)) {
      typingUsers.add(socket.id);
      broadcastTypingUsers();
    }
  });

  socket.on('stop-typing', () => {
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      broadcastTypingUsers();
    }
  });

  // Handle marking messages as read
  socket.on('mark-messages-read', (messageIds) => {
    const user = users.get(socket.id);
    if (!user || !user.username || !Array.isArray(messageIds)) return;

    messageIds.forEach(messageId => {
      if (!messageReads.has(messageId)) {
        messageReads.set(messageId, new Set());
      }

      // Add this user to the readers of this message
      if (!messageReads.get(messageId).has(user.username)) {
        messageReads.get(messageId).add(user.username);

        // Notify all users about this read receipt
        io.emit('message-read', {
          messageId,
          readBy: user.username
        });
      }
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);

    if (user && user.username) {
      const username = user.username;

      // Remove from users map
      users.delete(socket.id);

      // Remove from user connections
      if (userConnections.has(username)) {
        userConnections.get(username).delete(socket.id);

        // If this was the last connection for this user
        if (userConnections.get(username).size === 0) {
          userConnections.delete(username);

          // Notify all users about disconnection
          io.emit('user-disconnected', {
            username,
            totalUsers: userConnections.size
          });

          console.log('User fully disconnected:', username);
        } else {
          console.log('User closed one tab:', username, '(remaining:', userConnections.get(username).size, ')');
        }
      }

      // Remove from typing users
      if (typingUsers.has(socket.id)) {
        typingUsers.delete(socket.id);
        broadcastTypingUsers();
      }
    }
  });
});

// Helper function to broadcast typing users
function broadcastTypingUsers() {
  // Clean up stale socket IDs from typingUsers
  const staleSocketIds = [];
  for (const socketId of typingUsers) {
    if (!users.has(socketId)) {
      staleSocketIds.push(socketId);
    }
  }
  staleSocketIds.forEach(id => typingUsers.delete(id));

  // Get valid typing usernames
  const typingUsernames = Array.from(typingUsers)
    .map(socketId => {
      const user = users.get(socketId);
      return user ? user.username : null;
    })
    .filter(username => username); // Filter out undefined/null values

  io.emit('typing-users-update', typingUsernames);
}

// Initialize database and start server
async function startServer() {
  try {
    await initDB();
    server.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Database connected successfully`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
