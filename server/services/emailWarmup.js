/**
 * Email Warmup Service
 * Gradually increases sending volume to build sender reputation
 */

const { query } = require('../db');

// Configuration
const WARMUP_SCHEDULE = [
    { day: 1, maxSends: 5 },
    { day: 2, maxSends: 10 },
    { day: 3, maxSends: 15 },
    { day: 4, maxSends: 20 },
    { day: 5, maxSends: 30 },
    { day: 6, maxSends: 40 },
    { day: 7, maxSends: 50 },
    { day: 14, maxSends: 75 },
    { day: 21, maxSends: 100 },
    { day: 30, maxSends: 150 }
];

// Minimum delay between emails (ms)
const MIN_DELAY_BETWEEN_SENDS = 60000; // 1 minute

/**
 * Get the current warmup status
 */
async function getWarmupStatus() {
    try {
        // Check when warmup started
        const firstEmailRes = await query(`
            SELECT MIN(created_at) as first_sent 
            FROM messages 
            WHERE type = 'EMAIL' AND direction = 'OUTBOUND'
        `);
        const firstEmail = firstEmailRes.rows[0];

        if (!firstEmail?.first_sent) {
            return { status: 'NOT_STARTED', day: 0, maxSends: 5, sent: 0 };
        }

        const startDate = new Date(firstEmail.first_sent);
        const today = new Date();
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

        // Find current limit
        let currentLimit = 5;
        for (const schedule of WARMUP_SCHEDULE) {
            if (daysDiff >= schedule.day) {
                currentLimit = schedule.maxSends;
            }
        }

        // Count emails sent today
        const todaySentRes = await query(`
            SELECT COUNT(*) as count 
            FROM messages 
            WHERE type = 'EMAIL' AND direction = 'OUTBOUND'
            AND date(created_at) = CURRENT_DATE
        `);
        // Postgres date(created_at) works. CURRENT_DATE is Postgres standard.
        // Also date(created_at) = date('now') works in SQLite, in Postgres it's CURRENT_DATE or NOW()::date.

        const todaySent = parseInt(todaySentRes.rows[0].count);

        return {
            status: daysDiff > 30 ? 'WARMED_UP' : 'WARMING',
            day: daysDiff,
            maxSends: currentLimit,
            sent: todaySent,
            remaining: Math.max(0, currentLimit - todaySent)
        };
    } catch (error) {
        console.error('Warmup Status Error:', error);
        return { status: 'ERROR', error: error.message };
    }
}

/**
 * Check if we can send another email today
 */
async function canSendEmail() {
    const status = await getWarmupStatus();
    return status.remaining > 0;
}

/**
 * Get recommended delay before next send (ms)
 */
async function getRecommendedDelay() {
    const status = await getWarmupStatus();

    // If no more sends allowed, return very large number
    if (status.remaining <= 0) {
        return Infinity;
    }

    // Space out sends throughout the day
    const hoursRemaining = 24 - new Date().getHours();
    const sendsPerHour = status.remaining / hoursRemaining;

    // At least 1 minute between sends, up to 30 minutes
    const delay = Math.min(
        30 * 60 * 1000, // 30 min max
        Math.max(
            MIN_DELAY_BETWEEN_SENDS,
            (60 * 60 * 1000) / sendsPerHour // Spread evenly
        )
    );

    return delay;
}

/**
 * Check sending limits and apply throttling
 * @returns {object} { canSend: boolean, delay: number, reason?: string }
 */
async function checkSendingLimits() {
    const status = await getWarmupStatus();

    if (status.status === 'ERROR') {
        return { canSend: false, delay: 0, reason: 'Error checking limits' };
    }

    if (status.remaining <= 0) {
        return {
            canSend: false,
            delay: 0,
            reason: `Daily limit reached (${status.maxSends} emails on warmup day ${status.day})`
        };
    }

    // Check time since last send
    const lastSendRes = await query(`
        SELECT created_at 
        FROM messages 
        WHERE type = 'EMAIL' AND direction = 'OUTBOUND'
        ORDER BY created_at DESC 
        LIMIT 1
    `);
    const lastSend = lastSendRes.rows[0];

    if (lastSend) {
        const timeSince = Date.now() - new Date(lastSend.created_at).getTime();
        if (timeSince < MIN_DELAY_BETWEEN_SENDS) {
            return {
                canSend: false,
                delay: MIN_DELAY_BETWEEN_SENDS - timeSince,
                reason: 'Rate limiting - minimum delay between sends'
            };
        }
    }

    return { canSend: true, delay: await getRecommendedDelay() }; // Actually getRecommendedDelay calls getWarmupStatus again. slightly inefficient but robust.
}

/**
 * Analyze email health metrics
 */
async function getEmailHealth() {
    try {
        const [totalSentRes, bouncesRes, opensRes, repliesRes] = await Promise.all([
            query("SELECT COUNT(*) as count FROM messages WHERE type = 'EMAIL' AND direction = 'OUTBOUND'"),
            query("SELECT COUNT(*) as count FROM events WHERE type = 'EMAIL_BOUNCE'"),
            query("SELECT COUNT(DISTINCT lead_id) as count FROM events WHERE type = 'EMAIL_OPEN'"),
            query("SELECT COUNT(*) as count FROM messages WHERE type = 'EMAIL' AND direction = 'INBOUND'")
        ]);

        const totalSent = parseInt(totalSentRes.rows[0].count);
        const bounces = parseInt(bouncesRes.rows[0].count);
        const opens = parseInt(opensRes.rows[0].count);
        const replies = parseInt(repliesRes.rows[0].count);

        const bounceRate = totalSent > 0 ? ((bounces / totalSent) * 100).toFixed(1) : 0;
        const openRate = totalSent > 0 ? ((opens / totalSent) * 100).toFixed(1) : 0;
        const replyRate = totalSent > 0 ? ((replies / totalSent) * 100).toFixed(1) : 0;

        // Health score (0-100)
        let healthScore = 100;
        if (parseFloat(bounceRate) > 5) healthScore -= 30;
        else if (parseFloat(bounceRate) > 2) healthScore -= 15;

        if (parseFloat(openRate) < 10) healthScore -= 20;
        if (parseFloat(replyRate) < 1) healthScore -= 10;

        return {
            totalSent,
            bounces,
            opens,
            replies,
            bounceRate: parseFloat(bounceRate),
            openRate: parseFloat(openRate),
            replyRate: parseFloat(replyRate),
            healthScore: Math.max(0, healthScore),
            status: healthScore >= 80 ? 'HEALTHY' : healthScore >= 50 ? 'WARNING' : 'CRITICAL'
        };
    } catch (error) {
        console.error('Email Health Error:', error);
        return { status: 'ERROR', error: error.message };
    }
}

module.exports = {
    getWarmupStatus,
    canSendEmail,
    getRecommendedDelay,
    checkSendingLimits,
    getEmailHealth
};
