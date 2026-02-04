const { google } = require('googleapis');
const path = require('path');

// Initialize Auth
const getAuthClient = () => {
    try {
        const keyPath = path.join(__dirname, '../credentials.json');

        return new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
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

module.exports = { fetchLeadsFromSheet };
