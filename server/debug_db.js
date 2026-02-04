const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve('sales_platform.db');
console.log('DB Path:', dbPath);
console.log('DB Exists:', fs.existsSync(dbPath));

const db = new Database('sales_platform.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

const activities = db.prepare("SELECT count(*) as count FROM ai_activities").get();
console.log('Activities count:', activities.count);
