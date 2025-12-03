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
const animatedBackground = document.querySelector('.animated-background');

let currentUsername = '';
let typingTimeout;
let onlineUsers = []; // Array to track online users (newest first)

// Audio context for sound effects
let audioContext;

// Initialize audio context (must be after user interaction)
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

// Play message notification sound
function playMessageSound() {
  initAudio();

  const now = audioContext.currentTime;

  // Create oscillator for the main tone
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  // Soft, pleasant frequency (like a gentle tap)
  oscillator.frequency.setValueAtTime(800, now);
  oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.1);

  // Volume envelope - soft attack and quick decay
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(0.15, now + 0.01); // Soft volume
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Play
  oscillator.start(now);
  oscillator.stop(now + 0.15);
}

// Initialize language system
initLanguage();
updateAllTexts();
updateLanguageButtons();

// Check for existing session on page load
checkAuth();

// Language switcher event listeners
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.dataset.lang;
    setLanguage(lang);
    updateLanguageButtons();
  });
});

// Update active language button state
function updateLanguageButtons() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === currentLang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

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

  // Show animated background again
  if (animatedBackground) {
    animatedBackground.style.display = 'block';
    setTimeout(() => {
      animatedBackground.style.opacity = '1';
      // Restart planet animation
      if (typeof startPlanetAnimation === 'function') {
        startPlanetAnimation();
      }
    }, 10);
  }

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
    // Initialize audio on user interaction
    initAudio();

    // Save username to cookie via API
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (response.ok) {
        const data = await response.json();
        // Use the full username with tag returned from server
        enterChat(data.username);
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

  // Update language buttons for chat screen
  updateLanguageButtons();

  // Hide animated background when entering chat
  if (animatedBackground) {
    animatedBackground.style.opacity = '0';
    setTimeout(() => {
      animatedBackground.style.display = 'none';
      // Stop planet animation to save resources
      if (typeof stopPlanetAnimation === 'function') {
        stopPlanetAnimation();
      }
    }, 500);
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
    // Play sound when sending message
    playMessageSound();
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
  addSystemMessage(`${data.username} ${t('userJoined')}`);

  // Add user to the top of the list
  addUserToList(data.username);
});

socket.on('user-disconnected', (data) => {
  usersCount.textContent = data.totalUsers;
  onlineCount.textContent = data.totalUsers;
  if (data.username) {
    addSystemMessage(`${data.username} ${t('userLeft')}`);
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

  // Play sound for messages from other users
  if (data.username !== currentUsername) {
    playMessageSound();
  }

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
    indicatorDiv.textContent = `📜 ${t('historyFull')}`;
  } else if (messages.length > 0) {
    const messagesWord = translations[currentLang].messagesWord(messages.length);
    indicatorDiv.textContent = `📜 ${t('historyPartial')} ${messages.length} ${messagesWord} ${t('historyLimit')}`;
  } else {
    indicatorDiv.textContent = `📜 ${t('historyEmpty')} ${t('historyLimit')}`;
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
    typingIndicator.textContent = `${typingUsernames[0]} ${t('typing')}`;
  } else if (typingUsernames.length === 2) {
    typingIndicator.textContent = `${typingUsernames[0]} ${currentLang === 'ru' ? 'и' : 'and'} ${typingUsernames[1]} ${t('typingMultiple')}`;
  } else {
    const remaining = typingUsernames.length - 2;
    typingIndicator.textContent = `${typingUsernames[0]}, ${typingUsernames[1]} ${t('andOthers')} ${remaining} ${t('typingMultiple')}`;
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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
