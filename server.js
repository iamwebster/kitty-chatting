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

// Store active users: socket.id -> username
const users = new Map();
// Store user connections: username -> Set of socket.ids
const userConnections = new Map();
// Store users who are currently typing
const typingUsers = new Set();
// Store read receipts: messageId -> Set of usernames who read it
const messageReads = new Map();

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

    // Save message to database
    let savedMessage;
    try {
      savedMessage = await saveMessage(username, data.message);
    } catch (error) {
      console.error('Error saving message to database:', error);
      return;
    }

    const messageData = {
      id: savedMessage.id,
      username,
      message: data.message,
      timestamp: savedMessage.timestamp.toISOString()
    };

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

  // Handle marking messages as read
  socket.on('mark-messages-read', (messageIds) => {
    const username = users.get(socket.id);
    if (!username || !Array.isArray(messageIds)) return;

    messageIds.forEach(messageId => {
      if (!messageReads.has(messageId)) {
        messageReads.set(messageId, new Set());
      }

      // Add this user to the readers of this message
      if (!messageReads.get(messageId).has(username)) {
        messageReads.get(messageId).add(username);

        // Notify all users about this read receipt
        io.emit('message-read', {
          messageId,
          readBy: username
        });
      }
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const username = users.get(socket.id);

    if (username) {
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
