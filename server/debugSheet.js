const dotenv = require('dotenv');
const { fetchLeadsFromSheet } = require('./services/googleSheets');

dotenv.config();

async function run() {
    console.log('--- Debugging Google Sheets ---');
    console.log('Sheet ID:', process.env.GOOGLE_SHEET_ID);

    try {
        const leads = await fetchLeadsFromSheet();
        console.log('--- Result ---');
        console.log(`Found ${leads.length} leads.`);
        console.log(JSON.stringify(leads, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
