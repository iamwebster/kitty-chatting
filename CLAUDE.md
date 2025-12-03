# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 IMPORTANT: Development Workflow

**ALWAYS commit and push changes immediately after implementing them.**

When making any code changes:
1. Implement the feature/fix
2. Immediately run `git add` + `git commit` + `git push`
3. Do NOT wait for user approval
4. Changes auto-deploy via GitHub Actions CI/CD

This is a strict requirement for this project.

## Project Overview

**Kitty Chatting** - мемный котовый мессенджер для обмена сообщениями, мемами и гифками с котами.

### Vision
Создание мемного сообщества любителей котов, где можно:
- Общаться в real-time чате
- Делиться мемами с котами
- Отправлять гифки с котами
- Создавать профили пользователей (planned)
- Формировать сообщество котоманов

### Current Features

**Authentication & Security:**
- ✅ Tripcode authentication system (mandatory secret key)
- ✅ Username format: `Username!tripcode` (hash from secret key)
- ✅ Cookie-based session with auto-login
- ✅ Secure identity protection (same username, different key = different user)

**Messaging:**
- ✅ Real-time chat with WebSockets (Socket.io)
- ✅ Message history (PostgreSQL, last 50 messages)
- ✅ Viewport-based read receipts (gray → green checkmarks)
- ✅ Persistent read status (survives page reload)
- ✅ Smart auto-scroll (doesn't interrupt reading history)
- ✅ Typing indicator for multiple users
- ✅ Sound notifications (Web Audio API)

**User Experience:**
- ✅ Modern login page (900px width, two-column input layout)
- ✅ Security explanation for secret key authentication
- ✅ Multi-tab support with unique user counting
- ✅ Cross-tab logout synchronization
- ✅ Settings modal (Escape key to close)
- ✅ Full EN/RU localization with browser language detection

**Design:**
- ✅ Cosmic theme with 3D star field (Three.js WebGL)
- ✅ Dark theme with glassmorphism effects
- ✅ Fullscreen desktop app style
- ✅ Mobile responsive (portrait + landscape)
- ✅ Simple settings button animation (scale on hover/click)
- ✅ Realistic Earth favicon

**Infrastructure:**
- ✅ PostgreSQL database with users, messages, read_receipts tables
- ✅ CI/CD via GitHub Actions
- ✅ Auto-deploy to VPS (Ubuntu + Nginx + PM2)

## Architecture

### Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: Vanilla JavaScript (ES6+), Three.js (WebGL)
- **Database**: PostgreSQL
- **Deployment**: Custom VPS (Ubuntu) + Nginx + PM2
- **CI/CD**: GitHub Actions → SSH → Auto-deploy
- **Audio**: Web Audio API (programmatic sound generation)
- **Localization**: Cookie-based language persistence (EN/RU)

### File Structure
```
.
├── server.js              # Backend: Express + Socket.io
├── db.js                  # Database: PostgreSQL queries
├── ecosystem.config.js    # PM2 configuration
├── public/
│   ├── index.html        # Frontend markup (login + chat + modal)
│   ├── style.css         # Styles (dark theme + responsive)
│   ├── client.js         # Client-side Socket.io + modal logic
│   ├── translations.js   # i18n system (EN/RU)
│   ├── planet.js         # Three.js star field animation
│   └── favicon.svg       # Realistic Earth planet icon
├── .github/workflows/
│   └── deploy.yml        # Auto-deploy on push to main
├── CLAUDE.md             # This file (dev documentation)
├── README.md             # User-facing documentation
└── .env                  # Config (NOT in git)
```

### Database Schema

**users table:**
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  tripcode VARCHAR(16) NOT NULL,
  full_display_name VARCHAR(67) NOT NULL,  -- "Username!tripcode"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  UNIQUE(username, tripcode)
);
```

**messages table:**
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**read_receipts table:**
```sql
CREATE TABLE read_receipts (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_username VARCHAR(67) NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, reader_username)
);
```

### Key Maps and State (server.js)
- `users` - Map<socket.id, {username, userId}>
- `userConnections` - Map<username, Set<socket.ids>>
- `typingUsers` - Set<socket.id>
- `messageReads` - Map<messageId, Set<usernames>> (in-memory cache, backed by DB)

## Development Commands

### Local Development
```bash
# Install dependencies
npm install

# Start with auto-reload
npm run dev

# Start production mode
npm start
```

### Database Setup (PostgreSQL)
```bash
# On server
sudo -u postgres psql
CREATE DATABASE kitty_chat;
CREATE USER chatuser WITH ENCRYPTED PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE kitty_chat TO chatuser;
\c kitty_chat
GRANT ALL ON SCHEMA public TO chatuser;
ALTER SCHEMA public OWNER TO chatuser;
```

### Environment Variables (.env)
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://chatuser:password@localhost:5432/kitty_chat
```

