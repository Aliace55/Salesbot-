const { query } = require('../db');
const { fetchLeadsFromSheet, fetchInboundLeads, writeLeadToSheet, updateLeadInSheet } = require('./googleSheets');
const { researchCompany } = require('./researchService');

/**
 * Sync Engine for Google Sheets <-> CRM
 */

// Mapping CRM fields to Google Sheet Headers (for writes)
// We only write back status/notes for now to avoid overwriting user data
const COLUMN_MAP = {
    status: 'Status',
    last_contacted_at: 'Last Contact',
    notes: 'Notes'
};

/**
 * Run Full Sync
 * 1. Pull Outbound (Masterlist) -> CRM
 * 2. Pull Inbound -> CRM
 * 3. Push CRM Updates -> Sheets
 */
async function runFullSync() {
    console.log('[SheetSync] Starting full sync cycle...');
    const start = Date.now();

    try {
        await syncOutboundLeads();
        await syncInboundLeads();
        await pushCRMUpdates();
        console.log(`[SheetSync] Full sync completed in ${Date.now() - start}ms`);
        return { success: true };
    } catch (err) {
        console.error('[SheetSync] Sync failed:', err);
        return { success: false, error: err.message };
    }
}

/**
 * 1. Sync "Masterlist Leads" -> CRM (Outbound)
 */
async function syncOutboundLeads() {
    console.log('[SheetSync] Syncing Outbound (Masterlist)...');
    const leads = await fetchLeadsFromSheet();
    let newCount = 0;
    let updateCount = 0;

    for (const [index, row] of leads.entries()) {
        const sheetRowId = index + 2; // header+0-based
        // Check if exists by sheet_row_id AND sheet_tab
        // OR by email/phone if row_id is missing (first sync)

        let existing = null;

        // Try finding by Row ID first (most reliable)
        const resRow = await query(
            "SELECT id, last_synced_at FROM leads WHERE sheet_row_id = $1 AND sheet_tab = 'Masterlist Leads'",
            [sheetRowId]
        );
        if (resRow.rows.length > 0) existing = resRow.rows[0];

        // If not found, try email/phone (dedupe)
        if (!existing && row.email) {
            const resEmail = await query("SELECT id FROM leads WHERE email = $1", [row.email]);
            if (resEmail.rows.length > 0) existing = resEmail.rows[0];
        }

        if (existing) {
            // Update mapping if needed
            if (!existing.sheet_row_id) {
                await query(
                    "UPDATE leads SET sheet_row_id = $1, sheet_tab = 'Masterlist Leads' WHERE id = $2",
                    [sheetRowId, existing.id]
                );
            }
            // logic: we generally Trust CRM more for Status, but Sheet for Contact Info
            // For now, let's just update contact info if changed? 
            // actually, simpler: Just update basics
        } else {
            // INSERT NEW
            await query(`
                INSERT INTO leads (
                    name, phone, email, company, product_interest, source, 
                    status, lead_type, 
                    sheet_row_id, sheet_tab, last_synced_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'NEW', 'OUTBOUND', $7, 'Masterlist Leads', NOW())
            `, [
                row.name, row.phone, row.email, row.company, row.product_interest, 'Google Sheet',
                sheetRowId
            ]);
            newCount++;

            // Trigger Background Research for NEW leads
            if (row.company) {
                // We don't await this to keep sync fast
                researchCompany(row.company, null).then(async (summary) => {
                    if (summary) {
                        try {
                            // Update Lead
                            await query("UPDATE leads SET research_summary = $1 WHERE sheet_row_id = $2 AND sheet_tab = 'Masterlist Leads'", [summary, sheetRowId]);
                            // Update Company (if exists or create)
                            // Ideally we'd use getOrCreateCompany logic here but for now just logging it
                            console.log(`[Research] Completed for ${row.company}`);
                        } catch (e) {
                            console.error('[Research] Failed to save summary:', e);
                        }
                    }
                }).catch(err => console.error('[Research] Failed:', err));
            }
        }
    }
    console.log(`[SheetSync] Outbound: ${newCount} new leads.`);
}

/**
 * 2. Sync "Inbound" -> CRM (Inbound)
 */
async function syncInboundLeads() {
    console.log('[SheetSync] Syncing Inbound...');
    const leads = await fetchInboundLeads();
    let newCount = 0;

    for (const lead of leads) {
        const sheetRowId = lead.sheet_row_id;

        // Check existence
        const res = await query(
            "SELECT id FROM leads WHERE sheet_row_id = $1 AND sheet_tab = 'Inbound'",
            [sheetRowId]
        );

        if (res.rows.length === 0) {
            // Check for existing lead by email to prevent duplicates (if pushed via Webhook first)
            let existingId = null;
            if (lead.email) {
                const dupCheck = await query("SELECT id FROM leads WHERE email = $1", [lead.email]);
                if (dupCheck.rows.length > 0) existingId = dupCheck.rows[0].id;
            }

            if (existingId) {
                // Link existing webhook lead to this sheet row
                await query(
                    "UPDATE leads SET sheet_row_id = $1, sheet_tab = 'Inbound' WHERE id = $2",
                    [sheetRowId, existingId]
                );
            } else {
                // Insert New Inbound
                await query(`
                    INSERT INTO leads (
                        name, phone, email, source, status, lead_type,
                        sheet_row_id, sheet_tab, last_synced_at
                    ) VALUES ($1, $2, $3, $4, 'NEW', 'INBOUND', $5, 'Inbound', NOW())
                `, [
                    lead.name, lead.phone, lead.email, lead.source || 'Inbound Sheet',
                    sheetRowId
                ]);
                newCount++;
            }
        }
    }
    console.log(`[SheetSync] Inbound: ${newCount} new leads.`);
}

/**
 * 3. Push CRM Updates -> Sheets
 */
async function pushCRMUpdates() {
    console.log('[SheetSync] Pushing updates to Sheets...');

    // Find leads where updated_at > last_synced_at (and has sheet_row_id)
    // For simplicity/robustness in V1, let's just push ALL changed statuses 
    // real logic: look for modified leads

    // We select leads that have changed since last sync
    // We'll trust last_synced_at

    const res = await query(`
        SELECT id, sheet_row_id, sheet_tab, status, notes, last_contacted_at 
        FROM leads 
        WHERE sheet_row_id IS NOT NULL 
        AND (last_synced_at IS NULL OR last_activity > last_synced_at OR stage_changed_at > last_synced_at)
        LIMIT 50
    `); // Limit 50 to avoid rate limits per batch

    for (const lead of res.rows) {
        if (!lead.sheet_row_id || !lead.sheet_tab) continue;

        const updates = {
            status: lead.status
            // future: notes, last contact
        };

        const success = await updateLeadInSheet(lead.sheet_row_id, updates, lead.sheet_tab);

        if (success) {
            await query("UPDATE leads SET last_synced_at = NOW() WHERE id = $1", [lead.id]);
        }
    }
    console.log(`[SheetSync] Pushed updates for ${res.rows.length} leads.`);
}

module.exports = { runFullSync };
