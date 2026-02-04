/**
 * Test VAPI Ringless Voicemail
 */
require('dotenv').config();

const { sendRinglessVoicemail } = require('./services/vapiHandler');

async function test() {
    console.log('Testing VAPI Ringless Voicemail...');
    console.log('API Key:', process.env.VAPI_API_KEY ? 'Set' : 'MISSING');
    console.log('Phone Number ID:', process.env.VAPI_PHONE_NUMBER_ID);

    const result = await sendRinglessVoicemail(
        '+16303909510', // Your personal number
        "Hi, this is a test voicemail from TrackmyTruck. If you're hearing this, the ringless voicemail system is working perfectly. Have a great day!",
        1 // Test lead ID
    );

    console.log('Result:', result);
}

test();
