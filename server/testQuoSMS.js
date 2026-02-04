/**
 * Quick test script to send SMS via Quo
 */
require('dotenv').config();

const { sendSMS } = require('./services/quoHandler');

async function test() {
    console.log('Sending test SMS via Quo...');
    console.log('API Key:', process.env.QUO_API_KEY ? 'Set' : 'MISSING');
    console.log('From:', process.env.QUO_PHONE_NUMBER);

    const result = await sendSMS(
        '+16303909510',
        'Test from Salesbot! If you received this, Quo integration is working. 🚀'
    );

    console.log('Result:', result);
}

test();
