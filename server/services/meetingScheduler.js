/**
 * Meeting Scheduler Service
 * Calendar integration placeholder for Google Calendar
 */

const { db } = require('../db');

// TODO: Add Google OAuth integration
// const { google } = require('googleapis');

/**
 * Get available time slots
 * @param {Date} startDate - Start of range
 * @param {Date} endDate - End of range
 * @param {number} durationMinutes - Meeting duration
 * @returns {object[]} Available slots
 */
function getAvailableSlots(startDate = new Date(), endDate = null, durationMinutes = 30) {
    // Default to 7 days from now
    if (!endDate) {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
    }

    // For now, return mock availability (9 AM - 5 PM weekdays)
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

                // Check if slot is already booked
                const isBooked = checkIfSlotBooked(slotTime, durationMinutes);

                if (!isBooked && slotTime > new Date()) {
                    slots.push({
                        start: slotTime.toISOString(),
                        end: new Date(slotTime.getTime() + durationMinutes * 60000).toISOString(),
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
 * Check if a time slot is already booked
 */
function checkIfSlotBooked(slotTime, durationMinutes) {
    try {
        const slotEnd = new Date(slotTime.getTime() + durationMinutes * 60000);

        const conflict = db.prepare(`
            SELECT COUNT(*) as count FROM meetings
            WHERE start_time < ? AND end_time > ?
        `).get(slotEnd.toISOString(), slotTime.toISOString());

        return conflict?.count > 0;
    } catch (error) {
        // Table might not exist yet
        return false;
    }
}

/**
 * Book a meeting
 * @param {object} params - Booking parameters
 */
function bookMeeting(params) {
    const { leadId, startTime, endTime, title, description } = params;

    try {
        // Ensure meetings table exists
        db.exec(`
            CREATE TABLE IF NOT EXISTS meetings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lead_id INTEGER,
                title TEXT,
                description TEXT,
                start_time DATETIME,
                end_time DATETIME,
                status TEXT DEFAULT 'SCHEDULED',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const result = db.prepare(`
            INSERT INTO meetings (lead_id, title, description, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
        `).run(leadId, title, description, startTime, endTime);

        // Create a task for the meeting
        db.prepare(`
            INSERT INTO tasks (lead_id, type, title, description, due_date, status)
            VALUES (?, 'MEETING', ?, ?, ?, 'PENDING')
        `).run(leadId, title, description, startTime);

        // Log event
        db.prepare(`
            INSERT INTO events (lead_id, type, meta)
            VALUES (?, 'MEETING_BOOKED', ?)
        `).run(leadId, JSON.stringify({ meetingId: result.lastInsertRowid, startTime, endTime }));

        return { success: true, meetingId: result.lastInsertRowid };
    } catch (error) {
        console.error('Booking Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get meetings for a lead
 */
function getMeetingsForLead(leadId) {
    try {
        return db.prepare(`
            SELECT * FROM meetings WHERE lead_id = ? ORDER BY start_time ASC
        `).all(leadId);
    } catch (error) {
        return [];
    }
}

/**
 * Get all upcoming meetings
 */
function getUpcomingMeetings() {
    try {
        return db.prepare(`
            SELECT m.*, l.name as lead_name, l.email as lead_email
            FROM meetings m
            LEFT JOIN leads l ON m.lead_id = l.id
            WHERE m.start_time > datetime('now')
            AND m.status = 'SCHEDULED'
            ORDER BY m.start_time ASC
        `).all();
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
