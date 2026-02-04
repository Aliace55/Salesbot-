/**
 * Migration: Add Conversational Memory Schema
 * Run with: node migrate_conversation_memory.js
 */

const { db } = require('./db');

console.log('Adding conversational memory schema...');

try {
    // Add columns to leads table for AI context
    const columnsToAdd = [
        { name: 'extracted_data', type: 'TEXT' },           // JSON blob of all extracted details
        { name: 'conversation_summary', type: 'TEXT' },     // AI-generated conversation summary
        { name: 'last_objection', type: 'TEXT' },           // Most recent objection
        { name: 'buying_signals', type: 'TEXT' },           // Detected buying signals
        { name: 'preferred_channel', type: 'TEXT' }         // Email, SMS, or Phone
    ];

    for (const col of columnsToAdd) {
        try {
            db.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
            console.log(`Added column: ${col.name}`);
        } catch (e) {
            if (e.message.includes('duplicate column')) {
                console.log(`Column ${col.name} already exists`);
            } else {
                throw e;
            }
        }
    }

    // Create lead_context table for structured extraction
    db.exec(`
        CREATE TABLE IF NOT EXISTS lead_context (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            source TEXT,
            confidence REAL DEFAULT 1.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES leads(id)
        )
    `);
    console.log('Created lead_context table');

    // Create index for fast lookups
    db.exec(`CREATE INDEX IF NOT EXISTS idx_lead_context_lead_id ON lead_context(lead_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_lead_context_key ON lead_context(key)`);
    console.log('Created indexes');

    console.log('Migration complete!');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
}
