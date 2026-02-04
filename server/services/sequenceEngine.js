const fs = require('fs');
const path = require('path');
const { db } = require('../db');
const { fetchLeadsFromSheet } = require('./googleSheets');
const { sendSMS } = require('./quoHandler'); // A2P compliant via Quo
const { sendEmail } = require('./emailHandler');
const emailWarmup = require('./emailWarmup');
const { adaptSequenceMessage } = require('./aiSequenceGenerator');
const { buildContextForAI } = require('./conversationMemory');
const { processIncomingMessage } = require('./detailExtractor');

const SEQUENCE_FILE = path.join(__dirname, '../sequence.json');

// Helper: Get Sequence
function getSequence() {
    try {
        const data = fs.readFileSync(SEQUENCE_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading sequence.json:', err);
        return [];
    }
}

// Helper: Fill Variables (The "Smart Engine")
function fillTemplate(template, lead) {
    if (!template) return '';
    let text = template;
    const name = lead.name || 'there';
    const firstName = name.split(' ')[0];
    const interest = (lead.product_interest || '').toLowerCase();

    // Basic Replacements
    text = text.replace(/{{name}}/g, name);
    text = text.replace(/{{firstName}}/g, firstName);
    text = text.replace(/{{city}}/g, lead.city || 'your area');
    text = text.replace(/{{company}}/g, lead.company || 'your company');

    // Meeting/Booking Link
    const bookingUrl = process.env.CALENDAR_BOOKING_URL || 'https://calendar.app.google';
    text = text.replace(/{{booking_link}}/g, bookingUrl);
    text = text.replace(/{{meeting_link}}/g, bookingUrl);
    text = text.replace(/{{calendar_link}}/g, bookingUrl);

    // Smart Hooks based on interest
    let hooks = {
        sms_hook: 'are you currently tracking your fleet vehicles?',
        email_subject: 'Fleet visibility',
        email_body: 'Just wanted to see if you have full visibility into where your drivers are right now.'
    };

    if (interest.includes('construction') || interest.includes('heavy') || interest.includes('theft')) {
        hooks.sms_hook = 'are you currently tracking your yellow iron or trailers for theft?';
        hooks.email_subject = 'Protecting your assets';
        hooks.email_body = 'Theft is up this year. Our Tail Light Trackers are impossible for thieves to spot.';
    }
    else if (interest.includes('hvac') || interest.includes('plumb')) {
        hooks.sms_hook = 'are you using any GPS on your service vans to track arrival times?';
        hooks.email_subject = 'Dispatch Efficiency';
        hooks.email_body = 'We help trades businesses verify timesheets and optimize dispatch routes.';
    }

    text = text.replace(/{{sms_hook}}/g, hooks.sms_hook);
    text = text.replace(/{{email_subject}}/g, hooks.email_subject);
    text = text.replace(/{{email_body}}/g, hooks.email_body);

    return text;
}

// Helper: Wrap Links for Tracking
function wrapLinks(text, leadId) {
    if (!text || !leadId) return text;
    return text.replace(/(https?:\/\/[^\s]+)/g, (url) => {
        if (url.includes('/api/track/click')) return url;
        const encodedUrl = encodeURIComponent(url);
        return `http://localhost:3000/api/track/click?leadId=${leadId}&url=${encodedUrl}`;
    });
}

// Helper: Select A/B Variant
function selectVariant(stepConfig, leadId) {
    if (!stepConfig.variants || stepConfig.variants.length === 0) {
        return { variant: null, content: stepConfig.content };
    }

    // Check if lead already has a variant for this step
    const existing = db.prepare(`
        SELECT variant FROM ab_tests WHERE step_id = ? AND lead_id = ?
    `).get(stepConfig.id, leadId);

    if (existing) {
        const variant = stepConfig.variants.find(v => v.name === existing.variant);
        return { variant: existing.variant, content: variant?.content || stepConfig.content };
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * stepConfig.variants.length);
    const selected = stepConfig.variants[randomIndex];

    // Store selection
    db.prepare(`
        INSERT INTO ab_tests (step_id, lead_id, variant) VALUES (?, ?, ?)
    `).run(stepConfig.id, leadId, selected.name);

    return { variant: selected.name, content: selected.content };
}

// Helper: Check Conditions
function checkCondition(condition, lead, steps) {
    if (!condition) return true;

    const { if: ifCondition, else: elseAction } = condition;

    // Check if previous step replied
    if (ifCondition.previous_step_replied === false) {
        const hasReply = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE lead_id = ? AND direction = 'INBOUND'
        `).get(lead.id);
        if (hasReply.count > 0) {
            return elseAction === 'skip' ? false : true;
        }
    }

    // Check if email was opened
    if (ifCondition.email_opened === true) {
        const hasOpen = db.prepare(`
            SELECT COUNT(*) as count FROM events 
            WHERE lead_id = ? AND type = 'EMAIL_OPEN'
        `).get(lead.id);
        if (hasOpen.count === 0) {
            return false; // Skip this step
        }
    }

    // Check if interested
    if (ifCondition.interested === true) {
        const classification = db.prepare(`
            SELECT classification FROM messages 
            WHERE lead_id = ? AND classification = 'INTERESTED' LIMIT 1
        `).get(lead.id);
        if (!classification) {
            return false;
        }
    }

    // Check no response after certain steps
    if (ifCondition.no_response_after_steps) {
        const hasReply = db.prepare(`
            SELECT COUNT(*) as count FROM messages 
            WHERE lead_id = ? AND direction = 'INBOUND'
        `).get(lead.id);
        if (hasReply.count > 0) {
            return false; // Has responded, skip this
        }
    }

    return true;
}

async function runSequence() {
    console.log('--- Starting Sequence Run ---');
    const steps = getSequence();

    // 1. Sync Leads
    const sheetLeads = await fetchLeadsFromSheet();
    console.log(`Debug: Fetched ${sheetLeads.length} leads from service.`);

    let newCount = 0;
    const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO leads (name, phone, email, product_interest, status, step, created_at)
        VALUES (?, ?, ?, ?, 'NEW', 0, CURRENT_TIMESTAMP)
    `);

    sheetLeads.forEach(lead => {
        const phone = lead.phone ? lead.phone.toString().replace(/\D/g, '') : null;
        if (phone) {
            const formattedPhone = phone.length === 10 ? `+1${phone}` : `+${phone}`;
            const info = insertStmt.run(lead.name, formattedPhone, lead.email, lead.product_interest);
            if (info.changes > 0) newCount++;
        }
    });

    if (newCount > 0) console.log(`Imported ${newCount} new leads.`);

    // 2. Process Leads
    const leads = db.prepare("SELECT * FROM leads WHERE status IN ('NEW', 'ACTIVE') AND status NOT IN ('OPTED_OUT', 'INVALID_EMAIL', 'BOUNCED')").all();

    for (const lead of leads) {
        await processLead(lead, steps);
    }
}

async function processLead(lead, steps) {
    const nextStepNum = lead.step + 1;
    const stepConfig = steps.find(s => s.id === nextStepNum);

    if (!stepConfig) {
        if (lead.step > 0 && nextStepNum > steps.length) {
            db.prepare("UPDATE leads SET status = 'COMPLETED' WHERE id = ?").run(lead.id);
        }
        return;
    }

    // Check Conditions
    if (!checkCondition(stepConfig.condition, lead, steps)) {
        console.log(`Skipping Step ${nextStepNum} for ${lead.name} (condition not met)`);
        // Advance to next step
        db.prepare(`UPDATE leads SET step = ? WHERE id = ?`).run(nextStepNum, lead.id);
        return;
    }

    // Check Timing
    let shouldRun = false;
    const now = new Date();

    if (lead.status === 'NEW' && stepConfig.id === 1) {
        shouldRun = true;
    } else if (lead.last_contacted_at) {
        const lastDate = new Date(lead.last_contacted_at);
        const diffDays = (now - lastDate) / (1000 * 60 * 60 * 24);
        if (diffDays >= stepConfig.delayDays) {
            shouldRun = true;
        }
    }

    if (shouldRun) {
        console.log(`Executing Step ${nextStepNum} (${stepConfig.type}) for ${lead.name}`);

        let result = { success: false };

        // A/B Testing: Select Variant
        const { variant, content } = selectVariant(stepConfig, lead.id);

        // ADAPTIVE MESSAGING: Check if lead has context/replies
        let finalContent = content;
        try {
            const context = buildContextForAI(lead.id);
            if (context && context.hasReplied) {
                console.log(`[Adaptive] Lead ${lead.name} has replied - adapting message`);
                const adapted = await adaptSequenceMessage(content, lead.id, stepConfig.type);
                if (adapted.adapted) {
                    finalContent = adapted.content;
                    console.log(`[Adaptive] Message adapted for ${lead.name}`);
                }
            }
        } catch (adaptErr) {
            console.log('[Adaptive] Error (using original):', adaptErr.message);
        }

        const filledContent = fillTemplate(finalContent, lead);

        if (stepConfig.type === 'SMS') {
            const trackedContent = wrapLinks(filledContent, lead.id);
            result = await sendSMS(lead.phone, trackedContent);
        }
        else if (stepConfig.type === 'EMAIL') {
            // Check warmup limits before sending
            const limits = emailWarmup.checkSendingLimits();
            if (!limits.canSend) {
                console.log(`[RATE LIMIT] Skipping email for ${lead.name}: ${limits.reason}`);
                return; // Don't send, don't advance - will retry next cycle
            }

            const subject = fillTemplate(stepConfig.subject, lead);
            const trackedBody = wrapLinks(filledContent, lead.id).replace(/\n/g, '<br>');

            // Append Tracking Pixel
            const trackingUrl = `http://localhost:3000/api/track/pixel/${lead.id}`;
            const emailBody = trackedBody + `<br><img src="${trackingUrl}" alt="" width="1" height="1" style="display:none;" />`;

            result = await sendEmail(lead.email, subject, emailBody);
        }
        else {
            // Manual (LinkedIn/Call) - Create a task
            db.prepare(`
                INSERT INTO tasks (lead_id, type, title, description, due_date, status)
                VALUES (?, ?, ?, ?, datetime('now', '+1 day'), 'PENDING')
            `).run(lead.id, stepConfig.type, `${stepConfig.type} Task`, stepConfig.description || filledContent);

            result = { success: true, manual: true };
        }

        // Handle Result
        if (result.success) {
            const newStatus = result.manual ? 'MANUAL_TASK_DUE' : 'ACTIVE';

            db.prepare(`
                UPDATE leads SET status = ?, step = ?, last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(newStatus, nextStepNum, lead.id);

            // Log Message (if automated) with variant
            if (!result.manual) {
                db.prepare(`
                    INSERT INTO messages (lead_id, type, direction, content, variant)
                    VALUES (?, ?, 'OUTBOUND', ?, ?)
                `).run(lead.id, stepConfig.type, filledContent, variant);
            }
        }
    }
}

module.exports = { runSequence, getSequence, SEQUENCE_FILE };
