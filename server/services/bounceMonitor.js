/**
 * Bounce Monitor Service (IMAP Version)
 * Scans Gmail inbox via IMAP for bounced email notifications and marks leads as invalid
 */

const { query } = require('../db');
const { searchEmails, extractEmail } = require('./imapClient');

/**
 * Extract email address from bounce message
 */
function extractBouncedEmail(text) {
    if (!text) return null;

    // Common patterns in bounce messages
    const patterns = [
        /The email account that you tried to reach does not exist.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /delivery to the following recipient failed.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /Address rejected.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /User unknown.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /550.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /Final-Recipient:.*?rfc822;?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /Original-Recipient:.*?rfc822;?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is,
        /was not delivered to:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/is
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].toLowerCase();
        }
    }

    // Fallback: use shared extractor for anything else
    const found = extractEmail(text);
    const ourEmail = (process.env.EMAIL_USER || '').toLowerCase();

    if (found && found !== ourEmail && !found.includes('mailer-daemon')) {
        return found;
    }

    return null;
}

/**
 * Get bounce type from message
 */
function getBounceType(text) {
    const hardBouncePatterns = [
        /does not exist/i,
        /user unknown/i,
        /address rejected/i,
        /no such user/i,
        /invalid recipient/i,
        /mailbox not found/i,
        /recipient rejected/i
    ];

    const softBouncePatterns = [
        /mailbox full/i,
        /over quota/i,
        /temporarily rejected/i,
        /try again later/i
    ];

    const blockedPatterns = [
        /blocked/i,
        /blacklisted/i,
        /spam/i,
        /rejected.*policy/i
    ];

    for (const pattern of hardBouncePatterns) {
        if (pattern.test(text)) return 'HARD_BOUNCE';
    }
    for (const pattern of softBouncePatterns) {
        if (pattern.test(text)) return 'SOFT_BOUNCE';
    }
    for (const pattern of blockedPatterns) {
        if (pattern.test(text)) return 'BLOCKED';
    }

    return 'UNKNOWN';
}

/**
 * Scan inbox for bounce notifications using IMAP
 */
async function scanForBounces() {
    console.log('[Bounce Monitor] Scanning for bounces...');
    const bounces = [];

    // Search for unread messages from mailer-daemon in last 7 days
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const searchCriteria = [
        'UNSEEN',
        ['OR', ['FROM', 'mailer-daemon'], ['FROM', 'postmaster']],
        ['SINCE', since]
    ];

    await searchEmails(searchCriteria, (parsed) => {
        const text = (parsed.text || '') + (parsed.html || '');
        const bouncedEmail = extractBouncedEmail(text);

        if (bouncedEmail) {
            bounces.push({
                email: bouncedEmail,
                type: getBounceType(text),
                subject: parsed.subject,
                date: parsed.date
            });
        }
    });

    return bounces;
}

/**
 * Process detected bounces - mark leads and log events
 */
async function processBounces() {
    try {
        const bounces = await scanForBounces();

        if (bounces.length === 0) {
            return { found: 0, processed: 0 };
        }

        console.log(`[Bounce Monitor] Found ${bounces.length} bounces`);
        let processed = 0;

        for (const bounce of bounces) {
            try {
                // Find the lead
                const result = await query('SELECT * FROM leads WHERE LOWER(email) = $1', [bounce.email]);
                const lead = result.rows[0];

                if (lead) {
                    // Check if already marked
                    if (lead.status === 'INVALID_EMAIL') continue;

                    // Mark lead as invalid
                    await query(`
                        UPDATE leads 
                        SET status = 'INVALID_EMAIL', 
                            notes = COALESCE(notes, '') || '\n[AUTO] Email bounced: ' || $1
                        WHERE id = $2
                    `, [bounce.type, lead.id]);

                    // Log bounce event
                    await query(`
                        INSERT INTO events (lead_id, type, metadata)
                        VALUES ($1, 'EMAIL_BOUNCE', $2)
                    `, [lead.id, JSON.stringify({ type: bounce.type, email: bounce.email })]);

                    console.log(`[Bounce Monitor] Marked lead ${lead.id} (${lead.name}) as INVALID_EMAIL`);
                    processed++;
                } else {
                    console.log(`[Bounce Monitor] No lead found for bounced email: ${bounce.email}`);
                }
            } catch (err) {
                console.error(`[Bounce Monitor] Error processing bounce for ${bounce.email}:`, err.message);
            }
        }

        return { found: bounces.length, processed };
    } catch (err) {
        console.error('[Bounce Monitor] Error:', err.message);
        return { found: 0, processed: 0 };
    }
}

module.exports = {
    scanForBounces,
    processBounces,
    extractBouncedEmail,
    getBounceType
};
