/**
 * LinkedIn Automation Service
 * Handles connection requests, messages, and profile tracking
 * 
 * NOTE: LinkedIn actively blocks automation. Use with caution and rate limits.
 * This service creates tasks for manual execution or integrates with browser extensions.
 */

const { db } = require('../db');

// Rate Limits (conservative to avoid LinkedIn bans)
const DAILY_LIMITS = {
    connectionRequests: 20,
    messages: 50,
    profileViews: 100
};

/**
 * Create a LinkedIn task in the task queue
 * @param {object} params - Task parameters
 */
function createLinkedInTask(params) {
    const { leadId, type, content, profileUrl } = params;

    const taskTypes = {
        'CONNECTION': 'Send connection request',
        'MESSAGE': 'Send LinkedIn message',
        'PROFILE_VIEW': 'View LinkedIn profile',
        'FOLLOW': 'Follow on LinkedIn',
        'ENGAGE': 'Engage with post (like/comment)'
    };

    const title = taskTypes[type] || 'LinkedIn action';
    const description = content || `LinkedIn ${type} for lead`;

    db.prepare(`
        INSERT INTO tasks (lead_id, type, title, description, due_date, status)
        VALUES (?, ?, ?, ?, datetime('now', '+1 day'), 'PENDING')
    `).run(leadId, 'LINKEDIN', title, description);

    // Log as message for tracking
    db.prepare(`
        INSERT INTO messages (lead_id, type, direction, content)
        VALUES (?, 'LINKEDIN', 'OUTBOUND', ?)
    `).run(leadId, `[QUEUED] ${type}: ${description}`);

    return { success: true, type };
}

/**
 * Queue a connection request
 */
function queueConnectionRequest(leadId, note) {
    // Check daily limit
    const todayCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE type = 'LINKEDIN' AND content LIKE '%CONNECTION%'
        AND date(created_at) = date('now')
    `).get().count;

    if (todayCount >= DAILY_LIMITS.connectionRequests) {
        return { success: false, error: 'Daily connection limit reached' };
    }

    return createLinkedInTask({
        leadId,
        type: 'CONNECTION',
        content: note || 'Send connection request'
    });
}

/**
 * Queue a LinkedIn message
 */
function queueLinkedInMessage(leadId, message) {
    const todayCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE type = 'LINKEDIN' AND content LIKE '%MESSAGE%'
        AND date(created_at) = date('now')
    `).get().count;

    if (todayCount >= DAILY_LIMITS.messages) {
        return { success: false, error: 'Daily message limit reached' };
    }

    return createLinkedInTask({
        leadId,
        type: 'MESSAGE',
        content: message
    });
}

/**
 * Log a LinkedIn profile view
 */
function logProfileView(leadId) {
    db.prepare(`
        INSERT INTO events (lead_id, type, meta)
        VALUES (?, 'LINKEDIN_PROFILE_VIEW', '{}')
    `).run(leadId);

    db.prepare(`
        UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(leadId);

    return { success: true };
}

/**
 * Get LinkedIn activity stats
 */
function getLinkedInStats() {
    try {
        const connections = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE type = 'LINKEDIN' AND content LIKE '%CONNECTION%'
        `).get().count;

        const messages = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE type = 'LINKEDIN' AND content LIKE '%MESSAGE%'
        `).get().count;

        const profileViews = db.prepare(`
            SELECT COUNT(*) as count FROM events WHERE type = 'LINKEDIN_PROFILE_VIEW'
        `).get().count;

        const todayConnections = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE type = 'LINKEDIN' AND content LIKE '%CONNECTION%'
            AND date(created_at) = date('now')
        `).get().count;

        return {
            total: {
                connections,
                messages,
                profileViews
            },
            today: {
                connections: todayConnections,
                remaining: DAILY_LIMITS.connectionRequests - todayConnections
            },
            limits: DAILY_LIMITS
        };
    } catch (error) {
        return { error: error.message };
    }
}

/**
 * Generate LinkedIn connection note using AI
 */
async function generateConnectionNote(lead) {
    // Uses the aiSequenceGenerator for consistency
    const { autoDraftMessage } = require('./aiSequenceGenerator');
    return await autoDraftMessage(lead, 'LINKEDIN', 'Connection request note');
}

module.exports = {
    createLinkedInTask,
    queueConnectionRequest,
    queueLinkedInMessage,
    logProfileView,
    getLinkedInStats,
    generateConnectionNote
};