### Server Commands (Production)
```bash
# SSH to server
ssh root@45.150.9.195

# Navigate to project
cd /var/www/kitty-chatting

# Pull latest code (auto via GitHub Actions)
git pull origin main

# Install deps
npm install

# Restart app
pm2 restart kitty-chatting

# View logs
pm2 logs kitty-chatting

# Check status
pm2 status
```

## Key Implementation Details

### Tripcode Authentication System
**How it works:**
1. User enters username (e.g., "Alice") and secret key (e.g., "mySecret123")
2. Client combines: `Alice#mySecret123` and sends to server
3. Server generates SHA-256 hash of secret: first 8 chars = tripcode
4. Display name becomes: `Alice!a1b2c3d4`
5. Stored in database: username, tripcode, full_display_name
6. Cookie stores full display name for auto-login

**Security:**
- Same username + different secret = different user identity
- Tripcode proves ownership without storing the secret
- Based on 4chan/2channel tripcode system

**Validation:**
- Username: 2-20 chars, alphanumeric only
- Secret key: 3+ chars, alphanumeric only (mandatory)
- Server validates format: `^[a-zA-Z0-9]+#[a-zA-Z0-9]+$`

### Multi-Tab User Tracking
Users are tracked by **full display name** (Username!tripcode), not socket connections:
- One user with 3 tabs = 1 online user
- `userConnections` Map tracks all socket IDs per display name
- "joined" event only fires for first tab
- "left" event only fires when last tab closes

### Read Receipts (Viewport-Based + Persistent)
**How it works:**
1. **Message sent**: Gray checkmark ✓ appears (unread)
2. **Recipient scrolls**: `markVisibleMessagesAsRead()` detects viewport visibility
3. **Save to DB**: `read_receipts` table records reader + timestamp
4. **Broadcast**: Server emits `message-read` to all clients
5. **Update UI**: Sender's checkmark turns green ✓ (read)
6. **Persistence**: On page reload, read status loaded from database

