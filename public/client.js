const socket = io();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const usersCount = document.getElementById('users-count');
const onlineCount = document.getElementById('online-count');
const usersList = document.getElementById('users-list');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const chatContainer = document.querySelector('.chat-container');

let currentUsername = '';
let typingTimeout;
let onlineUsers = []; // Array to track online users (newest first)

// Check for existing session on page load
checkAuth();

// Listen for logout events from other tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'logout-event') {
    // Another tab logged out, logout this tab too
    performLogout();
  }
});

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

// Logout function (called when user clicks logout button)
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });

    // Trigger logout in all tabs via localStorage
    localStorage.setItem('logout-event', Date.now().toString());
    localStorage.removeItem('logout-event');

    // Logout this tab
    performLogout();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Perform actual logout (used by both manual logout and cross-tab logout)
function performLogout() {
  // Disconnect socket
  socket.disconnect();

  // Clear UI
  messagesContainer.innerHTML = '';
  usersList.innerHTML = '';
  onlineUsers = [];
  currentUsername = '';
  usernameInput.value = '';

  // Show login screen
  chatScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');

  // Reconnect socket for next login
  socket.connect();
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
  onlineCount.textContent = data.totalUsers;
  addSystemMessage(`${data.username} joined the chat`);

  // Add user to the top of the list
  addUserToList(data.username);
});

socket.on('user-disconnected', (data) => {
  usersCount.textContent = data.totalUsers;
  onlineCount.textContent = data.totalUsers;
  if (data.username) {
    addSystemMessage(`${data.username} left the chat`);
    // Remove user from the list
    removeUserFromList(data.username);
  }
});

socket.on('user-count-update', (data) => {
  usersCount.textContent = data.totalUsers;
  onlineCount.textContent = data.totalUsers;
});

socket.on('new-message', (data) => {
  addMessage(data);

  // Mark message as read if it's not from current user
  if (data.username !== currentUsername && data.id) {
    markMessagesAsRead([data.id]);
  }
});

socket.on('users-list', (users) => {
  // Initialize the online users list
  onlineUsers = users;
  renderUsersList();
});

socket.on('message-history', (messages) => {
  // Always show indicator with 50 message limit info
  const indicatorDiv = document.createElement('div');
  indicatorDiv.className = 'system-message history-indicator';

  if (messages.length >= 50) {
    indicatorDiv.textContent = '📜 На странице отображается последние 50 сообщений';
  } else if (messages.length > 0) {
    indicatorDiv.textContent = `📜 Показано ${messages.length} ${getMessageWord(messages.length)} (на странице отображается до 50 последних)`;
  } else {
    indicatorDiv.textContent = '📜 История пуста. Станьте первым! (на странице отображается до 50 последних сообщений)';
  }

  messagesContainer.appendChild(indicatorDiv);

  // Collect message IDs from other users to mark as read
  const messageIdsToRead = [];

  // Load message history
  messages.forEach(msg => {
    addMessage({
      id: msg.id,
      username: msg.username,
      message: msg.message,
      timestamp: msg.timestamp
    }, false); // false = don't scroll for history

    // Collect IDs of messages from other users
    if (msg.username !== currentUsername) {
      messageIdsToRead.push(msg.id);
    }
  });

  // Mark all messages from others as read
  if (messageIdsToRead.length > 0) {
    markMessagesAsRead(messageIdsToRead);
  }

  // Scroll to bottom after loading history
  chatContainer.scrollTop = chatContainer.scrollHeight;
});

socket.on('typing-users-update', (typingUsernames) => {
  // Filter out current user from typing list
  const otherTyping = typingUsernames.filter(name => name !== currentUsername);
  updateTypingIndicator(otherTyping);
});

socket.on('message-read', (data) => {
  // Update checkmark to blue when someone reads our message
  const { messageId, readBy } = data;

  // Find the message element
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    const checkmark = messageEl.querySelector('.message-checkmark');
    if (checkmark && readBy !== currentUsername) {
      checkmark.classList.add('read');
    }
  }
});

// Helper functions
function markMessagesAsRead(messageIds) {
  if (messageIds.length > 0) {
    socket.emit('mark-messages-read', messageIds);
  }
}

// User list management
function addUserToList(username) {
  // Remove if already exists (shouldn't happen, but just in case)
  onlineUsers = onlineUsers.filter(u => u !== username);

  // Add to the top
  onlineUsers.unshift(username);

  renderUsersList();
}

function removeUserFromList(username) {
  onlineUsers = onlineUsers.filter(u => u !== username);
  renderUsersList();
}

function renderUsersList() {
  usersList.innerHTML = '';

  onlineUsers.forEach(username => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';

    // Highlight current user
    if (username === currentUsername) {
      userItem.classList.add('current-user');
    }

    const userNameSpan = document.createElement('span');
    userNameSpan.className = 'user-item-name';
    userNameSpan.textContent = username;

    userItem.appendChild(userNameSpan);
    usersList.appendChild(userItem);
  });
}

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

  // Store message ID for read receipts
  if (data.id) {
    messageDiv.dataset.messageId = data.id;
  }

  const time = new Date(data.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Add checkmark for own messages
  const checkmark = isOwn ? '<span class="message-checkmark">✓</span>' : '';

  messageDiv.innerHTML = `
    ${!isOwn ? `<div class="message-header">${data.username}</div>` : ''}
    <div class="message-text">${escapeHtml(data.message)}</div>
    <div class="message-time">${time}${checkmark}</div>
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
