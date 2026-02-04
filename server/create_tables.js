const Database = require('better-sqlite3');
const db = new Database('sales_platform.db');

try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS ai_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL, -- INSIGHT, ACTION_REQUIRED, SYSTEM_LOG, DECISION
        severity TEXT DEFAULT 'LOW',
        title TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
    console.log('Table ai_activities created or already exists.');
} catch (e) {
    console.error('Error creating table:', e);
}
