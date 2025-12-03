-- Migration: Add users table for tripcode authentication
-- Date: 2025-12-03

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL,
  tripcode VARCHAR(16) NOT NULL, -- First 8 chars of SHA-256 hash
  full_display_name VARCHAR(67) NOT NULL, -- "Username!tripcode"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  UNIQUE(username, tripcode)
);

-- Add user_id to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username_tripcode ON users(username, tripcode);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Update existing messages to have NULL user_id (legacy messages)
-- Future messages will have user_id set
