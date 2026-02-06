require('dotenv').config();
const { callSmartModel } = require('./services/modelSelector');

async function testRouter() {
    console.log('--- Testing Multi-Model Router ---\n');

    // Test 1: Low Complexity (Gemini Flash)
    console.log('Test 1: Low Complexity (Classification - Expecting Gemini Flash)');
    try {
        const start1 = Date.now();
        const res1 = await callSmartModel({
            prompt: "I'm interested in your product. Can we schedule a demo?",
            systemPrompt: "Classify this message: INTERESTED, BOUNCE, OOO",
            complexity: 'low',
            outputFormat: 'text'
        });
        const duration1 = Date.now() - start1;
        console.log(`[Low Complexity] Result: ${res1} (Time: ${duration1}ms)`);
    } catch (err) {
        console.error('[Low Complexity] Failed:', err.message);
    }

    console.log('\n---------------------------------\n');

    // Test 2: High Complexity (GPT-4o)
    console.log('Test 2: High Complexity (Email Draft - Expecting GPT-4o)');
    try {
        const start2 = Date.now();
        const res2 = await callSmartModel({
            prompt: "Draft a cold email to a trucking company owner about GPS tracking savings.",
            systemPrompt: "You are a top-tier copywriter.",
            complexity: 'high',
            outputFormat: 'text'
        });
        const duration2 = Date.now() - start2;
        console.log(`[High Complexity] Result Length: ${res2.length} chars (Time: ${duration2}ms)`);
        console.log(`Preview: ${res2.substring(0, 100)}...`);
    } catch (err) {
        console.error('[High Complexity] Failed:', err.message);
    }
}

testRouter();
