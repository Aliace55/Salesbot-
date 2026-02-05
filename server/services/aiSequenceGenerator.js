const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Lazy-load OpenAI client (initialized on first use, not at module load)
let _openaiClient = null;
function getOpenAI() {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _openaiClient;
}

const SEQUENCE_FILE = path.join(__dirname, '../sequence.json');

/**
 * Generate a complete outreach sequence using AI
 * @param {object} params - Generation parameters
 * @param {string} params.industry - Target industry (e.g., "Construction", "HVAC")
 * @param {string} params.product - Product/Service being sold
 * @param {string} params.painPoints - Key pain points to address
 * @param {string} params.tone - Tone of voice (professional, casual, urgent)
 * @param {number} params.steps - Number of steps (3-7)
 * @param {string[]} params.channels - Channels to use (SMS, EMAIL, CALL, LINKEDIN)
 * @returns {Promise<object[]>} Generated sequence
 */
async function generateSequence(params) {
    const { industry, product, painPoints, tone = 'professional', steps = 5, channels = ['SMS', 'EMAIL', 'CALL'] } = params;

    const prompt = `You are an expert sales engagement strategist. Create a ${steps}-step multi-channel outreach sequence.

TARGET:
- Industry: ${industry}
- Product/Service: ${product}
- Key Pain Points: ${painPoints}
- Tone: ${tone}

CHANNELS AVAILABLE: ${channels.join(', ')}

RULES:
1. Start with a warm, non-salesy SMS
2. Space out touchpoints (1-3 days between)
3. Include A/B variants for at least 2 steps
4. Add conditional logic (if opened → call, else → follow-up email)
5. End with a compelling final message

Return a valid JSON array with this structure:
[
  {
    "id": 1,
    "type": "SMS|EMAIL|CALL|LINKEDIN",
    "delayDays": 0,
    "subject": "Only for EMAIL",
    "description": "For CALL/LINKEDIN manual tasks",
    "variants": [
      {"name": "A", "content": "Message with {{firstName}} placeholder"},
      {"name": "B", "content": "Alternative version"}
    ],
    "condition": {
      "if": {"email_opened": true},
      "else": "skip"
    }
  }
]

Ensure all messages are personalized with {{firstName}}, {{company}}, or {{industry}} placeholders.
Return ONLY the JSON array, no explanations.`;

    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a sales sequence generator. Return only valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
        });

        const content = response.choices[0].message.content;
        const parsed = JSON.parse(content);

        // Handle if response is wrapped in an object
        const sequence = Array.isArray(parsed) ? parsed : parsed.sequence || parsed.steps || [];

        return { success: true, sequence };
    } catch (error) {
        console.error('Sequence Generation Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save a generated sequence to the sequence.json file
 * @param {object[]} sequence - The sequence to save
 */
function saveSequence(sequence) {
    try {
        fs.writeFileSync(SEQUENCE_FILE, JSON.stringify(sequence, null, 2));
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Generate personalization suggestions for a lead
 * @param {object} lead - Lead data
 * @returns {Promise<object>}
 */
async function generatePersonalizationSuggestions(lead) {
    const prompt = `Analyze this lead and suggest 5 personalization hooks for outreach:

Lead Data:
- Name: ${lead.name || 'Unknown'}
- Company: ${lead.company || 'Unknown'}
- Industry: ${lead.product_interest || 'General'}
- Source: ${lead.source || 'Unknown'}

Return JSON with:
{
  "hooks": [
    {"type": "pain_point", "content": "specific pain point hook"},
    {"type": "industry_trend", "content": "relevant trend"},
    {"type": "social_proof", "content": "relevant case study angle"},
    {"type": "urgency", "content": "time-sensitive angle"},
    {"type": "question", "content": "engaging question"}
  ],
  "recommended_opening": "Best first message",
  "avoid": ["things to avoid mentioning"]
}`;

    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a sales strategist. Return only valid JSON.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.6,
            response_format: { type: 'json_object' }
        });

        return JSON.parse(response.choices[0].message.content);
    } catch (error) {
        console.error('Personalization Error:', error);
        return { hooks: [], error: error.message };
    }
}

/**
 * Auto-draft a message for a specific channel and lead
 * NOW WITH FULL CONVERSATION CONTEXT
 * @param {object} lead - Lead data (or leadId)
 * @param {string} channel - SMS, EMAIL, LINKEDIN
 * @param {string} context - Additional context (previous messages, etc.)
 * @returns {Promise<string>}
 */

async function autoDraftMessage(lead, channel, context = '') {
    const charLimits = {
        SMS: 160,
        EMAIL: 500,
        LINKEDIN: 300
    };

    // Get full conversation context
    let fullContext = context;
    let extractedDetails = {};

    try {
        const { generateContextPrompt, buildContextForAI } = require('./conversationMemory');
        // detailExtractor is not directly used here but loaded in memory?
        // const { getExtractedDetails } = require('./detailExtractor');

        const leadId = lead.id || lead;
        const contextData = await buildContextForAI(leadId);

        if (contextData) {
            fullContext = await generateContextPrompt(leadId);
            extractedDetails = contextData.extractedDetails || {};
        }
    } catch (err) {
        console.log('[AI Draft] Context loading error (non-fatal):', err.message);
    }

    // Build enhanced prompt
    const prompt = `You are drafting a ${channel} message for a sales follow-up.

${fullContext}

LEAD INFO:
- Name: ${lead.name || 'Unknown'}
- Company: ${lead.company || 'their company'}
- Industry: ${lead.product_interest || 'Fleet Tracking'}
${extractedDetails.fleetSize ? `- Fleet Size: ${extractedDetails.fleetSize}` : ''}
${extractedDetails.currentVendor ? `- Current Vendor: ${extractedDetails.currentVendor}` : ''}
${extractedDetails.painPoints ? `- Pain Points: ${extractedDetails.painPoints}` : ''}

REQUIREMENTS:
- Max ${charLimits[channel] || 300} characters
- ${channel === 'SMS' ? 'Casual, conversational tone. Very brief.' : ''}
- ${channel === 'EMAIL' ? 'Professional but warm. Include subject line first.' : ''}
- ${channel === 'LINKEDIN' ? 'Brief, connection-focused' : ''}
- If they replied before, REFERENCE what they said
- If they had objections, ADDRESS them
- Include a clear call-to-action
- Sound human, not robotic
- Use their first name naturally (not {{firstName}})

${context ? `ADDITIONAL CONTEXT: ${context}` : ''}

Return ONLY the message text. ${channel === 'EMAIL' ? 'Start with "Subject: " on first line.' : ''}`;

    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You are a skilled sales copywriter who writes like a real person, not a bot. You reference previous conversations naturally.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.75,
            max_tokens: 300
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Auto-Draft Error:', error);
        return '';
    }
}

