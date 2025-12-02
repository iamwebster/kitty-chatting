const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Store active users
const users = new Map();
// Store users who are currently typing
const typingUsers = new Set();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user joining
  socket.on('user-joined', (username) => {
    users.set(socket.id, username);

    // Notify all users
    io.emit('user-connected', {
      username,
      userId: socket.id,
      totalUsers: users.size
    });

    // Send current users list to the new user
    socket.emit('users-list', Array.from(users.values()));
  });

  // Handle new messages
  socket.on('send-message', (data) => {
    const username = users.get(socket.id);

    // Remove from typing users when sending message
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      broadcastTypingUsers();
    }

    io.emit('new-message', {
      username,
      message: data.message,
      timestamp: new Date().toISOString()
    });
  });

  // Handle user typing
  socket.on('typing', () => {
    if (!typingUsers.has(socket.id)) {
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
    users.delete(socket.id);

    // Remove from typing users
    if (typingUsers.has(socket.id)) {
      typingUsers.delete(socket.id);
      broadcastTypingUsers();
    }

    io.emit('user-disconnected', {
      username,
      totalUsers: users.size
    });

    console.log('User disconnected:', socket.id);
  });
});

// Helper function to broadcast typing users
function broadcastTypingUsers() {
  const typingUsernames = Array.from(typingUsers)
    .map(socketId => users.get(socketId))
    .filter(username => username); // Filter out undefined values

  io.emit('typing-users-update', typingUsernames);
}

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
