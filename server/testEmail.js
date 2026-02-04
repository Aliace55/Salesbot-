require('dotenv').config(); // Load FIRST
const { sendEmail } = require('./services/emailHandler');

(async () => {
    console.log('Sending test email to:', process.env.EMAIL_USER);
    const result = await sendEmail(process.env.EMAIL_USER, 'Test from SalesBot', '<h1>It works!</h1><p>Your SalesBot is ready to send emails.</p>');
    console.log('Result:', result);
})();
