const { query, pool } = require('./db');

async function seedInbound() {
    console.log('Seeding Inbound Campaign...');
    try {
        // Check if exists
        const check = await query("SELECT * FROM sequences WHERE lead_type = 'INBOUND'");
        if (check.rows.length > 0) {
            console.log('Inbound campaign already exists.');
            return;
        }

        const inboundSteps = [
            {
                id: 1,
                type: 'SMS',
                delayDays: 0, // Immediate
                content: "Hey {{firstName}}, thanks for requesting a demo of TrackMyTruck! I'm free this afternoon if you want to chat? - Jeff"
            },
            {
                id: 2,
                type: 'EMAIL',
                delayDays: 0, // Immediate
                subject: "Demo Request - TrackMyTruck",
                content: "Hi {{firstName}},\n\nReceived your request for a demo.\n\nYou can book a time that works for you here: {{booking_link}}\n\nTalk soon,\nJeff"
            },
            {
                id: 3,
                type: 'CALL',
                delayDays: 1,
                description: "Call to qualify lead and schedule demo if they haven't booked yet."
            },
            {
                id: 4,
                type: 'SMS',
                delayDays: 2,
                content: "Just checking in {{firstName}} - did you get a chance to look at the calendar? Slots are filling up for the week."
            }
        ];

        await query(`
            INSERT INTO sequences (name, lead_type, description, steps, is_active)
            VALUES ($1, 'INBOUND', $2, $3, 1)
        `, [
            'Website Demo Request',
            'Standard follow-up for inbound website leads',
            JSON.stringify(inboundSteps)
        ]);

        console.log('Inbound Campaign Created Successfully.');

    } catch (err) {
        console.error('Error seeding inbound:', err);
    } finally {
        await pool.end();
    }
}

seedInbound();
