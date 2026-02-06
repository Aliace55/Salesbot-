const { google } = require('googleapis');
const path = require('path');

// Initialize Auth
const getAuthClient = () => {
    try {
        const keyPath = path.join(__dirname, '../credentials.json');

        return new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Read + Write
        });
    } catch (err) {
        console.error('Failed to load credentials.json:', err);
        return null;
    }
};

const sheets = google.sheets('v4');

/**
 * Fetches all leads from the configured Google Sheet
 * Assumes Row 1 is Headers: Name, Phone, Email
 */
async function fetchLeadsFromSheet() {
    const auth = getAuthClient();
    if (!auth) return [];

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Masterlist Leads!A1:Z'; // Updated Tab Name

    try {
        const response = await sheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range,
        });

        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            console.log('No data found in sheet.');
            return [];
        }

        // Map rows to objects based on headers
        const headers = rows[0].map(h => h.toLowerCase().trim());

        const data = rows.slice(1).map(row => {
            let lead = {};
            let firstName = '';
            let lastName = '';

            headers.forEach((header, index) => {
                const val = row[index];
                if (!val) return;

                if (header === 'first name' || header === 'name') firstName = val;
                if (header === 'last name') lastName = val;
                if (header.includes('phone') || header.includes('mobile')) lead.phone = val;
                if (header.includes('email')) lead.email = val;
                if (header.includes('product') || header.includes('segment') || header.includes('interest')) lead.product_interest = val;
            });

            // Construct full name
            lead.name = [firstName, lastName].filter(Boolean).join(' ');

            return lead;
        });

        // Filter out empty rows
        return data.filter(l => l.phone || l.email);

    } catch (error) {
        console.error('The API returned an error: ' + error);
        return [];
    }
}

module.exports = { fetchLeadsFromSheet, fetchInboundLeads, writeLeadToSheet, updateLeadInSheet };

/**
 * Fetches leads from the "Inbound" tab
 */
async function fetchInboundLeads() {
    const auth = getAuthClient();
    if (!auth) return [];

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Inbound!A1:Z';

    try {
        const response = await sheets.spreadsheets.values.get({
            auth,
            spreadsheetId,
            range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) return [];

        // Headers: Name, Phone, Email, Interest, Source, Notes
        const headers = rows[0].map(h => h.toLowerCase().trim());

        return rows.slice(1).map((row, index) => {
            let lead = { sheet_row_id: index + 2 }; // +2 because 0-index + 1 header

            headers.forEach((header, colIndex) => {
                const val = row[colIndex];
                if (!val) return;

                if (header.includes('name')) lead.name = val;
                if (header.includes('phone')) lead.phone = val;
                if (header.includes('email')) lead.email = val;
                if (header.includes('source')) lead.source = val;
                if (header.includes('status')) lead.status = val;
            });
            return lead;
        }).filter(l => l.phone || l.email);

    } catch (error) {
        console.error('Error fetching inbound leads:', error);
        return [];
    }
}

/**
 * Write a new lead to a specific Sheet tab
 * @param {object} lead - Lead data
 * @param {string} tabName - "Masterlist Leads" or "Inbound"
 */
async function writeLeadToSheet(lead, tabName) {
    const auth = getAuthClient();
    if (!auth) return false;

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Default columns (simplified)
    const values = [
        [
            lead.name,
            lead.phone,
            lead.email,
            lead.company,
            lead.status,
            new Date().toISOString()
        ]
    ];

    try {
        await sheets.spreadsheets.values.append({
            auth,
            spreadsheetId,
            range: `${tabName}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });
        return true;
    } catch (error) {
        console.error(`Error writing to ${tabName}:`, error);
        return false;
    }
}

/**
 * Update a specific row in the Sheet
 * @param {number} rowNumber - The row number to update (1-based)
 * @param {object} updates - Key-value pairs of updates
 * @param {string} tabName - Tab name
 */
async function updateLeadInSheet(rowNumber, updates, tabName) {
    const auth = getAuthClient();
    if (!auth) return false;

    // This is tricky without knowing exact column mapping.
    // For V1, we'll assume a fixed Status column is Column E (index 4)
    // and Notes is Column F (index 5) depending on the sheet structure.
    // To make this robust, we should read headers first, but for now let's update STATUS only.

    // STATUS UPDATE IMPLEMENTATION (Column E assumed)
    if (updates.status) {
        try {
            await sheets.spreadsheets.values.update({
                auth,
                spreadsheetId: process.env.GOOGLE_SHEET_ID,
                range: `${tabName}!E${rowNumber}`, // Column E is likely Status/Stage
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[updates.status]] }
            });
            return true;
        } catch (error) {
            console.error(`Error updating row ${rowNumber}:`, error);
            return false;
        }
    }
    return true;
}
