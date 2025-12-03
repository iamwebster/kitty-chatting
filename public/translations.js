// Localization system for World Chatting
const translations = {
  en: {
    // Login screen
    welcome: 'Welcome to World Chatting',
    subtitle: 'Connect with people from around the globe in real-time',
    authTitle: 'Secure Authentication',
    authExplanation: 'Your identity is protected by a <strong>secret key</strong> that only you know. Even if someone uses the same username, they can\'t impersonate you without your secret key.',
    usernameLabel: 'Username',
    secretLabel: 'Secret Key',
    enterName: 'Enter your username',
    enterSecret: 'Enter your secret key',
    usernameHint: '2-20 characters, letters and numbers only',
    secretHint: '⚠️ Remember this key! You\'ll need it to login again',
    joinChat: 'Join Chat',
    usernameRequired: 'Please enter your username',
    usernameInvalidFormat: 'Only English letters and numbers allowed',
    usernameTooShort: 'Username too short (minimum 2 characters)',
    usernameTooLong: 'Username too long (maximum 20 characters)',
    secretRequired: 'Please enter your secret key',
    secretInvalidFormat: 'Only English letters and numbers allowed',
    secretTooShort: 'Secret key too short (minimum 3 characters)',
    identityPreview: 'Your identity will appear as:',

    // Chat header
    appName: 'World Chatting',
    logout: 'Logout',
    usersOnline: 'Users online',

    // Chat area
    generalChat: 'General Chat',
    online: 'Online',
    typeMessage: 'Type a message...',
    send: 'Send',
    settings: 'Settings',

    // System messages
    userJoined: 'joined the chat',
    userLeft: 'left the chat',
    typing: 'is typing...',
    typingMultiple: 'are typing...',
    andOthers: 'and',

    // History indicator
    historyFull: 'Showing last 50 messages',
    historyPartial: 'Showing',
    historyMessages: 'messages',
    historyMessage: 'message',
    historyEmpty: 'History is empty. Be the first!',
    historyLimit: '(up to 50 recent messages shown)',

    // Plurals helper
    messagesWord: (count) => {
      if (count === 1) return 'message';
      return 'messages';
    }
  },

  ru: {
    // Login screen
    welcome: 'Добро пожаловать в World Chatting',
    subtitle: 'Общайтесь с людьми со всего мира в реальном времени',
    authTitle: 'Безопасная аутентификация',
    authExplanation: 'Ваша личность защищена <strong>секретным ключом</strong>, который знаете только вы. Даже если кто-то использует такое же имя, он не сможет выдать себя за вас без вашего секретного ключа.',
    usernameLabel: 'Имя пользователя',
    secretLabel: 'Секретный ключ',
    enterName: 'Введите ваше имя',
    enterSecret: 'Введите ваш секретный ключ',
    usernameHint: '2-20 символов, только буквы и цифры',
    secretHint: '⚠️ Запомните этот ключ! Он понадобится для входа',
    joinChat: 'Войти в чат',
    usernameRequired: 'Пожалуйста, введите ваше имя',
    usernameInvalidFormat: 'Можно использовать только английские буквы и цифры',
    usernameTooShort: 'Имя слишком короткое (минимум 2 символа)',
    usernameTooLong: 'Имя слишком длинное (максимум 20 символов)',
    secretRequired: 'Пожалуйста, введите секретный ключ',
    secretInvalidFormat: 'Можно использовать только английские буквы и цифры',
    secretTooShort: 'Секретный ключ слишком короткий (минимум 3 символа)',
    identityPreview: 'Ваша личность будет отображаться как:',

    // Chat header
    appName: 'World Chatting',
    logout: 'Выйти',
    usersOnline: 'Пользователей онлайн',

    // Chat area
    generalChat: 'Общий чат',
    online: 'Онлайн',
    typeMessage: 'Введите сообщение...',
    send: 'Отправить',
    settings: 'Настройки',

    // System messages
    userJoined: 'присоединился к чату',
    userLeft: 'покинул чат',
    typing: 'печатает...',
    typingMultiple: 'печатают...',
    andOthers: 'и еще',

    // History indicator
    historyFull: 'На странице отображается последние 50 сообщений',
    historyPartial: 'Показано',
    historyMessages: 'сообщений',
    historyMessage: 'сообщение',
    historyEmpty: 'История пуста. Станьте первым!',
    historyLimit: '(на странице отображается до 50 последних)',

    // Plurals helper for Russian
    messagesWord: (count) => {
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
  }
};

// Current language
let currentLang = 'en';

// Get translation
function t(key) {
  return translations[currentLang][key] || key;
}

// Detect browser language
function detectBrowserLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  if (browserLang.startsWith('ru')) {
    return 'ru';
  }
  return 'en';
}

