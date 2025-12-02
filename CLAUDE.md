# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- ✅ Real-time чат с WebSockets (Socket.io)
- ✅ Cookie-based авторизация с автологином
- ✅ История сообщений (PostgreSQL, последние 50)
- ✅ Статусы прочитанности (серая/синяя галочка)
- ✅ Индикатор "печатает..." для нескольких пользователей
- ✅ Умный автоскролл (не мешает читать историю)
- ✅ Подсчет уникальных пользователей (не по вкладкам)
- ✅ Синхронизация логаута между вкладками
- ✅ CI/CD через GitHub Actions

## Architecture

### Stack
- **Backend**: Node.js + Express + Socket.io
- **Frontend**: Vanilla JavaScript (ES6+)
- **Database**: PostgreSQL
- **Deployment**: Custom VPS (Ubuntu) + Nginx + PM2
- **CI/CD**: GitHub Actions → SSH → Auto-deploy

### File Structure
```
.
├── server.js              # Backend: Express + Socket.io
├── db.js                  # Database: PostgreSQL queries
├── ecosystem.config.js    # PM2 configuration
├── public/
│   ├── index.html        # Frontend markup
│   ├── style.css         # Styles with gradient theme
│   └── client.js         # Client-side Socket.io logic
├── .github/workflows/
│   └── deploy.yml        # Auto-deploy on push to main
└── .env                  # Config (NOT in git)
```

### Database Schema

**messages table:**
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Key Maps and State (server.js)
- `users` - Map<socket.id, username>
- `userConnections` - Map<username, Set<socket.ids>>
- `typingUsers` - Set<socket.id>
- `messageReads` - Map<messageId, Set<usernames>>

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

### Multi-Tab User Tracking
Users are tracked by **username**, not socket connections:
- One user with 3 tabs = 1 online user
- `userConnections` Map tracks all socket IDs per username
- "joined" event only fires for first tab
- "left" event only fires when last tab closes

### Read Receipts
- Each message has unique database ID
- Client sends `mark-messages-read` with message IDs
- Server broadcasts `message-read` to update checkmarks
- Gray checkmark (✓) = sent, Blue checkmark (✓) = read

### Auto-Login & Logout Sync
- Username stored in cookie (30 days)
- On page load: check `/api/me` → auto-login if cookie exists
- Logout uses `localStorage` events to sync across all tabs
- When one tab logs out, all tabs logout

### Typing Indicator
- Supports multiple simultaneous typers
- Shows first 2 names: "User1, User2 и еще 5 печатают..."
- Auto-cleanup of stale socket IDs

### Smart Auto-Scroll
- Only scrolls if user is near bottom (<100px)
- Doesn't interrupt when reading history
- Always scrolls for own messages

## API Endpoints

### REST API
- `POST /api/login` - Set username cookie
- `POST /api/logout` - Clear username cookie
- `GET /api/me` - Get current username from cookie

### Socket.io Events

**Client → Server:**
- `user-joined` - Join chat with username
- `send-message` - Send new message
- `typing` - User started typing
- `stop-typing` - User stopped typing
- `mark-messages-read` - Mark messages as read

**Server → Client:**
- `user-connected` - New user joined
- `user-disconnected` - User left
- `user-count-update` - Update online count (for additional tabs)
- `new-message` - New message received
- `message-history` - Load last 50 messages
- `typing-users-update` - Update typing indicator
- `message-read` - Message was read by someone
- `users-list` - List of online users

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
- 🌙 Dark mode theme
- 📱 Mobile responsive improvements
- 🔔 Desktop notifications
- 🎭 Custom emoji/stickers

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

### "undefined" usernames
- Fixed: server validates username exists before operations
- Auto-cleanup of stale socket IDs in typing indicator

### Duplicate online counts
- Fixed: track by username, not socket ID
- `userConnections` Map handles multiple tabs per user

### Logout doesn't work in all tabs
- Fixed: localStorage events sync logout across tabs
- Cookie is cleared and all tabs redirect to login

### Database permission errors
- Run: `GRANT ALL ON SCHEMA public TO chatuser`
- Set: `ALTER SCHEMA public OWNER TO chatuser`

## Color Scheme & Branding

### Primary Colors
- Purple gradient: `#667eea` → `#764ba2`
- Read checkmark: `#667eea` (blue)
- Unread checkmark: `#a0a0a0` (gray)
- Online indicator: `#10b981` (green)

### Theme
Котовый мессенджер с фиолетовым градиентом и дружелюбным интерфейсом для мемного сообщества.
