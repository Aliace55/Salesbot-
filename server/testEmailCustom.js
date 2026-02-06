require('dotenv').config();
const { sendEmail } = require('./services/emailHandler');

(async () => {
    const toEmail = 'anthonyliace55@gmail.com';
    console.log(`Sending test email to: ${toEmail}`);

    try {
        const result = await sendEmail(
            toEmail,
            'Test from SalesBot',
            `<h1>It works!</h1>
            <p>Your SalesBot email system is ready.</p>
            <br>
            <p>Best regards,</p>
            <div style="font-family: Arial, sans-serif; color: #333;">
                <p><strong>Jeff Lach</strong> | Account Manager</p>
                <p>Phone: (864) 860-1011<br>
                Website: <a href="https://trackmytruck.us" style="color: #007bff;">TrackMyTruck.us</a></p>
                <p style="margin-top: 15px;">
                    <a href="https://calendar.app.google/bK9U7hCN8N7Cvoxb7" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">Schedule a Meeting</a>
                </p>
                <p style="margin-top: 15px;">
                    <img src="https://www.dropbox.com/scl/fi/0sldjieg0gwtty783thxo/Track-My-Truck-Banner-Cropped.png?rlkey=gz10bp9o6yej42gzjnjo0ptku&st=ae92ubei&dl=1" alt="Track My Truck" width="200" style="display: block;">
                </p>
            </div>`
        );
        console.log('Result:', result);
    } catch (error) {
        console.error('Failed to send email:', error);
    }
})();
