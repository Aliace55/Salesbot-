const OpenAI = require('openai');

let _openai = null;
function getOpenAI() {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
}

/**
 * Generate a smart reply based on conversation history
 * @param {Array} history - Array of { role: 'user'|'assistant', content: string }
 * @param {string} leadName - Context
 */
async function generateSmartReply(history, leadName) {
    if (!process.env.OPENAI_API_KEY) {
        return "I can't think right now (Missing API Key).";
    }

    try {
        const systemPrompt = `
You are "Alex", a top-tier Sales Rep for TrackMyTruck.us.
Your Goal: Get the lead to book a demo or a call.

Key Products & Pitch:
1. OBD Tracker (Plug & Play): "Install in seconds, see your fleet instantly." Great for HVAC/Plumbing.
2. AI Dashcam: "Protect drivers from false claims." Great for safety.
3. Tail Light Tracker: "Covert anti-theft. They'll never find it." Great for Construction.
4. Magnetic Tracker: "Track dumpsters/generators." 5-year battery.
5. Wired Asset Tracker: "Permanent tracking for trailers/yellow iron."

Rules:
- If Lead is "Construction", pitch Anti-Theft/Asset Tracking.
- If Lead is "HVAC/Plumbing", pitch Efficiency/Job Verification.
- Tone: Casual, short text messages (under 160 chars).
- No "Dear [Name]", just dive in.
- If asked about price: "Depends on volume, but units start around $XX. How many vehicles do you have?"

Lead Name: ${leadName || 'Local Business Owner'}
        `;

        const messages = [
            { role: 'system', content: systemPrompt.trim() },
            ...history
        ];

        const completion = await getOpenAI().chat.completions.create({
            messages: messages,
            model: 'gpt-4o-mini',
            max_tokens: 150,
            temperature: 0.7,
        });

        return completion.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI Error:', error);
        return "Error generating reply.";
    }
}

module.exports = { generateSmartReply };
