require('dotenv').config();

const modules = [
    './services/googleSheets',
    './services/emailHandler',
    './services/aiSequenceGenerator',
    './services/sequenceEngine' // Check this last
];

console.log('--- Checking SequenceEngine Dependencies ---');

let failureCount = 0;

modules.forEach(mod => {
    try {
        console.log(`[CHECK] Loading ${mod}...`);
        require(mod);
        console.log(`[PASS]  ${mod} loaded successfully.`);
    } catch (err) {
        console.error(`[FAIL]  ${mod} failed to load!`);
        console.error(`        Error: ${err.message}`);
        failureCount++;
    }
});

if (failureCount > 0) process.exit(1);
