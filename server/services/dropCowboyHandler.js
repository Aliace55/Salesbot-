/**
 * Drop Cowboy Handler
 * True ringless voicemail - phone never rings, VM just appears
 * Docs: https://dropcowboy.com/docs
 */

const fetch = require('node-fetch');
const { query } = require('../db');

const DROP_COWBOY_API = 'https://api.dropcowboy.com/v1';

/**
 * Send a true ringless voicemail via Drop Cowboy
 * Phone NEVER rings - voicemail deposits directly to carrier
 * 
 * @param {string} to - Phone number (10 digits, no country code)
 * @param {object} options - Message options
 * @param {string} options.recordingId - Pre-recorded audio GUID
 * @param {string} options.voiceId - AI voice ID (if using TTS)
 * @param {string} options.ttsBody - Text for TTS (if using voiceId)
 * @param {string} options.postalCode - Recipient's zip code (for TCPA compliance)
 * @param {number} leadId - Lead ID for logging
 */
async function sendRinglessVoicemail(to, options, leadId) {
    const teamId = process.env.DROP_COWBOY_TEAM_ID;
    const secret = process.env.DROP_COWBOY_SECRET;
    const brandId = process.env.DROP_COWBOY_BRAND_ID;
    const callbackNumber = process.env.DROP_COWBOY_CALLBACK_NUMBER || process.env.TWILIO_PHONE_NUMBER;

    if (!teamId || !secret) {
        console.warn('[Drop Cowboy] Missing credentials');
        return { success: false, error: 'Missing DROP_COWBOY_TEAM_ID or DROP_COWBOY_SECRET' };
    }

    if (!brandId) {
        console.warn('[Drop Cowboy] Missing brand ID');
        return { success: false, error: 'Missing DROP_COWBOY_BRAND_ID' };
    }

    // Clean phone number to 10 digits
    const cleanPhone = to.replace(/\D/g, '').replace(/^1/, '');

    if (cleanPhone.length !== 10) {
        return { success: false, error: 'Phone number must be 10 digits' };
    }

    try {
        const body = {
            team_id: teamId,
            secret: secret,
            foreign_id: `salesbot-lead-${leadId}-${Date.now()}`,
            brand_id: brandId,
            phone_number: cleanPhone,
            forwarding_number: callbackNumber?.replace(/\D/g, '') || '',
            postal_code: options.postalCode || '60601', // Default to Chicago
            callback_url: process.env.BASE_URL ? `${process.env.BASE_URL}/webhooks/dropcowboy` : null
        };

        // Use either pre-recorded audio OR TTS
        if (options.recordingId) {
            body.recording_id = options.recordingId;
        } else if (options.voiceId && options.ttsBody) {
            body.voice_id = options.voiceId;
            body.tts_body = options.ttsBody;
        } else {
            // Default TTS message
            body.voice_id = process.env.DROP_COWBOY_DEFAULT_VOICE_ID;
            body.tts_body = options.message || options.ttsBody || 'This is a message from TrackmyTruck. Please call us back at your convenience.';
        }

        const response = await fetch(`${DROP_COWBOY_API}/rvm`, {
            method: 'POST',
            headers: {
                'x-team-id': teamId,
                'x-secret': secret,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Drop Cowboy] API Error:', data);
            return { success: false, error: data.message || data.error || 'API Error' };
        }

        console.log(`[Drop Cowboy] Ringless VM queued for ${to}: ${data.id || 'OK'}`);

        // Log to database
        await query(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES ($1, 'VOICEMAIL', 'OUTBOUND', $2)
        `, [leadId, `Ringless VM (Drop Cowboy): "${(options.ttsBody || options.message || 'Pre-recorded').substring(0, 100)}..."`]);

        // Update lead
        await query(`UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1`, [leadId]);

        return { success: true, messageId: data.id, status: 'queued' };

    } catch (error) {
        console.error('[Drop Cowboy] Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handle Drop Cowboy webhook for delivery status
 * Configure in Drop Cowboy dashboard
 */
async function handleWebhook(body) {
    const { event, phone_number, foreign_id, status, error } = body;

    console.log(`[Drop Cowboy Webhook] ${event}: ${phone_number} - ${status || error}`);

    // Extract lead ID from foreign_id (format: salesbot-lead-123-timestamp)
    const leadIdMatch = foreign_id?.match(/salesbot-lead-(\d+)/);
    const leadId = leadIdMatch ? parseInt(leadIdMatch[1]) : null;

    if (leadId) {
        // Log event
        await query(`
            INSERT INTO events (lead_id, type, metadata)
            VALUES ($1, 'RVM_STATUS', $2)
        `, [leadId, JSON.stringify({
            event,
            status,
            error,
            phone_number,
            timestamp: new Date().toISOString()
        })]);

        // Handle specific events
        if (event === 'delivered' || status === 'delivered') {
            console.log(`[Drop Cowboy] VM delivered to lead ${leadId}`);
        } else if (event === 'bounced' || status === 'bounced') {
            // Could mark lead as bad phone
            console.log(`[Drop Cowboy] VM bounced for lead ${leadId}`);
        } else if (event === 'optout' || event === 'opt-out') {
            // Mark lead as opted out
            await query(`UPDATE leads SET status = 'OPTED_OUT' WHERE id = $1`, [leadId]);
            console.log(`[Drop Cowboy] Lead ${leadId} opted out`);
        }
    }

    return { success: true };
}

/**
 * Get brands from Drop Cowboy (for setup)
 */
async function getBrands() {
    const teamId = process.env.DROP_COWBOY_TEAM_ID;
    const secret = process.env.DROP_COWBOY_SECRET;

    if (!teamId || !secret) {
        return { success: false, error: 'Missing credentials' };
    }

    try {
        const response = await fetch(`${DROP_COWBOY_API}/brands`, {
            headers: {
                'x-team-id': teamId,
                'x-secret': secret
            }
        });

        const data = await response.json();
        return { success: true, brands: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Get voices from Drop Cowboy (for TTS)
 */
async function getVoices() {
    const teamId = process.env.DROP_COWBOY_TEAM_ID;
    const secret = process.env.DROP_COWBOY_SECRET;

    if (!teamId || !secret) {
        return { success: false, error: 'Missing credentials' };
    }

    try {
        const response = await fetch(`${DROP_COWBOY_API}/voices`, {
            headers: {
                'x-team-id': teamId,
                'x-secret': secret
            }
        });

        const data = await response.json();
        return { success: true, voices: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendRinglessVoicemail,
    handleWebhook,
    getBrands,
    getVoices
};