/**
 * Draft a reply to an incoming message with full context
 * @param {number} leadId - Lead ID
 * @param {string} incomingMessage - The message they sent
 * @param {string} channel - SMS or EMAIL
 */
async function draftContextualReply(leadId, incomingMessage, channel = 'EMAIL') {
    try {
        const { generateContextPrompt } = require('./conversationMemory');
        const { getExtractedDetails } = require('./detailExtractor');
        const { query } = require('../db');
        const researchService = require('./researchService');

        const leadRes = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        if (!lead) throw new Error('Lead not found');

        const fullContext = await generateContextPrompt(leadId);
        const details = await getExtractedDetails(leadId);

        // --- NEW: Perform Deep Research if enabled ---
        let researchContext = '';
        if (process.env.PERPLEXITY_API_KEY && lead.company) {
            try {
                console.log(`[AI Research] researching ${lead.company}...`);
                const companyResearch = await researchService.researchCompany(lead.company, lead.website);
                if (companyResearch) {
                    researchContext = `\nREAL-TIME COMPANY RESEARCH:\n${companyResearch}\n`;
                }
            } catch (resErr) {
                console.warn('[AI Research] failed:', resErr.message);
            }
        }

        const prompt = `You are responding to a customer message. Be helpful, reference their question, and guide toward a call.

THEIR MESSAGE:
"${incomingMessage}"

${fullContext}

${researchContext}

KNOWN DETAILS:
${JSON.stringify(details, null, 2)}

REQUIREMENTS:
- Directly address what they asked
- Reference any previous conversation naturally
- If they mentioned objections, handle them professionally
- Keep it ${channel === 'SMS' ? 'under 160 chars, casual' : 'under 300 words, professional'}
- End with a soft CTA (suggest a call, not pushy)

Write the response now:`;

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a helpful sales representative having a real conversation. Be natural, not salesy.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 400
        });

        return {
            success: true,
            draft: response.choices[0].message.content.trim(),
            channel,
            leadId
        };
    } catch (error) {
        console.error('Contextual Reply Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Adapt a sequence template based on lead context
 * @param {string} templateContent - Original template
 * @param {number} leadId - Lead ID
 * @param {string} channel - Channel type
 */
async function adaptSequenceMessage(templateContent, leadId, channel) {
    try {
        const { generateContextPrompt, buildContextForAI } = require('./conversationMemory');

        const context = await buildContextForAI(leadId);

        // If no context/replies, just use template with variable replacement
        if (!context || !context.hasReplied) {
            return { adapted: false, content: templateContent };
        }

        const fullContext = await generateContextPrompt(leadId);

        const prompt = `Adapt this sales template to be contextual based on previous conversations.

ORIGINAL TEMPLATE:
"${templateContent}"

${fullContext}

REQUIREMENTS:
- Keep the same general structure and CTA
- Add references to what they mentioned before
- Address any objections naturally
- Make it feel like a continuation, not a new pitch
- Keep similar length

Return ONLY the adapted message:`;

        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'You adapt sales templates to be contextual. Keep the essence but personalize.' },
                { role: 'user', content: prompt }
            ],
            temperature: 0.65,
            max_tokens: 350
        });

        return {
            adapted: true,
            content: response.choices[0].message.content.trim(),
            originalTemplate: templateContent
        };
    } catch (error) {
        console.error('Adapt Message Error:', error);
        return { adapted: false, content: templateContent, error: error.message };
    }
}

module.exports = {
    generateSequence,
    saveSequence,
    generatePersonalizationSuggestions,
    autoDraftMessage,
    draftContextualReply,
    adaptSequenceMessage
};

