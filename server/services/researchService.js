const fetch = require('node-fetch');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const MODEL = 'llama-3.1-sonar-large-128k-online'; // Online capabilities

/**
 * Research a company to find recent news, pain points, and strategic direction.
 * @param {string} companyName 
 * @param {string} domain 
 * @returns {Promise<string>} Markdown summary of the company
 */
async function researchCompany(companyName, domain) {
    if (!PERPLEXITY_API_KEY) {
        console.warn('Perplexity API key missing. Skipping research.');
        return null;
    }

    const query = `Research the company "${companyName}" (${domain || ''}). 
    Focus on:
    1. What do they specificially do? (Unique value prop)
    2. Recent news, press releases, or funding (last 6 months)
    3. Potential pain points they might face in their industry
    4. Key decision makers or leadership style
    
    Keep it concise and business-focused.`;

    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: 'You are an expert sales researcher. Your goal is to find actionable insights that can be used to personalize cold outreach.' },
                    { role: 'user', content: query }
                ],
                max_tokens: 1000,
                temperature: 0.2 // Low temperature for factual accuracy
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error('Company research failed:', error);
        return null;
    }
}

/**
 * Research a specific person to find their role, recent posts, or interests.
 * @param {string} name 
 * @param {string} company 
 * @returns {Promise<string>} Markdown summary of the person
 */
async function researchPerson(name, company) {
    if (!PERPLEXITY_API_KEY) {
        return null;
    }

    const query = `Research "${name}" at "${company}". 
    Find:
    1. Their specific role and responsibilities
    2. Recent public posts, talks, or activity (LinkedIn/Twitter)
    3. Professional background highlights
    
    If no specific info is found, infer their responsibilities based on their job title at this company.`;

    try {
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: 'You are an expert sales researcher.' },
                    { role: 'user', content: query }
                ],
                max_tokens: 800,
                temperature: 0.2
            })
        });

        if (!response.ok) {
            throw new Error(`Perplexity API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error('Person research failed:', error);
        return null;
    }
}

module.exports = {
    researchCompany,
    researchPerson
};
