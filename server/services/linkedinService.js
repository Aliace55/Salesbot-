/**
 * LinkedIn Automation Service
 * Handles connection requests, messages, and profile tracking
 * 
 * NOTE: LinkedIn actively blocks automation. Use with caution and rate limits.
 * This service creates tasks for manual execution or integrates with browser extensions.
 */

const { query } = require('../db');

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
async function createLinkedInTask(params) {
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

    await query(`
        INSERT INTO tasks (lead_id, type, title, description, due_date, status)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '1 day', 'PENDING')
    `, [leadId, 'LINKEDIN', title, description]);

    // Log as message for tracking
    await query(`
        INSERT INTO messages (lead_id, type, direction, content)
        VALUES ($1, 'LINKEDIN', 'OUTBOUND', $2)
    `, [leadId, `[QUEUED] ${type}: ${description}`]);

    return { success: true, type };
}

/**
 * Queue a connection request
 */
async function queueConnectionRequest(leadId, note) {
    // Check daily limit
    const res = await query(`
        SELECT COUNT(*) as count FROM messages 
        WHERE type = 'LINKEDIN' AND content LIKE '%CONNECTION%'
        AND date(created_at) = CURRENT_DATE
    `);
    const todayCount = parseInt(res.rows[0].count);

    if (todayCount >= DAILY_LIMITS.connectionRequests) {
        return { success: false, error: 'Daily connection limit reached' };
    }

    return await createLinkedInTask({
        leadId,
        type: 'CONNECTION',
        content: note || 'Send connection request'
    });
}

/**
 * Queue a LinkedIn message
 */
async function queueLinkedInMessage(leadId, message) {
    const res = await query(`
        SELECT COUNT(*) as count FROM messages 
        WHERE type = 'LINKEDIN' AND content LIKE '%MESSAGE%'
        AND date(created_at) = CURRENT_DATE
    `);
    const todayCount = parseInt(res.rows[0].count);

    if (todayCount >= DAILY_LIMITS.messages) {
        return { success: false, error: 'Daily message limit reached' };
    }

    return await createLinkedInTask({
        leadId,
        type: 'MESSAGE',
        content: message
    });
}

/**
 * Log a LinkedIn profile view
 */
async function logProfileView(leadId) {
    await query(`
        INSERT INTO events (lead_id, type, metadata)
        VALUES ($1, 'LINKEDIN_PROFILE_VIEW', '{}')
    `, [leadId]);

    await query(`
        UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [leadId]);

    return { success: true };
}

/**
 * Get LinkedIn activity stats
 */
async function getLinkedInStats() {
    try {
        const [connectionsRes, messagesRes, profileViewsRes, todayConnectionsRes] = await Promise.all([
            query("SELECT COUNT(*) as count FROM messages WHERE type = 'LINKEDIN' AND content LIKE '%CONNECTION%'"),
            query("SELECT COUNT(*) as count FROM messages WHERE type = 'LINKEDIN' AND content LIKE '%MESSAGE%'"),
            query("SELECT COUNT(*) as count FROM events WHERE type = 'LINKEDIN_PROFILE_VIEW'"),
            query("SELECT COUNT(*) as count FROM messages WHERE type = 'LINKEDIN' AND content LIKE '%CONNECTION%' AND date(created_at) = CURRENT_DATE")
        ]);

        const connections = parseInt(connectionsRes.rows[0].count);
        const messages = parseInt(messagesRes.rows[0].count);
        const profileViews = parseInt(profileViewsRes.rows[0].count);
        const todayConnections = parseInt(todayConnectionsRes.rows[0].count);

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
