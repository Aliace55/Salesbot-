const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');

// Lazy-load clients
let _openaiClient = null;
let _geminiClient = null;
let _geminiModel = null;

function getOpenAI() {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _openaiClient;
}

function getGemini() {
    if (!_geminiClient && process.env.GOOGLE_GENAI_API_KEY) {
        _geminiClient = new GoogleGenerativeAI(process.env.GOOGLE_GENAI_API_KEY);
        // "gemini-1.5-flash" is the cost-effective model
        // Fallback or specific version might be needed: "gemini-pro" or "gemini-1.5-flash-latest"
        _geminiModel = _geminiClient.getGenerativeModel({ model: "gemini-1.5-flash" });
    }
    return { client: _geminiClient, model: _geminiModel };
}

/**
 * Smart Model Router
 * Routes tasks to the most cost-effective model based on complexity.
 * 
 * @param {object} params
 * @param {string} params.prompt - The prompt to send
 * @param {string} params.systemPrompt - System instructions (optional)
 * @param {string} params.complexity - 'low' (Gemini Flash) or 'high' (GPT-4o)
 * @param {string} params.outputFormat - 'json' or 'text'
 * @param {number} params.temperature - Creative vs deterministic (0.0 - 1.0)
 */
async function callSmartModel({ prompt, systemPrompt = '', complexity = 'low', outputFormat = 'text', temperature = 0.7 }) {

    // STRATEGY: Use Gemini Flash for Low Complexity, GPT-4o for High Complexity
    // Fallback to GPT-4o-mini if Gemini is not configured

    const useGemini = complexity === 'low' && process.env.GOOGLE_GENAI_API_KEY;

    if (useGemini) {
        try {
            const { model } = getGemini();
            if (model) {
                console.log(`[Model Router] Routing to Gemini 1.5 Flash (Complexity: ${complexity})`);

                let finalPrompt = prompt;
                if (systemPrompt) {
                    finalPrompt = `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER PROMPT:\n${prompt}`;
                }

                if (outputFormat === 'json') {
                    finalPrompt += `\n\nReturn ONLY raw JSON with no markdown formatting.`;
                }

                const result = await model.generateContent(finalPrompt);
                let text = result.response.text();

                // Cleanup JSON if needed (Gemini sometimes adds markdown blocks)
                if (outputFormat === 'json') {
                    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    try {
                        return JSON.parse(text);
                    } catch (e) {
                        console.warn('[Model Router] Gemini JSON parse failed, falling back to raw text:', e.message);
                        return { error: 'JSON Parse Failed', raw: text };
                    }
                }

                return text.trim();
            }
        } catch (err) {
            console.error('[Model Router] Gemini Error (falling back to OpenAI):', err.message);
            // Fallthrough to OpenAI on error
        }
    }

    // Default: OpenAI (GPT-4o for High, GPT-4o-mini for Low/Fallback)
    const modelName = complexity === 'high' ? 'gpt-4o' : 'gpt-4o-mini';
    console.log(`[Model Router] Routing to ${modelName} (Complexity: ${complexity})`);

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const responseFormat = outputFormat === 'json' ? { type: 'json_object' } : { type: 'text' };

    try {
        const completion = await getOpenAI().chat.completions.create({
            model: modelName,
            messages: messages,
            temperature: temperature,
            response_format: responseFormat
        });

        const content = completion.choices[0].message.content;

        if (outputFormat === 'json') {
            return JSON.parse(content);
        }

        return content.trim();

    } catch (err) {
        console.error('[Model Router] OpenAI Error:', err);
        throw err;
    }
}

module.exports = { callSmartModel };
