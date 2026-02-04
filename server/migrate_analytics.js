const { db } = require('./db');

console.log('--- Migrating DB for Analytics 2.0 ---');

// 1. Add Source/Campaign to Leads
try {
    db.prepare("ALTER TABLE leads ADD COLUMN source TEXT").run();
    console.log('✅ Added column: source');
} catch (e) { console.log('ℹ️ Column source exists'); }

try {
    db.prepare("ALTER TABLE leads ADD COLUMN campaign TEXT").run();
    console.log('✅ Added column: campaign');
} catch (e) { console.log('ℹ️ Column campaign exists'); }

// 2. Create Events Table
try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lead_id INTEGER,
        type TEXT, -- EMAIL_OPEN, LINK_CLICK, PAGE_VIEW
        meta TEXT, -- JSON or URL
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lead_id) REFERENCES leads(id)
      );
    `);
    console.log('✅ Created table: events');
} catch (e) {
    console.error('❌ Failed to create events table:', e);
}

console.log('--- Migration Complete ---');
