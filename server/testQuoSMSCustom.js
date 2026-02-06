require('dotenv').config();
const { sendSMS } = require('./services/quoHandler');

(async () => {
    const toPhone = '+16303909510'; // User requested number
    console.log(`Sending test SMS via Quo to: ${toPhone}...`);

    try {
        const result = await sendSMS(
            toPhone,
            'Test from SalesBot! 🚀 Checking SMS integration. Reply "YES" if you got this.'
        );
        console.log('Result:', result);
    } catch (error) {
        console.error('Failed to send SMS:', error);
    }
})();
