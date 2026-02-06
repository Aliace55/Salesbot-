require('dotenv').config();
const path = require('path');

const modules = [
    './db',
    './services/twilioHandler',
    './services/quoHandler',
    './services/vapiHandler',
    './services/sequenceEngine',
    './services/funnelAI',
    './services/aiBrain',
    './services/sheetSync',
    './services/researchService',
    './services/conversationMemory',
    './services/detailExtractor',
    './services/leadTypeDetector', // Lazy loaded in server.js, but let's check it
    './services/openaiHandler',
    './services/meetingScheduler',
    './services/linkedinService',
    './services/reportsExport',
    './services/emailWarmup'
];

console.log('--- Starting Dependency Verification ---');

let failureCount = 0;

modules.forEach(mod => {
    try {
        const resolvedPath = require.resolve(mod);
        console.log(`[CHECK] Loading ${mod}...`);
        require(mod);
        console.log(`[PASS]  ${mod} loaded successfully.`);
    } catch (err) {
        console.error(`[FAIL]  ${mod} failed to load!`);
        console.error(`        Error: ${err.message}`);
        // console.error(err); // Uncomment for full stack
        failureCount++;
    }
});

console.log('--- Verification Complete ---');
if (failureCount > 0) {
    console.log(`❌ Found ${failureCount} failures.`);
    process.exit(1);
} else {
    console.log('✅ All checked modules loaded successfully.');
    process.exit(0);
}
