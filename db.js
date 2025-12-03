const { Pool } = require('pg');
const crypto = require('crypto');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Generate tripcode from secret
function generateTripcode(secret) {
  const hash = crypto.createHash('sha256').update(secret).digest('hex');
  return hash.slice(0, 8); // First 8 characters
}

// Initialize database tables
async function initDB() {
  try {
    // Create messages table (legacy)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);
    `);

    // Create users table for tripcode authentication
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        tripcode VARCHAR(16) NOT NULL,
        full_display_name VARCHAR(67) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        UNIQUE(username, tripcode)
      );
    `);

    // Add user_id column to messages if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'messages' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE messages ADD COLUMN user_id INTEGER REFERENCES users(id);
        END IF;
      END $$;
    `);

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username_tripcode ON users(username, tripcode);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
    `);

    // Create read_receipts table to track who read which messages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS read_receipts (
        id SERIAL PRIMARY KEY,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        reader_username VARCHAR(67) NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(message_id, reader_username)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_read_receipts_message_id ON read_receipts(message_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_read_receipts_reader ON read_receipts(reader_username);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Create or get user with tripcode
async function createOrGetTripcodeUser(username, tripcode) {
  try {
    const fullDisplayName = tripcode ? `${username}!${tripcode}` : username;

    // Try to find existing user
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND tripcode = $2',
      [username, tripcode || '']
    );

    if (existingUser.rows.length > 0) {
      // Update last_seen
      await pool.query(
        'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
        [existingUser.rows[0].id]
      );
      return existingUser.rows[0];
    }

    // Create new user
    const result = await pool.query(
      `INSERT INTO users (username, tripcode, full_display_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, tripcode || '', fullDisplayName]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error creating/getting tripcode user:', error);
    throw error;
  }
}

// Update user's last seen time
async function updateLastSeen(userId) {
  try {
    await pool.query(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error updating last seen:', error);
  }
}

// Increment user's message count
async function incrementMessageCount(userId) {
  try {
    await pool.query(
      'UPDATE users SET message_count = message_count + 1 WHERE id = $1',
      [userId]
    );
  } catch (error) {
    console.error('Error incrementing message count:', error);
  }
}

// Save message to database (updated to include user_id)
async function saveMessage(username, message, userId = null) {
  try {
    const result = await pool.query(
      'INSERT INTO messages (username, message, user_id) VALUES ($1, $2, $3) RETURNING *',
      [username, message, userId]
    );

    // Increment message count for user
    if (userId) {
      await incrementMessageCount(userId);
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

// Get last N messages (updated to include user info)
async function getRecentMessages(limit = 50) {
  try {
    const result = await pool.query(
      `SELECT m.*, u.full_display_name, u.tripcode
       FROM messages m
       LEFT JOIN users u ON m.user_id = u.id
       ORDER BY m.timestamp DESC
       LIMIT $1`,
      [limit]
    );
    // Reverse to show oldest first
    return result.rows.reverse();
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
}

// Mark message as read by a user
async function markMessageAsRead(messageId, readerUsername) {
  try {
    await pool.query(
      `INSERT INTO read_receipts (message_id, reader_username)
       VALUES ($1, $2)
       ON CONFLICT (message_id, reader_username) DO NOTHING`,
      [messageId, readerUsername]
    );
    return true;
  } catch (error) {
    console.error('Error marking message as read:', error);
    return false;
  }
}

// Get read receipts for a list of messages
async function getReadReceiptsForMessages(messageIds) {
  try {
    if (!messageIds || messageIds.length === 0) {
      return {};
    }

    const result = await pool.query(
      `SELECT message_id, reader_username
       FROM read_receipts
       WHERE message_id = ANY($1)`,
      [messageIds]
    );

    // Group by message_id
    const receipts = {};
    result.rows.forEach(row => {
      if (!receipts[row.message_id]) {
        receipts[row.message_id] = [];
      }
      receipts[row.message_id].push(row.reader_username);
    });

    return receipts;
  } catch (error) {
    console.error('Error getting read receipts:', error);
    return {};
  }
}

module.exports = {
  initDB,
  generateTripcode,
  createOrGetTripcodeUser,
  updateLastSeen,
  saveMessage,
  getRecentMessages,
  markMessageAsRead,
  getReadReceiptsForMessages,
  pool
};
