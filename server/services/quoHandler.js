/**
 * Quo SMS Handler
 * Sends SMS via Quo's API (A2P registered)
 * Docs: https://quo.com/api
 */

const fetch = require('node-fetch');
const { db } = require('../db');

const QUO_API_BASE = 'https://api.openphone.com/v1';

/**
 * Send an SMS via Quo
 * @param {string} to - Phone number in E.164 format (+1234567890)
 * @param {string} content - Message content
 * @param {string} from - Optional: sender phone number or ID
 */
async function sendSMS(to, content, from = null) {
    const apiKey = process.env.QUO_API_KEY;

    if (!apiKey) {
        console.warn('[Quo] API key missing in .env');
        return { success: false, error: 'Missing QUO_API_KEY' };
    }

    const senderPhone = from || process.env.QUO_PHONE_NUMBER;

    if (!senderPhone) {
        console.warn('[Quo] No sender phone number configured');
        return { success: false, error: 'Missing QUO_PHONE_NUMBER' };
    }

    try {
        const response = await fetch(`${QUO_API_BASE}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: senderPhone,
                to: [to], // API expects array
                content: content
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Quo] API Error:', data);
            return { success: false, error: data.message || 'API Error' };
        }

        console.log(`[Quo] SMS sent to ${to}: ${data.id || 'OK'}`);
        return { success: true, messageId: data.id };

    } catch (error) {
        console.error('[Quo] Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handle incoming webhook from Quo
 * Configure webhook URL in Quo dashboard: https://your-server.com/webhooks/quo
 */
async function handleIncomingMessage(body) {
    const from = body.from;
    const content = body.content || body.body || body.message;

    console.log(`[Quo] Received SMS from ${from}: ${content}`);

    // Find the lead
    const lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(from);

    if (lead) {
        // Stop automation - human responded
        db.prepare("UPDATE leads SET status = 'MANUAL_INTERVENTION' WHERE id = ?").run(lead.id);
        console.log(`[Quo] Stopped automation for lead ${lead.id} (${lead.name})`);

        // Log the message
        db.prepare(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES (?, 'SMS', 'INBOUND', ?)
        `).run(lead.id, content);

        // EXTRACT DETAILS FROM MESSAGE (Conversational Memory)
        try {
            const { processIncomingMessage } = require('./detailExtractor');
            await processIncomingMessage(lead.id, content);
            console.log(`[Quo] Extracted details from message for lead ${lead.id}`);
        } catch (extractErr) {
            console.log('[Quo] Detail extraction error (non-fatal):', extractErr.message);
        }

        // Update preferred channel
        db.prepare(`UPDATE leads SET preferred_channel = 'SMS' WHERE id = ?`).run(lead.id);
    } else {
        console.log('[Quo] Received SMS from unknown number:', from);
    }

    return { success: true };
}

/**
 * Get phone numbers from Quo account
 */
async function getPhoneNumbers() {
    const apiKey = process.env.QUO_API_KEY;
    if (!apiKey) return { success: false, error: 'Missing API key' };

    try {
        const response = await fetch(`${QUO_API_BASE}/phone-numbers`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        const data = await response.json();
        return { success: true, phoneNumbers: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendSMS,
    handleIncomingMessage,
    getPhoneNumbers
};
