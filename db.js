const { Pool } = require('pg');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDB() {
  try {
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

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Save message to database
async function saveMessage(username, message) {
  try {
    const result = await pool.query(
      'INSERT INTO messages (username, message) VALUES ($1, $2) RETURNING *',
      [username, message]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

// Get last N messages
async function getRecentMessages(limit = 50) {
  try {
    const result = await pool.query(
      'SELECT * FROM messages ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    // Reverse to show oldest first
    return result.rows.reverse();
  } catch (error) {
    console.error('Error getting messages:', error);
    throw error;
  }
}

module.exports = {
  initDB,
  saveMessage,
  getRecentMessages,
  pool
};
