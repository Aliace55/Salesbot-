/**
 * Conversation Memory Service
 * Provides full conversation context for AI-powered personalization
 */

/**
 * Conversation Memory Service
 * Provides full conversation context for AI-powered personalization
 */

const { query } = require('../db');

/**
 * Get full conversation history for a lead across all channels
 * @param {number} leadId 
 * @returns {Promise<Array>} Messages in chronological order
 */
async function getFullConversationHistory(leadId) {
    try {
        const result = await query(`
            SELECT 
                id,
                type,
                direction,
                content,
                created_at as timestamp
            FROM messages 
            WHERE lead_id = $1
            ORDER BY created_at ASC
        `, [leadId]);

        return result.rows.map(msg => ({
            ...msg,
            channel: msg.type, // EMAIL, SMS, CALL, VOICEMAIL
            isInbound: msg.direction === 'INBOUND'
        }));
    } catch (err) {
        console.error('[ConversationMemory] Error getting history:', err.message);
        return [];
    }
}

/**
 * Get recent messages for context (last N messages)
 * @param {number} leadId 
 * @param {number} limit - Number of messages to return
 */
async function getRecentMessages(leadId, limit = 5) {
    try {
        const result = await query(`
            SELECT type, direction, content, created_at as timestamp
            FROM messages 
            WHERE lead_id = $1
            ORDER BY created_at DESC
            LIMIT $2
        `, [leadId, limit]);

        return result.rows.reverse(); // Reverse to get chronological order
    } catch (err) {
        console.error('[ConversationMemory] Error getting recent messages:', err.message);
        return [];
    }
}

/**
 * Get all extracted context for a lead
 * @param {number} leadId 
 */
async function getExtractedContext(leadId) {
    try {
        const result = await query(`
            SELECT key, value, confidence
            FROM lead_context
            WHERE lead_id = $1
            ORDER BY updated_at DESC
        `, [leadId]);

        // Convert to object, keeping most recent value for each key
        const context = {};
        const seen = new Set();
        for (const row of result.rows) {
            if (!seen.has(row.key)) {
                context[row.key] = row.value;
                seen.add(row.key);
            }
        }
        return context;
    } catch (err) {
        console.error('[ConversationMemory] Error getting context:', err.message);
        return {};
    }
}

/**
 * Build a comprehensive context object for AI prompting
 * @param {number} leadId 
 */
async function buildContextForAI(leadId) {
    try {
        // Get lead info
        const leadRes = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        if (!lead) return null;

        // Get conversation history
        const recentMessages = await getRecentMessages(leadId, 5);
        const extractedContext = await getExtractedContext(leadId);

        // Format messages for prompt
        const formattedHistory = recentMessages.map(msg => {
            const direction = msg.direction === 'INBOUND' ? 'LEAD' : 'US';
            const channel = msg.type;
            return `[${channel}] ${direction}: ${msg.content}`;
        }).join('\n\n');

        return {
            lead: {
                id: lead.id,
                name: lead.name,
                company: lead.company,
                email: lead.email,
                phone: lead.phone,
                status: lead.status,
                funnelStage: lead.funnel_stage,
                source: lead.source,
                productInterest: lead.product_interest
            },
            extractedDetails: {
                fleetSize: extractedContext.fleet_size || null,
                currentVendor: extractedContext.current_vendor || null,
                decisionTimeline: extractedContext.decision_timeline || null,
                budget: extractedContext.budget || null,
                painPoints: extractedContext.pain_points || null,
                decisionMaker: extractedContext.decision_maker || null,
                ...extractedContext
            },
            conversationSummary: lead.conversation_summary || null,
            lastObjection: lead.last_objection || null,
            buyingSignals: lead.buying_signals || null,
            recentHistory: formattedHistory,
            messageCount: recentMessages.length,
            hasReplied: recentMessages.some(m => m.direction === 'INBOUND'),
            preferredChannel: lead.preferred_channel || 'EMAIL'
        };
    } catch (err) {
        console.error('[ConversationMemory] Error building context:', err.message);
        return null;
    }
}

/**
 * Generate a context prompt string for AI
 * @param {number} leadId 
 */
async function generateContextPrompt(leadId) {
    const context = await buildContextForAI(leadId);
    if (!context) return '';

    let prompt = `## LEAD PROFILE
- Name: ${context.lead.name || 'Unknown'}
- Company: ${context.lead.company || 'Unknown'}
- Status: ${context.lead.status}
- Funnel Stage: ${context.lead.funnelStage || 'LEAD'}
`;

    // Add extracted details if available
    const details = context.extractedDetails;
    if (Object.keys(details).some(k => details[k])) {
        prompt += `\n## KNOWN INFORMATION\n`;
        if (details.fleetSize) prompt += `- Fleet Size: ${details.fleetSize}\n`;
        if (details.currentVendor) prompt += `- Current Vendor: ${details.currentVendor}\n`;
        if (details.decisionTimeline) prompt += `- Timeline: ${details.decisionTimeline}\n`;
        if (details.budget) prompt += `- Budget: ${details.budget}\n`;
        if (details.painPoints) prompt += `- Pain Points: ${details.painPoints}\n`;
        if (details.decisionMaker) prompt += `- Decision Maker: ${details.decisionMaker}\n`;
    }

    // Add conversation summary
    if (context.conversationSummary) {
        prompt += `\n## CONVERSATION SUMMARY\n${context.conversationSummary}\n`;
    }

    // Add last objection
    if (context.lastObjection) {
        prompt += `\n## LAST OBJECTION\n${context.lastObjection}\n`;
    }

    // Add buying signals
    if (context.buyingSignals) {
        prompt += `\n## BUYING SIGNALS\n${context.buyingSignals}\n`;
    }

    // Add recent conversation
    if (context.recentHistory) {
        prompt += `\n## RECENT CONVERSATION\n${context.recentHistory}\n`;
    }

    return prompt;
}

/**
 * Update conversation summary using AI
 * @param {number} leadId 
 * @param {function} aiSummarizer - Function that takes text and returns summary
 */
async function updateConversationSummary(leadId, aiSummarizer) {
    try {
        const messages = await getFullConversationHistory(leadId);
        if (messages.length === 0) return;

        const conversationText = messages.map(m => {
            const dir = m.direction === 'INBOUND' ? 'Customer' : 'Sales';
            return `${dir}: ${m.content}`;
        }).join('\n');

        const summary = await aiSummarizer(conversationText);

        await query(`UPDATE leads SET conversation_summary = $1 WHERE id = $2`, [summary, leadId]);
        console.log(`[ConversationMemory] Updated summary for lead ${leadId}`);
    } catch (err) {
        console.error('[ConversationMemory] Error updating summary:', err.message);
    }
}

/**
 * Determine preferred channel based on engagement
 * @param {number} leadId 
 */
async function determinePreferredChannel(leadId) {
    try {
        const result = await query(`
            SELECT type, COUNT(*) as count
            FROM messages
            WHERE lead_id = $1 AND direction = 'INBOUND'
            GROUP BY type
            ORDER BY count DESC
        `, [leadId]);

        if (result.rows.length > 0) {
            const preferred = result.rows[0].type;
            await query(`UPDATE leads SET preferred_channel = $1 WHERE id = $2`, [preferred, leadId]);
            return preferred;
        }
        return 'EMAIL';
    } catch (err) {
        return 'EMAIL';
    }
}

module.exports = {
    getFullConversationHistory,
    getRecentMessages,
    getExtractedContext,
    buildContextForAI,
    generateContextPrompt,
    updateConversationSummary,
    determinePreferredChannel
};
