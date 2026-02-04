const twilio = require('twilio');
const { db } = require('../db');

const getClient = () => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.warn('Twilio Credentials missing in .env');
        return null;
    }
    return twilio(accountSid, authToken);
};

// ==================== SMS ====================

/**
 * Send an SMS to a lead
 * @param {string} to - Phone number E.164 format
 * @param {string} body - Message content
 */
async function sendSMS(to, body) {
    const client = getClient();
    if (!client) return { success: false, error: 'No Credentials' };

    try {
        const message = await client.messages.create({
            body: body,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });
        console.log(`SMS Sent to ${to}: ${message.sid}`);
        return { success: true, sid: message.sid };
    } catch (error) {
        console.error(`Failed to send SMS to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handle incoming webhook from Twilio
 * @param {object} body - Twilio webhook body (From, Body)
 */
function handleIncomingMessage(body) {
    const from = body.From; // E.164
    const content = body.Body;

    console.log(`Received SMS from ${from}: ${content}`);

    // 1. Find the lead
    const lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(from);

    if (lead) {
        // 2. STOP AUTOMATION
        db.prepare("UPDATE leads SET status = 'MANUAL_INTERVENTION' WHERE id = ?").run(lead.id);
        console.log(`Stopped automation for lead ${lead.id} (${lead.name})`);

        // 3. Log Message
        db.prepare(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES (?, 'SMS', 'INBOUND', ?)
        `).run(lead.id, content);
    } else {
        console.log('Received SMS from unknown number:', from);
    }
}

// ==================== VOICE (VoIP) ====================

/**
 * Initiate an outbound call using Twilio Voice
 * @param {string} to - Phone number to call (E.164)
 * @param {number} leadId - Lead ID for logging
 * @param {string} repPhone - Rep's phone number to connect (optional)
 * @returns {Promise<{success: boolean, callSid?: string, error?: string}>}
 */
async function initiateCall(to, leadId, repPhone = null) {
    const client = getClient();
    if (!client) return { success: false, error: 'No Credentials' };

    try {
        // TwiML URL that tells Twilio what to do when call connects
        // For now, just connect to rep's phone or play a message
        const twimlUrl = repPhone
            ? `http://twimlets.com/forward?PhoneNumber=${encodeURIComponent(repPhone)}`
            : 'http://demo.twilio.com/welcome/voice/';

        const call = await client.calls.create({
            url: twimlUrl,
            to: to,
            from: process.env.TWILIO_PHONE_NUMBER,
            statusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/webhooks/twilio-voice-status`,
            statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
        });

        console.log(`Call initiated to ${to}: ${call.sid}`);

        // Log the call attempt
        db.prepare(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES (?, 'CALL', 'OUTBOUND', ?)
        `).run(leadId, `Call initiated: ${call.sid}`);

        // Log event
        db.prepare(`
            INSERT INTO events (lead_id, type, meta)
            VALUES (?, 'CALL_INITIATED', ?)
        `).run(leadId, JSON.stringify({ callSid: call.sid, to }));

        return { success: true, callSid: call.sid };
    } catch (error) {
        console.error(`Failed to initiate call to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handle Twilio Voice status callback
 * @param {object} body - Twilio status webhook body
 */
function handleCallStatus(body) {
    const { CallSid, CallStatus, To, Duration } = body;
    console.log(`Call ${CallSid} status: ${CallStatus}`);

    // Find the lead by phone
    const lead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(To);

    if (lead && CallStatus === 'completed') {
        // Log call completion
        db.prepare(`
            INSERT INTO events (lead_id, type, meta)
            VALUES (?, 'CALL_COMPLETED', ?)
        `).run(lead.id, JSON.stringify({ callSid: CallSid, duration: Duration }));

        // Update last contacted
        db.prepare(`UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?`).run(lead.id);
    }
}

// ==================== RINGLESS VOICEMAIL (Placeholder) ====================

/**
 * Send a ringless voicemail using Drop Cowboy or Slybroadcast
 * NOTE: Requires separate API subscription
 * @param {string} to - Phone number
 * @param {string} audioUrl - URL to audio file
 * @param {number} leadId - Lead ID for logging
 */
async function sendRinglessVoicemail(to, audioUrl, leadId) {
    // TODO: Integrate with Drop Cowboy API
    // Example endpoint: https://api.dropcowboy.com/v1/voicedrops
    // Requires: API_KEY, CAMPAIGN_ID

    console.log(`[Placeholder] Ringless VM to ${to} with audio: ${audioUrl}`);

    // Log the attempt
    db.prepare(`
        INSERT INTO messages (lead_id, type, direction, content)
        VALUES (?, 'VOICEMAIL', 'OUTBOUND', ?)
    `).run(leadId, `Ringless VM: ${audioUrl}`);

    return { success: true, provider: 'placeholder' };
}

module.exports = {
    sendSMS,
    handleIncomingMessage,
    initiateCall,
    handleCallStatus,
    sendRinglessVoicemail
};
