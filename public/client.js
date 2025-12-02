const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const usersCount = document.getElementById('users-count');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const chatContainer = document.querySelector('.chat-container');

let currentUsername = '';
let typingTimeout;

// Check for existing session on page load
checkAuth();

// Check if user is already logged in
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    const data = await response.json();

    if (data.username) {
      // Auto-login with saved username
      enterChat(data.username);
    }
  } catch (error) {
    console.error('Auth check error:', error);
  }
}

// Logout function
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });

    // Disconnect socket
    socket.disconnect();

    // Clear UI
    messagesContainer.innerHTML = '';
    currentUsername = '';
    usernameInput.value = '';

    // Show login screen
    chatScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');

    // Reconnect socket for next login
    socket.connect();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Join chat
joinBtn.addEventListener('click', joinChat);
logoutBtn.addEventListener('click', logout);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinChat();
});

async function joinChat() {
  const username = usernameInput.value.trim();
  if (username) {
    // Save username to cookie via API
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (response.ok) {
        enterChat(username);
      }
    } catch (error) {
      console.error('Login error:', error);
      // Still allow login even if cookie fails
      enterChat(username);
    }
  }
}

function enterChat(username) {
  currentUsername = username;
  socket.emit('user-joined', username);
  loginScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  usernameDisplay.textContent = username;
  messageInput.focus();
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

socket.on('message-history', (messages) => {
  // Always show indicator with 50 message limit info
  const indicatorDiv = document.createElement('div');
  indicatorDiv.className = 'system-message history-indicator';

  if (messages.length >= 50) {
    indicatorDiv.textContent = '📜 Показаны последние 50 сообщений (всего на странице отображается последние 50)';
  } else if (messages.length > 0) {
    indicatorDiv.textContent = `📜 Показано ${messages.length} ${getMessageWord(messages.length)} (на странице отображается до 50 последних)`;
  } else {
    indicatorDiv.textContent = '📜 История пуста. Станьте первым! (на странице отображается до 50 последних сообщений)';
  }

  messagesContainer.appendChild(indicatorDiv);

  // Load message history
  messages.forEach(msg => {
    addMessage({
      username: msg.username,
      message: msg.message,
      timestamp: msg.timestamp
    }, false); // false = don't scroll for history
  });
  // Scroll to bottom after loading history
  chatContainer.scrollTop = chatContainer.scrollHeight;
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

function addMessage(data, shouldScroll = true) {
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

  // Only apply smart scroll if shouldScroll is true
  if (shouldScroll) {
    // Always scroll to bottom for own messages, smart scroll for others
    if (isOwn) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    } else {
      smartScroll();
    }
  }
}

function addSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'system-message';
  messageDiv.textContent = text;
  messagesContainer.appendChild(messageDiv);
  smartScroll();
}

function getMessageWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return 'сообщений';
  }
  if (lastDigit === 1) {
    return 'сообщение';
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'сообщения';
  }
  return 'сообщений';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
