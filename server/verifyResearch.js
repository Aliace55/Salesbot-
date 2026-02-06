require('dotenv').config();
const { researchCompany } = require('./services/researchService');

async function testResearch() {
    console.log('--- Testing Automated Research (Perplexity) ---');

    const company = "SpaceX";
    console.log(`Researching: ${company}...`);

    try {
        const start = Date.now();
        const summary = await researchCompany(company, 'spacex.com');
        const duration = Date.now() - start;

        if (summary) {
            console.log(`\n[SUCCESS] Research completed in ${duration}ms`);
            console.log(`Summary Length: ${summary.length} chars`);
            console.log('Preview:', summary.substring(0, 200) + '...');
        } else {
            console.error('[FAIL] No summary returned (check API key)');
        }
    } catch (err) {
        console.error('[ERROR]', err);
    }
}

testResearch();
