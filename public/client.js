const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const usernameDisplay = document.getElementById('username-display');
const usersCount = document.getElementById('users-count');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const chatContainer = document.querySelector('.chat-container');

let currentUsername = '';
let typingTimeout;

// Join chat
joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinChat();
});

function joinChat() {
  const username = usernameInput.value.trim();
  if (username) {
    currentUsername = username;
    socket.emit('user-joined', username);
    loginScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    usernameDisplay.textContent = username;
    messageInput.focus();
  }
}

// Send message
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const message = messageInput.value.trim();
  if (message) {
    socket.emit('send-message', { message });
    messageInput.value = '';
    stopTyping();
  }
}

// Typing indicator
messageInput.addEventListener('input', () => {
  socket.emit('typing');
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(stopTyping, 1000);
});

function stopTyping() {
  socket.emit('stop-typing');
}

// Socket events
socket.on('user-connected', (data) => {
  usersCount.textContent = data.totalUsers;
  addSystemMessage(`${data.username} joined the chat`);
});

socket.on('user-disconnected', (data) => {
  usersCount.textContent = data.totalUsers;
  if (data.username) {
    addSystemMessage(`${data.username} left the chat`);
  }
});

socket.on('new-message', (data) => {
  addMessage(data);
});

socket.on('users-list', (users) => {
  console.log('Current users:', users);
});

socket.on('typing-users-update', (typingUsernames) => {
  // Filter out current user from typing list
  const otherTyping = typingUsernames.filter(name => name !== currentUsername);
  updateTypingIndicator(otherTyping);
});

// UI functions
// Check if user is at the bottom of chat
function isScrolledToBottom() {
  if (!chatContainer) return true;
  const threshold = 100; // pixels from bottom
  const scrollPosition = chatContainer.scrollTop + chatContainer.clientHeight;
  const scrollHeight = chatContainer.scrollHeight;
  return scrollHeight - scrollPosition <= threshold;
}

// Scroll to bottom only if user was already at bottom
function smartScroll() {
  if (isScrolledToBottom()) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function updateTypingIndicator(typingUsernames) {
  if (typingUsernames.length === 0) {
    typingIndicator.textContent = '';
  } else if (typingUsernames.length === 1) {
    typingIndicator.textContent = `${typingUsernames[0]} печатает...`;
  } else if (typingUsernames.length === 2) {
    typingIndicator.textContent = `${typingUsernames[0]} и ${typingUsernames[1]} печатают...`;
  } else {
    const remaining = typingUsernames.length - 2;
    typingIndicator.textContent = `${typingUsernames[0]}, ${typingUsernames[1]} и еще ${remaining} печатают...`;
  }
}

function addMessage(data) {
  const messageDiv = document.createElement('div');
  const isOwn = data.username === currentUsername;
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;

  const time = new Date(data.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  messageDiv.innerHTML = `
    ${!isOwn ? `<div class="message-header">${data.username}</div>` : ''}
    <div class="message-text">${escapeHtml(data.message)}</div>
    <div class="message-time">${time}</div>
  `;

  messagesContainer.appendChild(messageDiv);

  // Always scroll to bottom for own messages, smart scroll for others
  if (isOwn) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    smartScroll();
  }
}

function addSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'system-message';
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);
  smartScroll();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
