/**
 * Meeting Scheduler Service
 * Calendar integration placeholder for Google Calendar
 */

const { query } = require('../db');

// TODO: Add Google OAuth integration
// const { google } = require('googleapis');

/**
 * Get available time slots
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {number} durationMinutes - Meeting duration
 * @returns {object[]} Available slots
 */
async function getAvailableSlots(startDate = new Date(), endDate = null, durationMinutes = 30) {
    // Default to 7 days from now
    if (!endDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
    }

    // Fetch all meetings in range once to avoid N+1 DB calls
    const meetingsRes = await query(`
        SELECT start_time, end_time FROM meetings 
        WHERE start_time < $1 AND end_time > $2
    `, [endDate.toISOString(), startDate.toISOString()]);
    const bookedMeetings = meetingsRes.rows.map(m => ({
        start: new Date(m.start_time).getTime(),
        end: new Date(m.end_time).getTime()
    }));

    const slots = [];
    const current = new Date(startDate);
    current.setHours(9, 0, 0, 0);

    while (current < endDate) {
        // Skip weekends
        if (current.getDay() !== 0 && current.getDay() !== 6) {
            // Generate slots from 9 AM to 5 PM
            for (let hour = 9; hour < 17; hour++) {
                const slotTime = new Date(current);
                slotTime.setHours(hour, 0, 0, 0);
                const slotEndTime = new Date(slotTime.getTime() + durationMinutes * 60000);

                // Check if slot is booked (in memory)
                const isBooked = bookedMeetings.some(meeting =>
                    meeting.start < slotEndTime.getTime() && meeting.end > slotTime.getTime()
                );

                if (!isBooked && slotTime > new Date()) {
                    slots.push({
                        start: slotTime.toISOString(),
                        end: slotEndTime.toISOString(),
                        available: true
                    });
                }
            }
        }
        current.setDate(current.getDate() + 1);
    }

    return slots;
}

/**
 * Book a meeting
 * @param {object} params - Booking parameters
 */
async function bookMeeting(params) {
    const { leadId, startTime, endTime, title, description } = params;

    try {
        // Ensure meetings table exists (Postgres syntax)
        await query(`
            CREATE TABLE IF NOT EXISTS meetings (
                id SERIAL PRIMARY KEY,
                lead_id INTEGER,
                title TEXT,
                description TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                status TEXT DEFAULT 'SCHEDULED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check availability strictly before booking
        const conflictRes = await query(`
            SELECT COUNT(*) as count FROM meetings
            WHERE start_time < $1 AND end_time > $2
        `, [endTime, startTime]);

        if (parseInt(conflictRes.rows[0].count) > 0) {
            return { success: false, error: 'Slot already booked' };
        }

        const insertRes = await query(`
            INSERT INTO meetings (lead_id, title, description, start_time, end_time)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [leadId, title, description, startTime, endTime]);

        const meetingId = insertRes.rows[0].id;

        // Create a task for the meeting
        await query(`
            INSERT INTO tasks (lead_id, type, title, description, due_date, status)
            VALUES ($1, 'MEETING', $2, $3, $4, 'PENDING')
        `, [leadId, title, description, startTime]);

        // Log event
        await query(`
            INSERT INTO events (lead_id, type, metadata)
            VALUES ($1, 'MEETING_BOOKED', $2)
        `, [leadId, JSON.stringify({ meetingId, startTime, endTime })]);

        return { success: true, meetingId };
    } catch (error) {
        console.error('Booking Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get meetings for a lead
 */
async function getMeetingsForLead(leadId) {
    try {
        const res = await query(`
            SELECT * FROM meetings WHERE lead_id = $1 ORDER BY start_time ASC
        `, [leadId]);
        return res.rows;
    } catch (error) {
        return [];
    }
}

/**
 * Get all upcoming meetings
 */
async function getUpcomingMeetings() {
    try {
        const res = await query(`
            SELECT m.*, l.name as lead_name, l.email as lead_email
            FROM meetings m
            LEFT JOIN leads l ON m.lead_id = l.id
            WHERE m.start_time > CURRENT_TIMESTAMP
            AND m.status = 'SCHEDULED'
            ORDER BY m.start_time ASC
        `);
        return res.rows;
    } catch (error) {
        return [];
    }
}

/**
 * Generate a booking link for sequences
 * @param {number} leadId - Lead ID
 * @returns {string} Booking URL
 */
function generateBookingLink(leadId) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/book?leadId=${leadId}`;
}

module.exports = {
    getAvailableSlots,
    bookMeeting,
    getMeetingsForLead,
    getUpcomingMeetings,
    generateBookingLink
};