**Key features:**
- Only marks messages visible in viewport (not just received)
- Debounced scroll event (300ms) for performance
- Database persistence survives page reload
- Green checkmark (#4CAF50) when read by others
- Gray checkmark (rgba(0,0,0,0.4)) when unread

**Database storage:**
```sql
-- Unique constraint prevents duplicate reads
UNIQUE(message_id, reader_username)
-- Cascade delete when message deleted
ON DELETE CASCADE
```

### Auto-Login & Logout Sync
- Username + userId stored in cookies (30 days)
- On page load: check `/api/me` → auto-login if cookie exists
- Logout uses `localStorage` events to sync across all tabs
- When one tab logs out, all tabs logout instantly

### Typing Indicator
- Supports multiple simultaneous typers
- Shows first 2 names: "User1, User2 и еще 5 печатают..."
- Auto-cleanup of stale socket IDs
- 1 second debounce timeout

### Smart Auto-Scroll
- Only scrolls if user is near bottom (<100px from bottom)
- Doesn't interrupt when reading message history
- Always scrolls for own messages
- Smooth scroll behavior

## API Endpoints

### REST API
- `POST /api/login` - Authenticate with tripcode, set username + userId cookies
  - Body: `{ username: "Alice#secret123" }`
  - Returns: `{ success: true, username: "Alice!a1b2c3d4", userId: 123 }`
- `POST /api/logout` - Clear username and userId cookies
- `GET /api/me` - Get current username and userId from cookies
  - Returns: `{ username: "Alice!a1b2c3d4", userId: 123 }`

### Socket.io Events

**Client → Server:**
- `user-joined` - Join chat with username and userId
  - Data: `{ username: "Alice!a1b2c3d4", userId: 123 }`
- `send-message` - Send new message
  - Data: `{ message: "Hello!" }`
- `typing` - User started typing (no data)
- `stop-typing` - User stopped typing (no data)
- `mark-messages-read` - Mark messages as read (saves to database)
  - Data: `[messageId1, messageId2, ...]`

**Server → Client:**
- `user-connected` - New user joined
  - Data: `{ username: "Alice!a1b2c3d4", totalUsers: 5 }`
- `user-disconnected` - User left
  - Data: `{ username: "Alice!a1b2c3d4", totalUsers: 4 }`
- `user-count-update` - Update online count (for additional tabs)
  - Data: `{ totalUsers: 5 }`
- `new-message` - New message received
  - Data: `{ id: 123, username: "Alice!a1b2c3d4", message: "Hello!", timestamp: "2025-12-03T..." }`
- `message-history` - Load last 50 messages with read receipts
  - Data: `[{ id, username, message, timestamp, readBy: ["User1!abc", "User2!def"] }, ...]`
- `typing-users-update` - Update typing indicator
  - Data: `["Alice!a1b2c3d4", "Bob!xyz123"]`
- `message-read` - Message was read by someone (broadcast to all)
  - Data: `{ messageId: 123, readBy: "Alice!a1b2c3d4" }`
- `users-list` - List of online users (sent on join)
  - Data: `["Alice!a1b2c3d4", "Bob!xyz123", ...]`

## Deployment & CI/CD

### GitHub Actions Workflow
On push to `main`:
1. SSH to server (45.150.9.195)
2. Pull latest code
3. Run `npm install`
4. Restart PM2 process

### Secrets Required
In GitHub repo settings → Secrets:
- `SERVER_HOST` = 45.150.9.195
- `SERVER_USER` = root
- `SSH_PRIVATE_KEY` = (private key for SSH)

### Nginx Configuration
Located at: `/etc/nginx/sites-available/kitty-chatting`
- Proxies port 80 → localhost:3000
- WebSocket support enabled
- Serves static files through Express

## Future Features (Roadmap)

### Planned
- 🎨 User profiles with avatars
- 🖼️ Image/GIF upload and sending
- 😺 Cat meme library integration
- 🏷️ #hashtags and cat categories
- ⭐ Favorite memes/messages
- 🔍 Search messages
- 🔔 Desktop notifications
- 🎭 Custom emoji/stickers
- 🌍 More languages (beyond EN/RU)
- ⚙️ More settings (notifications, sounds, theme customization)

### Technical Improvements
- Add user registration/authentication
- Implement file upload system
- Add image storage (S3/CDN)
- Pagination for message history
- Private messages/DMs
- Chat rooms/channels
- Message editing/deletion
- Rich text formatting

## Common Issues & Solutions

### Read receipts not persisting after reload
- **Fixed**: Now saved to `read_receipts` table in PostgreSQL
- Read status loads from database on page load
- Green checkmarks restored correctly after refresh

### Checkmarks turning green immediately
- **Fixed**: Viewport-based detection instead of auto-mark on receive
- Messages only marked as read when visible in chat container
- 300ms debounced scroll event for performance

### "undefined" usernames in chat
- **Fixed**: Server validates username exists before operations
- Auto-cleanup of stale socket IDs in typing indicator

### Duplicate online counts
- **Fixed**: Track by full display name (Username!tripcode), not socket ID
- `userConnections` Map handles multiple tabs per user
- First tab triggers "joined" event, last tab triggers "left"

### Logout doesn't work in all tabs
- **Fixed**: localStorage events sync logout across tabs
- Cookie is cleared and all tabs redirect to login instantly

### Tripcode validation errors
- Username must be 2-20 chars, alphanumeric only
- Secret key must be 3+ chars, alphanumeric only
- Format: `Username#secret` (exactly one # symbol required)

### Database permission errors
- Run: `GRANT ALL ON SCHEMA public TO chatuser`
- Set: `ALTER SCHEMA public OWNER TO chatuser`
- Check: `\du` to list users and permissions

## Color Scheme & Branding

### Primary Colors (Dark Cosmic Theme)
- Cosmic gradient: `#0f0c29` → `#302b63` → `#24243e` → `#1a1a2e`
- Read checkmark: `#4CAF50` (green) - indicates message read by others
- Unread checkmark: `rgba(0, 0, 0, 0.4)` (gray) - message not yet read
- Online indicator: `#4CAF50` (green)
- Active language button: `#27AE60` (green)
- Error messages: `#E74C3C` (red)
- Buttons/accents: `#4A90E2` (blue)
- Login page gradients:
  - Auth explanation: `#667eea` → `#764ba2` (purple)
  - Identity preview: `#f093fb` → `#f5576c` (pink)
  - Join button: `#667eea` → `#764ba2` (purple)

### Theme
Modern global chat messenger with dark cosmic theme, glassmorphism effects, 3D star field background, and futuristic design. Wide login page (900px) with clean, professional appearance.

### Design Elements
- **Login Page**: 900px width, modern glassmorphism, two-column input layout
- **3D Star Field**: 6000 stars with varying sizes, rotating slowly (Three.js)
- **Glassmorphism**: Semi-transparent UI with backdrop-filter blur
- **Fullscreen Layout**: No borders/margins, native app feel
- **Animations**:
  - Smooth transitions
  - Shake effects on errors
  - Simple scale animation on settings button (no rotation)
  - Escape key closes modals
- **Responsive**: Breakpoints at 600px, 500px, 400px + landscape optimization
- **Accessibility**: Keyboard navigation (Escape to close modal)
