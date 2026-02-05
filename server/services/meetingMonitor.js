/**
 * Meeting Monitor Service
 * Scans inbox for calendar invitations/confirmations to detect booked meetings
 */

const { searchEmails, extractEmail } = require('./imapClient');
const { query } = require('../db');

/**
 * Scan for meeting confirmations
 */
async function scanForMeetings() {
    console.log('[Meeting Monitor] Scanning for meeting confirmations...');
    const detectedMeetings = [];

    // Search for unread messages with calendar-related subjects
    const searchCriteria = [
        'UNSEEN',
        ['OR',
            ['SUBJECT', 'Invitation:'],
            ['SUBJECT', 'New Event:']
        ],
        ['SINCE', new Date(Date.now() - 24 * 60 * 60 * 1000)] // Last 24 hours
    ];

    await searchEmails(searchCriteria, (parsed) => {
        const subject = parsed.subject || '';
        const text = (parsed.text || '') + (parsed.html || '');
        const sender = parsed.from?.text || '';

        // Filter: Only accept from known calendar providers or if verified
        const isGoogle = sender.includes('google.com');
        const isCalendly = sender.includes('calendly.com') || text.includes('Calendly');

        if (!isGoogle && !isCalendly) {
            // Rough filter to avoid false positives
            return;
        }

        // Try to find a lead email in the body
        // We look for emails that match our Leads database
        const allEmails = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g) || [];
        const uniqueEmails = [...new Set(allEmails.map(e => e.toLowerCase()))];
        const ourEmail = (process.env.EMAIL_USER || '').toLowerCase();

        for (const email of uniqueEmails) {
            // Skip our own email and system emails
            if (email === ourEmail || email.includes('calendar-notification') || email.includes('noreply')) continue;

            detectedMeetings.push({
                email,
                source: isGoogle ? 'GOOGLE_CALENDAR' : (isCalendly ? 'CALENDLY' : 'UNKNOWN'),
                subject,
                date: parsed.date
            });
        }
    });

    return detectedMeetings;
}

/**
 * Process detected meetings
 */
async function processMeetings() {
    try {
        const meetings = await scanForMeetings();

        if (meetings.length === 0) {
            return { found: 0, processed: 0 };
        }

        console.log(`[Meeting Monitor] Found ${meetings.length} potential meeting emails`);
        let processed = 0;

        for (const meeting of meetings) {
            // Check if this email belongs to a lead
            const result = await query('SELECT * FROM leads WHERE LOWER(email) = $1', [meeting.email]);
            const lead = result.rows[0];

            if (lead) {
                // If already marked, skip
                if (lead.status === 'MEETING_BOOKED' || lead.status === 'COMPLETED') continue;

                console.log(`[Meeting Monitor] Detected meeting for lead ${lead.name} (${lead.email})`);

                // Update lead status
                await query(`
                    UPDATE leads 
                    SET status = 'MEETING_BOOKED',
                        notes = COALESCE(notes, '') || '\n[AUTO] Meeting detected via ' || $1
                    WHERE id = $2
                `, [meeting.source, lead.id]);

                // Create Task for User
                await query(`
                    INSERT INTO tasks (lead_id, type, title, description, due_date, status)
                    VALUES ($1, 'MEETING', 'Meeting Booked', $2, CURRENT_TIMESTAMP, 'PENDING')
                `, [lead.id, `Detected from: ${meeting.subject}`]);

                // Log event
                await query(`
                    INSERT INTO events (lead_id, type, metadata)
                    VALUES ($1, 'MEETING_DETECTED', $2)
                `, [lead.id, JSON.stringify(meeting)]);

                processed++;
            }
        }

        if (processed > 0) {
            console.log(`[Meeting Monitor] Successfully processed ${processed} meeting bookings`);
        }

        return { found: meetings.length, processed };
    } catch (err) {
        console.error('[Meeting Monitor] Error:', err.message);
        return { found: 0, processed: 0 };
    }
}

module.exports = {
    scanForMeetings,
    processMeetings
};
