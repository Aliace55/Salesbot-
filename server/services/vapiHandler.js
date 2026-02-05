/**
 * VAPI Voice Handler
 * Handles ringless voicemail drops and inbound call webhooks
 * Docs: https://docs.vapi.ai
 */

const fetch = require('node-fetch');
const { query } = require('../db');

const VAPI_API_BASE = 'https://api.vapi.ai';

/**
 * Send a ringless voicemail via VAPI
 * VAPI calls the number, detects voicemail, plays message, hangs up
 * 
 * @param {string} to - Phone number in E.164 format
 * @param {string} voicemailMessage - Text message for TTS or audio URL
 * @param {number} leadId - Lead ID for logging
 * @param {object} options - Optional overrides
 */
async function sendRinglessVoicemail(to, voicemailMessage, leadId, options = {}) {
    const apiKey = process.env.VAPI_API_KEY;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    const assistantId = process.env.VAPI_VOICEMAIL_ASSISTANT_ID;

    if (!apiKey) {
        console.warn('[VAPI] API key missing');
        return { success: false, error: 'Missing VAPI_API_KEY' };
    }

    try {
        // Create outbound call with voicemail-optimized assistant
        const response = await fetch(`${VAPI_API_BASE}/call`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumberId: phoneNumberId,
                customer: {
                    number: to
                },
                // Use existing assistant or create transient one for voicemail
                ...(assistantId ? { assistantId } : {
                    assistant: {
                        name: 'Voicemail Drop',
                        firstMessage: voicemailMessage,
                        model: {
                            provider: 'openai',
                            model: 'gpt-4o-mini'
                        },
                        voice: {
                            provider: '11labs',
                            voiceId: 'pNInz6obpgDQGcFmaJgB' // Adam - professional male voice
                        },
                        // Voicemail detection - simplified config
                        voicemailDetection: {
                            provider: 'vapi'
                        },
                        // End call after message
                        endCallFunctionEnabled: true,
                        maxDurationSeconds: 60
                    }
                }),
                // Metadata for webhook
                assistantOverrides: {
                    metadata: {
                        leadId: leadId,
                        type: 'RINGLESS_VOICEMAIL'
                    }
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[VAPI] API Error:', data);
            return { success: false, error: data.message || 'API Error' };
        }

        console.log(`[VAPI] Voicemail call initiated to ${to}: ${data.id}`);

        // Log to database
        await query(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES ($1, 'VOICEMAIL', 'OUTBOUND', $2)
        `, [leadId, `Ringless VM: "${voicemailMessage.substring(0, 100)}..."`]);

        // Update lead
        await query(`UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1`, [leadId]);

        return { success: true, callId: data.id };

    } catch (error) {
        console.error('[VAPI] Request failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Handle VAPI webhook for call events
 * Configure webhook in VAPI dashboard: https://your-server.com/webhooks/vapi
 */
async function handleVapiWebhook(body) {
    const { message } = body;

    if (!message) {
        console.log('[VAPI Webhook] Empty message, likely a test');
        return { success: true };
    }

    console.log(`[VAPI Webhook] Event: ${message.type}`);

    switch (message.type) {
        case 'end-of-call-report':
            return await handleEndOfCallReport(message);
        case 'function-call':
            return await handleFunctionCall(message);
        case 'transcript':
            return handleTranscript(message);
        default:
            console.log(`[VAPI Webhook] Unhandled event type: ${message.type}`);
            return { success: true };
    }
}

/**
 * Handle end of call - extract lead info from inbound calls
 */
async function handleEndOfCallReport(message) {
    const { call, transcript, summary } = message;

    // Check if this was an inbound call
    if (call.type === 'inboundPhoneCall') {
        const customerPhone = call.customer?.number;

        if (customerPhone) {
            // Check if lead exists
            const result = await query('SELECT * FROM leads WHERE phone = $1', [customerPhone]);
            let lead = result.rows[0];

            if (!lead) {
                // Create new lead from inbound call
                const insertRes = await query(`
                    INSERT INTO leads (name, phone, source, status, step, lead_type, funnel_stage)
                    VALUES ('Inbound Caller', $1, 'VAPI Inbound', 'NEW', 0, 'INBOUND', 'LEAD')
                    RETURNING id
                `, [customerPhone]);

                lead = { id: insertRes.rows[0].id, name: 'Inbound Caller' };
                console.log(`[VAPI] Created new lead from inbound call: ${lead.id}`);
            }

            // Log the call transcript
            if (transcript) {
                await query(`
                    INSERT INTO messages (lead_id, type, direction, content)
                    VALUES ($1, 'CALL', 'INBOUND', $2)
                `, [lead.id, `AI Call Transcript:\n${transcript}`]);
            }

            // Log summary if available
            if (summary) {
                await query(`
                    UPDATE leads SET notes = COALESCE(notes, '') || $1 WHERE id = $2
                `, [`\n[VAPI Call Summary] ${summary}`, lead.id]);
            }

            // Mark for follow-up
            await query(`UPDATE leads SET status = 'ACTIVE' WHERE id = $1`, [lead.id]);
        }
    }

    // Check metadata for outbound voicemail tracking
    if (call.assistantOverrides?.metadata?.type === 'RINGLESS_VOICEMAIL') {
        const leadId = call.assistantOverrides.metadata.leadId;
        if (leadId) {
            await query(`
                INSERT INTO events (lead_id, type, metadata)
                VALUES ($1, 'VOICEMAIL_DELIVERED', $2)
            `, [leadId, JSON.stringify({
                callId: call.id,
                duration: call.duration,
                status: call.status
            })]);
        }
    }

    return { success: true };
}

/**
 * Handle function calls from VAPI assistant (for lead qualification)
 */
async function handleFunctionCall(message) {
    const { functionCall, call } = message;

    if (functionCall.name === 'logLeadInfo') {
        const { name, company, interest, phone } = functionCall.parameters;
        const customerPhone = phone || call.customer?.number;

        if (customerPhone) {
            // Update or create lead with captured info
            const existingRes = await query('SELECT * FROM leads WHERE phone = $1', [customerPhone]);
            const existing = existingRes.rows[0];

            if (existing) {
                await query(`
                    UPDATE leads SET 
                        name = COALESCE($1, name),
                        company = COALESCE($2, company),
                        product_interest = COALESCE($3, product_interest)
                    WHERE id = $4
                `, [name, company, interest, existing.id]);
            }
        }

        return { success: true, result: 'Lead info logged' };
    }

    return { success: true };
}

/**
 * Handle real-time transcript
 */
function handleTranscript(message) {
    // Could be used for real-time monitoring
    console.log(`[VAPI Transcript] ${message.role}: ${message.transcript}`);
    return { success: true };
}

/**
 * Get call history from VAPI
 */
async function getCallHistory(limit = 50) {
    const apiKey = process.env.VAPI_API_KEY;
    if (!apiKey) return { success: false, error: 'Missing API key' };

    try {
        const response = await fetch(`${VAPI_API_BASE}/call?limit=${limit}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        const data = await response.json();
        return { success: true, calls: data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    sendRinglessVoicemail,
    handleVapiWebhook,
    handleEndOfCallReport,
    getCallHistory
};
