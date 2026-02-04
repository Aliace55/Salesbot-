const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendEmail = async (to, subject, html) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[Email Handler] Credentials missing. Skipping email send.');
        return { success: false, error: 'Missing Credentials' };
    }

    try {
        const info = await transporter.sendMail({
            from: `"SalesBot" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        });

        console.log(`[Email Handler] Sent to ${to}. ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('[Email Handler] Error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { sendEmail };