// Get saved language from cookie
function getSavedLanguage() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'language') {
      return value;
    }
  }
  return null;
}

// Save language to cookie
function saveLanguage(lang) {
  document.cookie = `language=${lang}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Strict`;
}

// Initialize language
function initLanguage() {
  // Priority: saved cookie > browser language > default (en)
  const savedLang = getSavedLanguage();
  currentLang = savedLang || detectBrowserLanguage();
  return currentLang;
}

// Set language and update UI
function setLanguage(lang) {
  currentLang = lang;
  saveLanguage(lang);
  updateAllTexts();
}

// Update all text elements in the page
function updateAllTexts() {
  // Login screen
  const welcomeTitle = document.querySelector('.login-box h1');
  if (welcomeTitle) welcomeTitle.textContent = t('welcome');

  const subtitle = document.querySelector('.welcome-subtitle');
  if (subtitle) subtitle.textContent = t('subtitle');

  // Auth explanation section
  const explanationTitle = document.querySelector('.explanation-title');
  if (explanationTitle) explanationTitle.textContent = t('authTitle');

  const explanationText = document.querySelector('.explanation-text');
  if (explanationText) explanationText.innerHTML = t('authExplanation');

  // Update input labels
  const inputLabels = document.querySelectorAll('.label-text');
  if (inputLabels.length >= 2) {
    inputLabels[0].textContent = t('usernameLabel');
    inputLabels[1].textContent = t('secretLabel');
  }

  const usernameInput = document.getElementById('username-input');
  if (usernameInput) usernameInput.placeholder = t('enterName');

  const secretInput = document.getElementById('secret-input');
  if (secretInput) secretInput.placeholder = t('enterSecret');

  // Update input hints
  const inputHints = document.querySelectorAll('.input-hint');
  if (inputHints.length >= 2) {
    inputHints[0].textContent = t('usernameHint');
    inputHints[1].textContent = t('secretHint');
  }

  const joinBtn = document.getElementById('join-btn');
  if (joinBtn) joinBtn.textContent = t('joinChat');

  // Update identity preview
  const previewLabel = document.querySelector('.preview-label');
  if (previewLabel) previewLabel.textContent = t('identityPreview');

  // Chat screen
  const chatTitle = document.querySelector('.chat-header h2');
  if (chatTitle) chatTitle.innerHTML = `🌍 ${t('appName')}`;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.textContent = t('logout');

  const chatAreaTitle = document.querySelector('.chat-area-header h3');
  if (chatAreaTitle) chatAreaTitle.textContent = t('generalChat');

  const sidebarTitle = document.querySelector('.sidebar-header h3');
  if (sidebarTitle) sidebarTitle.textContent = t('online');

  const messageInput = document.getElementById('message-input');
  if (messageInput) messageInput.placeholder = t('typeMessage');

  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.textContent = t('send');

  // Settings modal
  const modalTitle = document.querySelector('.modal-header h3');
  if (modalTitle) modalTitle.innerHTML = `⚙️ ${t('settings')}`;

  const settingsBtnTitle = document.getElementById('settings-btn');
  if (settingsBtnTitle) settingsBtnTitle.title = t('settings');

  // Update users online text
  updateUsersOnlineText();
}

// Helper to update "Users online" text
function updateUsersOnlineText() {
  const usersCountElements = document.querySelectorAll('.users-count');
  usersCountElements.forEach(el => {
    const countSpan = el.querySelector('#users-count, #online-count');
    if (countSpan) {
      const count = countSpan.textContent;
      el.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = `${t('usersOnline')}: `;
        }
      });
    }
  });
}
