// Localization system for World Chatting
const translations = {
  en: {
    // Login screen
    welcome: 'Welcome to World Chatting',
    subtitle: 'Connect with people from around the globe in real-time',
    featureMessaging: 'Instant messaging',
    featureReceipts: 'Read receipts',
    featureOnline: 'See who\'s online',
    enterName: 'Username (a-z, 0-9)',
    joinChat: 'Join Chat',
    usernameRequired: 'Please enter your name to continue',
    usernameInvalidFormat: 'Only English letters and numbers allowed',
    usernameOneHashOnly: 'Only one # symbol allowed',
    usernameHashPosition: '# symbol cannot be at the beginning or end',
    usernameTooShort: 'Username too short (minimum 2 characters)',
    usernameTooLong: 'Username too long (maximum 20 characters)',
    tripcodeHint: '💡 Format: Username#secret (English letters and numbers only)',

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
    featureMessaging: 'Мгновенные сообщения',
    featureReceipts: 'Статусы прочтения',
    featureOnline: 'Кто онлайн',
    enterName: 'Имя (a-z, 0-9)',
    joinChat: 'Войти в чат',
    usernameRequired: 'Пожалуйста, введите ваше имя для продолжения',
    usernameInvalidFormat: 'Можно использовать только английские буквы и цифры',
    usernameOneHashOnly: 'Можно использовать только один символ #',
    usernameHashPosition: 'Символ # не может быть в начале или конце',
    usernameTooShort: 'Имя слишком короткое (минимум 2 символа)',
    usernameTooLong: 'Имя слишком длинное (максимум 20 символов)',
    tripcodeHint: '💡 Формат: Имя#секрет (только английские буквы и цифры)',

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

  const featureTexts = document.querySelectorAll('.feature-text');
  if (featureTexts.length >= 3) {
    featureTexts[0].textContent = t('featureMessaging');
    featureTexts[1].textContent = t('featureReceipts');
    featureTexts[2].textContent = t('featureOnline');
  }

  const usernameInput = document.getElementById('username-input');
  if (usernameInput) usernameInput.placeholder = t('enterName');

  const joinBtn = document.getElementById('join-btn');
  if (joinBtn) joinBtn.textContent = t('joinChat');

  // Update error message if visible
  const usernameError = document.getElementById('username-error');
  if (usernameError && !usernameError.classList.contains('hidden')) {
    usernameError.textContent = t('usernameRequired');
  }

  // Update tripcode hint
  const tripcodeHint = document.querySelector('.tripcode-hint');
  if (tripcodeHint) tripcodeHint.textContent = t('tripcodeHint');

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
