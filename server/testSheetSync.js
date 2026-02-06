require('dotenv').config();
const { runFullSync } = require('./services/sheetSync');
const { query } = require('./db');

async function testSync() {
    console.log('--- Testing Google Sheets Sync ---');
    console.log('1. Running Full Sync...');

    try {
        const result = await runFullSync();
        console.log('Sync Result:', result);

        if (result.success) {
            console.log('2. Verifying DB update...');
            const res = await query("SELECT count(*) as count FROM leads WHERE sheet_row_id IS NOT NULL");
            console.log(`Leads linked to Sheets: ${res.rows[0].count}`);
        }
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

testSync();
