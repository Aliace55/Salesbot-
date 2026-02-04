const { db } = require('./db');

try {
    console.log('Migrating DB: Adding product_interest column...');
    db.prepare("ALTER TABLE leads ADD COLUMN product_interest TEXT").run();
    console.log('Success: Column added.');
} catch (err) {
    if (err.message.includes('duplicate column name')) {
        console.log('Column already exists. Skipping.');
    } else {
        console.error('Migration Failed:', err);
    }
}
