const { callSmartModel } = require('./modelSelector');

// OpenAI client removed in favor of modelSelector

/**
 * Classify an incoming reply using GPT
 * @param {string} message - The reply content
 * @returns {Promise<{classification: string, confidence: number, summary: string}>}
 */
async function classifyReply(message) {
    try {
        const result = await callSmartModel({
            prompt: message,
            systemPrompt: `You are a sales reply classifier. Analyze the incoming message and classify it into ONE of these categories:

INTERESTED - Prospect shows interest, wants more info, or asks questions
NOT_INTERESTED - Polite decline, not a fit, or explicit rejection
MEETING_REQUEST - Wants to schedule a call or meeting
OOO - Out of office auto-reply
UNSUBSCRIBE - Asks to stop messages, opt-out request
WRONG_NUMBER - Message indicates wrong contact
NEUTRAL - Unclear intent, needs manual review

Respond in JSON format:
{
  "classification": "CATEGORY",
  "confidence": 0.0-1.0,
  "summary": "Brief 1-line summary of intent"
}`,
            complexity: 'low',
            outputFormat: 'json',
            temperature: 0.3
        });

        return result;
    } catch (error) {
        console.error('Classification Error:', error);
        return {
            classification: 'NEUTRAL',
            confidence: 0,
            summary: 'Classification failed'
        };
    }
}

/**
 * Generate a personalized message using AI
 * @param {object} lead - Lead data
 * @param {string} template - Message template
 * @param {string} channel - SMS, EMAIL, LINKEDIN
 * @returns {Promise<string>}
 */
async function personalizeMessage(lead, template, channel) {
    try {
        const result = await callSmartModel({
            prompt: template,
            systemPrompt: `You are a sales copywriter. Personalize the following template for the lead.
Keep it natural, conversational, and authentic.
Channel: ${channel}
${channel === 'SMS' ? 'Keep under 160 characters.' : ''}
${channel === 'LINKEDIN' ? 'Keep under 300 characters for connection notes.' : ''}

Lead Info:
- Name: ${lead.name || 'Unknown'}
- Company: ${lead.company || 'Unknown'}
- Interest: ${lead.product_interest || 'Fleet Tracking'}
- Source: ${lead.source || 'Unknown'}

Return ONLY the personalized message, no explanations.`,
            complexity: 'low',
            outputFormat: 'text',
            temperature: 0.7
        });

        return result;
    } catch (error) {
        console.error('Personalization Error:', error);
        return template;
    }
}

/**
 * Suggest personalization points for a message
 * @param {string} message - The message to analyze
 * @param {object} lead - Lead data
 * @returns {Promise<string[]>}
 */
async function suggestPersonalization(message, lead) {
    try {
        const result = await callSmartModel({
            prompt: `Message: ${message}\n\nLead: ${JSON.stringify(lead)}`,
            systemPrompt: `Analyze this sales message and suggest 3-5 personalization improvements.
Consider the lead's industry, role, and interests.
Return as a JSON array of suggestion strings.`,
            complexity: 'low',
            outputFormat: 'json',
            temperature: 0.5
        });

        return result.suggestions || [];
    } catch (error) {
        console.error('Suggestion Error:', error);
        return [];
    }
}

module.exports = { classifyReply, personalizeMessage, suggestPersonalization };
