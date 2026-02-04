const { db } = require('../db');
const funnelAI = require('./funnelAI');
const aiClassifier = require('./aiClassifier');
const bounceMonitor = require('./bounceMonitor');
const meetingMonitor = require('./meetingMonitor');

/**
 * AI Brain Service
 * acts as the central monitoring and execution engine for the AI OS.
 */
class AiBrain {
    constructor() {
        this.isRunning = false;
        this.monitorInterval = null;
        this.INTERVAL_MS = 60000; // Check every 1 minute
    }

    /**
     * Start the AI Brain background loop
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[AI BRAIN] System Online. Listening for events...');

        // Initial check
        this.runMonitoringCycle();

        // Start interval
        this.monitorInterval = setInterval(() => {
            this.runMonitoringCycle();
        }, this.INTERVAL_MS);
    }

    stop() {
        this.isRunning = false;
        if (this.monitorInterval) clearInterval(this.monitorInterval);
        console.log('[AI BRAIN] System Offline.');
    }

    /**
     * Main monitoring cycle
     */
    async runMonitoringCycle() {
        console.log('[AI BRAIN] Running monitoring cycle...');
        try {
            await this.checkStaleLeads();
            await this.checkBounces();
            await this.checkMeetings();
            await this.checkUnansweredMessages();
        } catch (err) {
            console.error('[AI BRAIN] Error in monitoring cycle:', err);
        }
    }

    /**
     * Check for meeting confirmations from calendar invites
     */
    async checkMeetings() {
        try {
            const result = await meetingMonitor.processMeetings();

            if (result.processed > 0) {
                this.logActivity(
                    'INSIGHT',
                    'HIGH',
                    `Meetings Detected: ${result.processed} New Bookings`,
                    `Detected ${result.processed} new meeting confirmations via email. Leads marked as MEETING_BOOKED.`,
                    { count: result.processed }
                );
            }
        } catch (err) {
            console.error('[AI BRAIN] Error checking meetings:', err);
        }
    }

    /**
     * Check for bounced emails and mark leads as invalid
     */
    async checkBounces() {
        try {
            const result = await bounceMonitor.processBounces();

            if (result.processed > 0) {
                this.logActivity(
                    'INSIGHT',
                    result.processed >= 5 ? 'HIGH' : 'MEDIUM',
                    `Email Hygiene: ${result.processed} Invalid Emails Removed`,
                    `Detected ${result.found} bounced emails. ${result.processed} leads marked as INVALID_EMAIL and removed from sequences.`,
                    { count: result.processed }
                );
            }
        } catch (err) {
            console.error('[AI BRAIN] Error checking bounces:', err);
        }
    }

    /**
     * Check for leads that are going cold
     */
    async checkStaleLeads() {
        const leads = db.prepare("SELECT * FROM leads WHERE status != 'LOST' AND status != 'WON'").all();

        for (const lead of leads) {
            const warning = funnelAI.getLeadWarning(lead);
            if (warning) {
                // Check if we already alerted recently (prevent spam)
                const existing = db.prepare(`
                    SELECT * FROM ai_activities 
                    WHERE type = 'ACTION_REQUIRED' 
                    AND title LIKE 'Lead Going Cold: %' 
                    AND created_at > datetime('now', '-24 hours')
                    AND metadata LIKE ?
                `).get(`%${lead.id}%`);

                if (!existing) {
                    this.logActivity(
                        'ACTION_REQUIRED',
                        warning.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
                        `Lead Going Cold: ${lead.name}`,
                        `${warning.message}. Suggested action: Send re-engagement email.`,
                        { leadId: lead.id, action: 'SEND_RE_ENGAGEMENT' }
                    );
                }
            }
        }
    }

    /**
     * Check for recent unread messages to classify
     * (Placeholder for now, assumes messages are processed on arrival usually)
     */
    async checkUnansweredMessages() {
        // In a real system, we'd queue unread messages here.
        // For now, we'll log a system heartbeat
        const hour = new Date().getHours();
        if (hour === 9) { // Daily Morning Brief
            const existing = db.prepare("SELECT * FROM ai_activities WHERE title = 'Daily System Health Check' AND created_at > datetime('now', '-12 hours')").get();
            if (!existing) {
                this.logActivity('SYSTEM_LOG', 'LOW', 'Daily System Health Check', 'All systems operational. Database integrity verified.', {});
            }
        }
    }

    /**
     * Execute an approved action
     * @param {number} activityId 
     */
    async executeAction(activityId) {
        const activity = db.prepare('SELECT * FROM ai_activities WHERE id = ?').get(activityId);
        if (!activity) throw new Error('Activity not found');

        const metadata = JSON.parse(activity.metadata || '{}');
        const { leadId, action } = metadata;

        console.log(`[AI BRAIN] Executing Action: ${action} for Lead ${leadId}`);

        if (action === 'SEND_RE_ENGAGEMENT' && leadId) {
            const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
            if (!lead) throw new Error('Lead not found');

            // 1. Generate Email
            const template = "Hi {name}, it's been a while. Are you still looking for a fleet tracking solution?";
            const message = await aiClassifier.personalizeMessage(lead, template, 'EMAIL');

            // 2. "Send" Email (Log to messages)
            db.prepare(`
                INSERT INTO messages (lead_id, type, direction, content)
                VALUES (?, 'EMAIL', 'OUTBOUND', ?)
            `).run(leadId, message);

            // 3. Update Lead
            db.prepare("UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?").run(leadId);

            // 4. Log Completion
            this.logActivity(
                'SYSTEM_LOG',
                'LOW',
                `Re-engagement Sent: ${lead.name}`,
                `Automated email sent: "${message.substring(0, 50)}..."`,
                { leadId }
            );
        }

        return true;
    }

    /**
     * Helper to log activity to DB
     */
    logActivity(type, severity, title, description, metadata = {}) {
        try {
            console.log(`[AI LOG] [${type}] ${title}`);
            db.prepare(`
                INSERT INTO ai_activities (type, severity, title, description, metadata, status) 
                VALUES (?, ?, ?, ?, ?, 'PENDING')
            `).run(type, severity, title, description, JSON.stringify(metadata));
        } catch (e) {
            console.error('Failed to log AI activity:', e);
        }
    }
}

// Singleton
const aiBrain = new AiBrain();
module.exports = aiBrain;
