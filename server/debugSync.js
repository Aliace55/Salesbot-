const dotenv = require('dotenv');
const { runSequence } = require('./services/sequenceEngine');

dotenv.config();

async function run() {
    console.log('--- Debugging Sync ---');
    try {
        await runSequence();
    } catch (err) {
        console.error('Error:', err);
    }
}

run();
