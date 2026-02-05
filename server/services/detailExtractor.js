/**
 * Detail Extraction Service
 * Uses AI to extract key information from lead messages
 */

/**
 * Detail Extraction Service
 * Uses AI to extract key information from lead messages
 */

const { query } = require('../db');
const { callOpenAI } = require('./openaiHandler');

// Keys we want to extract from conversations
const EXTRACTION_KEYS = [
    'fleet_size',
    'current_vendor',
    'decision_timeline',
    'budget',
    'pain_points',
    'decision_maker',
    'company_size',
    'location',
    'specific_interests',
    'objections',
    'competitor_mentions'
];

/**
 * Extract details from a message using AI
 * @param {string} messageContent - The message to analyze
 * @param {number} leadId - Lead ID for saving
 * @param {object} existingContext - Current known context
 */
async function extractDetailsFromMessage(messageContent, leadId, existingContext = {}) {
    try {
        const prompt = `Analyze this customer message and extract any relevant business information.

MESSAGE:
"${messageContent}"

EXISTING CONTEXT:
${JSON.stringify(existingContext, null, 2)}

Extract any of these details if mentioned (return null if not found):
- fleet_size: Number of vehicles/trucks they have
- current_vendor: Their current GPS/tracking solution
- decision_timeline: When they plan to make a decision
- budget: Any budget indicators or price sensitivity
- pain_points: Problems they're experiencing
- decision_maker: Name/role of the person making decisions
- company_size: Number of employees or company scale
- location: City, state, or region
- specific_interests: Specific features they're interested in
- objections: Reasons they might not buy
- competitor_mentions: Other vendors they mentioned

Return ONLY a JSON object with the extracted values. Use null for anything not found.
Example: {"fleet_size": "50 trucks", "current_vendor": "Samsara", "decision_timeline": null, ...}`;

        const response = await callOpenAI(prompt, {
            temperature: 0.3,
            max_tokens: 500
        });

        // Parse the response
        let extracted = {};
        try {
            // Clean up response - remove markdown code blocks if present
            let cleanResponse = response.trim();
            if (cleanResponse.startsWith('```')) {
                cleanResponse = cleanResponse.replace(/```json?\n?/g, '').replace(/```/g, '');
            }
            extracted = JSON.parse(cleanResponse);
        } catch (parseErr) {
            console.error('[DetailExtractor] Failed to parse AI response:', response);
            return { success: false, error: 'Parse error' };
        }

        // Save non-null values to database
        let savedCount = 0;
        for (const [key, value] of Object.entries(extracted)) {
            if (value !== null && value !== undefined && value !== '') {
                await saveExtractedDetail(leadId, key, value, 'AI_EXTRACTION');
                savedCount++;
            }
        }

        // Check for objections and update lead
        if (extracted.objections) {
            await query('UPDATE leads SET last_objection = $1 WHERE id = $2', [extracted.objections, leadId]);
        }

        // Check for buying signals
        const buyingSignals = detectBuyingSignals(messageContent);
        if (buyingSignals.length > 0) {
            await query('UPDATE leads SET buying_signals = $1 WHERE id = $2', [buyingSignals.join(', '), leadId]);
        }

        console.log(`[DetailExtractor] Extracted ${savedCount} details for lead ${leadId}`);
        return { success: true, extracted, savedCount };

    } catch (err) {
        console.error('[DetailExtractor] Error:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Save an extracted detail to the database
 */
async function saveExtractedDetail(leadId, key, value, source = 'MANUAL') {
    try {
        // Check if this key exists for this lead
        const existingRes = await query('SELECT id FROM lead_context WHERE lead_id = $1 AND key = $2', [leadId, key]);
        const existing = existingRes.rows[0];

        if (existing) {
            // Update existing
            await query(`
                UPDATE lead_context 
                SET value = $1, source = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            `, [value, source, existing.id]);
        } else {
            // Insert new
            await query(`
                INSERT INTO lead_context (lead_id, key, value, source)
                VALUES ($1, $2, $3, $4)
            `, [leadId, key, value, source]);
        }

        // Also update the JSON blob in leads table
        await updateExtractedDataBlob(leadId);

        return true;
    } catch (err) {
        console.error('[DetailExtractor] Error saving detail:', err.message);
        return false;
    }
}

/**
 * Update the extracted_data JSON blob in leads table
 */
async function updateExtractedDataBlob(leadId) {
    try {
        const allContextResult = await query('SELECT key, value FROM lead_context WHERE lead_id = $1', [leadId]);
        const allContext = allContextResult.rows;

        const dataBlob = {};
        for (const row of allContext) {
            dataBlob[row.key] = row.value;
        }

        await query('UPDATE leads SET extracted_data = $1 WHERE id = $2', [JSON.stringify(dataBlob), leadId]);
    } catch (err) {
        console.error('[DetailExtractor] Error updating blob:', err.message);
    }
}

/**
 * Detect buying signals in a message
 */
function detectBuyingSignals(text) {
    const signals = [];
    const lowerText = text.toLowerCase();

    const signalPatterns = [
        { pattern: /pricing|price|cost|how much|quote/i, signal: 'Asked about pricing' },
        { pattern: /demo|demonstration|see it|show me/i, signal: 'Requested demo' },
        { pattern: /implementation|install|setup|how long/i, signal: 'Asked about implementation' },
        { pattern: /contract|agreement|terms/i, signal: 'Discussing terms' },
        { pattern: /when can|how soon|timeline|start/i, signal: 'Timeline urgency' },
        { pattern: /decision maker|boss|manager|owner|ceo/i, signal: 'Decision maker mentioned' },
        { pattern: /competitor|alternative|compared to|vs\s/i, signal: 'Comparing options' },
        { pattern: /budget|approved|allocated/i, signal: 'Budget discussion' },
        { pattern: /interested|sounds good|like to|want to/i, signal: 'Expressed interest' },
        { pattern: /next step|move forward|proceed/i, signal: 'Ready to advance' }
    ];

    for (const { pattern, signal } of signalPatterns) {
        if (pattern.test(lowerText)) {
            signals.push(signal);
        }
    }

    return signals;
}

/**
 * Get all extracted details for a lead
 */
async function getExtractedDetails(leadId) {
    try {
        const result = await query(`
            SELECT key, value, source, confidence, updated_at
            FROM lead_context
            WHERE lead_id = $1
            ORDER BY updated_at DESC
        `, [leadId]);

        const details = {};
        for (const row of result.rows) {
            if (!details[row.key]) {
                details[row.key] = {
                    value: row.value,
                    source: row.source,
                    confidence: row.confidence,
                    lastUpdated: row.updated_at
                };
            }
        }
        return details;
    } catch (err) {
        console.error('[DetailExtractor] Error getting details:', err.message);
        return {};
    }
}

/**
 * Process an incoming message - extract details and update summary
 */
async function processIncomingMessage(leadId, messageContent) {
    console.log(`[DetailExtractor] Processing message for lead ${leadId}`);

    // Get existing context
    const existingDetails = await getExtractedDetails(leadId);
    const existingContext = {};
    for (const [key, data] of Object.entries(existingDetails)) {
        existingContext[key] = data.value;
    }

    // ... (imports)
    const { classifyReply } = require('./aiClassifier');

    // Extract new details
    const result = await extractDetailsFromMessage(messageContent, leadId, existingContext);

    // CLASSIFY INTENT
    try {
        const classification = await classifyReply(messageContent);
        console.log(`[DetailExtractor] Intent: ${classification.classification} (${classification.confidence})`);

        // Handle specific intents
        if (classification.classification === 'MEETING_REQUEST') {
            await query("UPDATE leads SET status = 'Keep Automation Off', step = step WHERE id = $1", [leadId]); // Manual intervention implies off
            // Actually, best to set to HOT_LEAD or similar, but for now MANUAL_INTERVENTION stops the bot
            await query("UPDATE leads SET status = 'MANUAL_INTERVENTION' WHERE id = $1", [leadId]);

            // Create a High Priority Task
            await query(`
                INSERT INTO tasks (lead_id, type, title, description, due_date, status)
                VALUES ($1, 'CALL', 'Hot Lead: Wants Meeting', $2, CURRENT_TIMESTAMP, 'PENDING')
            `, [leadId, `Customer replied: "${messageContent}"`]);

        } else if (classification.classification === 'UNSUBSCRIBE') {
            await query("UPDATE leads SET status = 'OPTED_OUT' WHERE id = $1", [leadId]);
        } else if (classification.classification === 'INTERESTED') {
            await query("UPDATE leads SET status = 'MANUAL_INTERVENTION' WHERE id = $1", [leadId]);
        }
    } catch (classifyErr) {
        console.error('[DetailExtractor] Classification error:', classifyErr.message);
    }

    // Update conversation summary
    const { generateConversationSummary } = require('./aiSequenceGenerator');
    // ...
    if (typeof generateConversationSummary === 'function') {
        try {
            const { getFullConversationHistory } = require('./conversationMemory');
            const history = await getFullConversationHistory(leadId);

            if (history.length > 0) {
                const conversationText = history.map(m => {
                    const dir = m.direction === 'INBOUND' ? 'Customer' : 'Sales';
                    return `${dir}: ${m.content}`;
                }).join('\n');

                const summaryPrompt = `Summarize this sales conversation in 2-3 sentences. Focus on: customer's needs, objections, and where they are in the buying process.\n\nCONVERSATION:\n${conversationText}`;

                const summary = await callOpenAI(summaryPrompt, { max_tokens: 200 });
                await query('UPDATE leads SET conversation_summary = $1 WHERE id = $2', [summary, leadId]);
            }
        } catch (summaryErr) {
            console.error('[DetailExtractor] Error generating summary:', summaryErr.message);
        }
    }

    return result;
}

module.exports = {
    extractDetailsFromMessage,
    saveExtractedDetail,
    getExtractedDetails,
    detectBuyingSignals,
    processIncomingMessage,
    EXTRACTION_KEYS
};
