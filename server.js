const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { initDB, saveMessage, getRecentMessages } = require('./db');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Store active users
const users = new Map();
// Store users who are currently typing
const typingUsers = new Set();

// API Routes
// Set username cookie
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (username && username.trim()) {
    res.cookie('username', username.trim(), {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: false, // Allow client-side access
      sameSite: 'strict'
    });
    res.json({ success: true, username: username.trim() });
  } else {
    res.status(400).json({ success: false, error: 'Username is required' });
  }
});

// Clear username cookie
app.post('/api/logout', (req, res) => {
  res.clearCookie('username');
  res.json({ success: true });
});

// Get current username from cookie
app.get('/api/me', (req, res) => {
  const username = req.cookies.username;
  if (username) {
    res.json({ username });
  } else {
    res.json({ username: null });
  }
});

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining
  socket.on('user-joined', async (username) => {
    users.set(socket.id, username);

    // Notify all users
    io.emit('user-connected', {
      username,
      userId: socket.id,
      totalUsers: users.size
    });

    // Send current users list to the new user
    socket.emit('users-list', Array.from(users.values()));

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
    const username = users.get(socket.id);

    // Check if username exists (user must be logged in)
    if (!username) {
      console.error('Message from undefined user:', socket.id);
      return;
    }

    // Remove from typing users when sending message
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      broadcastTypingUsers();
    }

    const messageData = {
      username,
      message: data.message,
      timestamp: new Date().toISOString()
    };

    // Save message to database
    try {
      await saveMessage(username, data.message);
    } catch (error) {
      console.error('Error saving message to database:', error);
    }

    // Broadcast message to all users
    io.emit('new-message', messageData);
  });

  // Handle user typing
  socket.on('typing', () => {
    const username = users.get(socket.id);
    if (username && !typingUsers.has(socket.id)) {
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

  // Handle disconnect
  socket.on('disconnect', () => {
    const username = users.get(socket.id);

    // Remove from users map
    users.delete(socket.id);

    // Remove from typing users
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      broadcastTypingUsers();
    }

    // Only emit disconnection if user had a username (was logged in)
    if (username) {
      io.emit('user-disconnected', {
        username,
        totalUsers: users.size
      });
      console.log('User disconnected:', username);
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
    .map(socketId => users.get(socketId))
    .filter(username => username); // Filter out undefined values

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
