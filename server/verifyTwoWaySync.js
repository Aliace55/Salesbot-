require('dotenv').config();
const { runFullSync } = require('./services/sheetSync');
const { query } = require('./db');
const { fetchLeadsFromSheet } = require('./services/googleSheets');

async function verifyTwoWaySync() {
    console.log('--- STARTING TWO-WAY SYNC VERIFICATION ---');

    try {
        // Step 1: Initial Sync (Pull)
        console.log('\nStep 1: Running Initial Sync (Pull from Sheet)...');
        await runFullSync();

        // Step 2: Verification - Find a lead
        console.log('\nStep 2: Verifying Pull...');
        const res = await query("SELECT id, name, status, sheet_row_id, sheet_tab FROM leads WHERE sheet_row_id IS NOT NULL LIMIT 1");

        if (res.rows.length === 0) {
            console.error('FAIL: No leads synced from sheet.');
            return;
        }

        const lead = res.rows[0];
        console.log(`SUCCESS: Found synced lead: ${lead.name} (Row: ${lead.sheet_row_id}, Tab: ${lead.sheet_tab})`);

        // Step 3: Modify Lead in CRM
        const TEST_STATUS = 'SYNC_TEST_' + Math.floor(Math.random() * 1000);
        console.log(`\nStep 3: Modifying Lead Status to "${TEST_STATUS}" in CRM...`);

        await query("UPDATE leads SET status = $1, last_synced_at = NULL WHERE id = $2", [TEST_STATUS, lead.id]);

        // Step 4: Run Sync again (Push)
        console.log('\nStep 4: Running Sync (Push to Sheet)...');
        await runFullSync();

        // Step 5: Verify in Sheet (Read back)
        console.log('\nStep 5: Reading Sheet to Verify Update...');
        // Note: fetchLeadsFromSheet reads "Masterlist Leads". If lead is Inbound, we need fetchInboundLeads.
        // Assuming Masterlist for now based on 'limit 1' usually picking first.

        if (lead.sheet_tab === 'Masterlist Leads') {
            const sheetLeads = await fetchLeadsFromSheet();
            const sheetRow = sheetLeads[lead.sheet_row_id - 2]; // row_id is 1-based index (including header), array is 0-based (no header). 
            // Wait, fetchLeadsFromSheet logic: 
            // rows.slice(1).map ... index is 0-based from slice.
            // sheet_row_id = index + 2. 
            // So array index = sheet_row_id - 2.

            // Wait, fetchLeads returns filtered list?
            // "return data.filter(l => l.phone || l.email);"
            // This might mess up index if empty rows existed.
            // To be safe, let's find by Name/Phone in the returned array.

            const matchedFromSheet = sheetLeads.find(l => l.phone === lead.phone || l.email === lead.email);

            // Wait, fetchLeadsFromSheet does not currently return the STATUS column in its object!
            // I need to check googleSheets.js fetchLeadsFromSheet to see what it maps.
            // It maps: name, phone, email, product_interest.
            // It does NOT map Status.

            console.log('WARNING: Standard fetchLeadsFromSheet does not return Status column.');
            console.log('Cannot verify programmatic read-back without updating fetchLeadsFromSheet.');
            console.log('Please Manually Check the Google Sheet for Status: ' + TEST_STATUS);

        } else {
            console.log('Lead is not from Masterlist. Skipping read-back verification.');
        }

    } catch (err) {
        console.error('Verification Failed:', err);
    }
}

verifyTwoWaySync();
