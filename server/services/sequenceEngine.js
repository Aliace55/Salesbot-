// fs removed
const path = require('path');
const { query } = require('../db');
const { fetchLeadsFromSheet } = require('./googleSheets');
const { sendSMS } = require('./quoHandler'); // A2P compliant via Quo
const { sendEmail } = require('./emailHandler');
const emailWarmup = require('./emailWarmup');
const { adaptSequenceMessage } = require('./aiSequenceGenerator');
const { buildContextForAI } = require('./conversationMemory');
const { processIncomingMessage } = require('./detailExtractor');

const SEQUENCE_FILE = path.join(__dirname, '../sequence.json');

// Helper: Get Sequence (Deprecated - using DB now)
// function getSequence() { ... }

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
        const apiUrl = process.env.API_URL || 'http://localhost:3000';
        return `${apiUrl}/api/track/click?leadId=${leadId}&url=${encodedUrl}`;
    });
}

// Helper: Select A/B Variant
async function selectVariant(stepConfig, leadId) {
    if (!stepConfig.variants || stepConfig.variants.length === 0) {
        return { variant: null, content: stepConfig.content };
    }

    // Check if lead already has a variant for this step
    const existingRes = await query(`
        SELECT variant FROM ab_tests WHERE step_id = $1 AND lead_id = $2
    `, [stepConfig.id, leadId]);
    const existing = existingRes.rows[0];

    if (existing) {
        const variant = stepConfig.variants.find(v => v.name === existing.variant);
        return { variant: existing.variant, content: variant?.content || stepConfig.content };
    }

    // Random selection
    const randomIndex = Math.floor(Math.random() * stepConfig.variants.length);
    const selected = stepConfig.variants[randomIndex];

    // Store selection
    await query(`
        INSERT INTO ab_tests (step_id, lead_id, variant) VALUES ($1, $2, $3)
    `, [stepConfig.id, leadId, selected.name]);

    return { variant: selected.name, content: selected.content };
}

// Helper: Check Conditions
async function checkCondition(condition, lead, steps) {
    if (!condition) return true;

    const { if: ifCondition, else: elseAction } = condition;

    // Check if previous step replied
    if (ifCondition.previous_step_replied === false) {
        const hasReplyRes = await query(`
            SELECT COUNT(*) as count FROM messages 
            WHERE lead_id = $1 AND direction = 'INBOUND'
        `, [lead.id]);
        const hasReplyCount = parseInt(hasReplyRes.rows[0].count);

        if (hasReplyCount > 0) {
            return elseAction === 'skip' ? false : true;
        }
    }

    // Check if email was opened
    if (ifCondition.email_opened === true) {
        const hasOpenRes = await query(`
            SELECT COUNT(*) as count FROM events 
            WHERE lead_id = $1 AND type = 'EMAIL_OPEN'
        `, [lead.id]);
        const hasOpenCount = parseInt(hasOpenRes.rows[0].count);

        if (hasOpenCount === 0) {
            return false; // Skip this step
        }
    }

    // Check if interested
    if (ifCondition.interested === true) {
        const classificationRes = await query(`
            SELECT classification FROM messages 
            WHERE lead_id = $1 AND classification = 'INTERESTED' LIMIT 1
        `, [lead.id]);
        if (classificationRes.rows.length === 0) {
            return false;
        }
    }

    // Check no response after certain steps
    if (ifCondition.no_response_after_steps) {
        const hasReplyRes = await query(`
            SELECT COUNT(*) as count FROM messages 
            WHERE lead_id = $1 AND direction = 'INBOUND'
        `, [lead.id]);
        const count = parseInt(hasReplyRes.rows[0].count);

        if (count > 0) {
            return false; // Has responded, skip this
        }
    }

    return true;
}

// Helper: Get Steps for a Lead's Campaign
async function getLeadSteps(lead) {
    try {
        let steps = [];
        // 1. Try to get specific campaign
        if (lead.campaign_id) {
            const res = await query('SELECT steps FROM sequences WHERE id = $1', [lead.campaign_id]);
            if (res.rows.length > 0) {
                // Ensure steps is array (DB returns JSONB object/array)
                // Postgres pg library parses JSONB automatically to object/array
                steps = res.rows[0].steps;
            }
        }

        // 2. Fallback to Default (First Active Sequence of same type)
        if (!steps || steps.length === 0) {
            // Determine type from lead or default to OUTBOUND
            const type = lead.lead_type || 'OUTBOUND';
            const res = await query(`
                SELECT steps FROM sequences 
                WHERE lead_type = $1 AND is_active = 1 
                ORDER BY created_at ASC LIMIT 1
            `, [type]);

            if (res.rows.length > 0) {
                steps = res.rows[0].steps;
            }
        }

        // Return parsed steps or empty array
        return Array.isArray(steps) ? steps : [];
    } catch (err) {
        console.error(`Error fetching steps for lead ${lead.id}:`, err);
        return [];
    }
}

async function runSequence() {
    console.log('--- Starting Sequence Run ---');
    // REMOVED: const steps = getSequence(); (We now fetch per lead)

    // 1. Sync Leads (Keep existing logic)
    const sheetLeads = await fetchLeadsFromSheet();
    console.log(`Debug: Fetched ${sheetLeads.length} leads from service.`);

    let newCount = 0;
    // Postgres UPSERT: ON CONFLICT DO NOTHING

    for (const lead of sheetLeads) {
        const phone = lead.phone ? lead.phone.toString().replace(/\D/g, '') : null;
        if (phone) {
            const formattedPhone = phone.length === 10 ? `+1${phone}` : `+${phone}`;

            // Try insert
            try {
                // Determine Campaign ID? For now default is NULL (will pick default)
                // Or we could match based on sheet tab name if we wanted.

                const res = await query(`
                    INSERT INTO leads (name, phone, email, product_interest, status, step, created_at, lead_type)
                    VALUES ($1, $2, $3, $4, 'NEW', 0, CURRENT_TIMESTAMP, $5)
                    ON CONFLICT (phone) DO NOTHING
                `, [lead.name, formattedPhone, lead.email, lead.product_interest, lead.type || 'OUTBOUND']);

                if (res.rowCount > 0) newCount++;
            } catch (err) {
                console.error("Error inserting lead:", err);
            }
        }
    }

    if (newCount > 0) console.log(`Imported ${newCount} new leads.`);

    // 2. Process Leads
    const leadsRes = await query("SELECT * FROM leads WHERE status IN ('NEW', 'ACTIVE') AND status NOT IN ('OPTED_OUT', 'INVALID_EMAIL', 'BOUNCED')");
    const leads = leadsRes.rows;

    for (const lead of leads) {
        // FETCH STEPS DYNAMICALLY
        const steps = await getLeadSteps(lead);
        if (steps.length > 0) {
            await processLead(lead, steps);
        } else {
            // console.log(`No active sequence found for lead ${lead.id}`);
        }
    }
}

async function processLead(lead, steps) {
    const nextStepNum = lead.step + 1;
    const stepConfig = steps.find(s => s.id === nextStepNum);

    if (!stepConfig) {
        if (lead.step > 0 && nextStepNum > steps.length) {
            await query("UPDATE leads SET status = 'COMPLETED' WHERE id = $1", [lead.id]);
        }
        return;
    }

    // Check Conditions
    if (!(await checkCondition(stepConfig.condition, lead, steps))) {
        console.log(`Skipping Step ${nextStepNum} for ${lead.name} (condition not met)`);
        // Advance to next step
        await query(`UPDATE leads SET step = $1 WHERE id = $2`, [nextStepNum, lead.id]);
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
        const { variant, content } = await selectVariant(stepConfig, lead.id);

        // ADAPTIVE MESSAGING: Check if lead has context/replies
        let finalContent = content;
        try {
            const context = await buildContextForAI(lead.id); // Now async
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
            const limits = await emailWarmup.checkSendingLimits(); // Now async
            if (!limits.canSend) {
                console.log(`[RATE LIMIT] Skipping email for ${lead.name}: ${limits.reason}`);
                return; // Don't send, don't advance - will retry next cycle
            }

            const subject = fillTemplate(stepConfig.subject, lead);
            const trackedBody = wrapLinks(filledContent, lead.id).replace(/\n/g, '<br>');

            const EMAIL_SIGNATURE = `
<br>
<div style="font-family: Arial, sans-serif; color: #333; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
    <p style="margin: 0; font-size: 16px;"><strong>Jeff Lach</strong> | Account Manager</p>
    <p style="margin: 5px 0 0 0; font-size: 14px;">Phone: (864) 860-1011</p>
    <p style="margin: 5px 0 0 0; font-size: 14px;">Website: <a href="https://trackmytruck.us" style="color: #007bff; text-decoration: none;">TrackMyTruck.us</a></p>
    <div style="margin-top: 15px;">
        <a href="https://calendar.app.google/bK9U7hCN8N7Cvoxb7" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px; display: inline-block;">Schedule a Meeting</a>
    </div>
    <div style="margin-top: 15px;">
        <img src="https://www.dropbox.com/scl/fi/0sldjieg0gwtty783thxo/Track-My-Truck-Banner-Cropped.png?rlkey=gz10bp9o6yej42gzjnjo0ptku&st=ae92ubei&dl=1" alt="Track My Truck" width="200" style="display: block;">
    </div>
</div>`;

            // Append Tracking Pixel & Signature
            const trackingUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/track/pixel/${lead.id}`;
            const emailBody = trackedBody + EMAIL_SIGNATURE + `<br><img src="${trackingUrl}" alt="" width="1" height="1" style="display:none;" />`;

            result = await sendEmail(lead.email, subject, emailBody);
        }
        else {
            // Manual (LinkedIn/Call) - Create a task
            await query(`
                INSERT INTO tasks (lead_id, type, title, description, due_date, status)
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '1 day', 'PENDING')
            `, [lead.id, stepConfig.type, `${stepConfig.type} Task`, stepConfig.description || filledContent]);
            // interval syntax for postgres: CURRENT_TIMESTAMP + INTERVAL '1 day'

            result = { success: true, manual: true };
        }

        // Handle Result
        if (result.success) {
            const newStatus = result.manual ? 'MANUAL_TASK_DUE' : 'ACTIVE';

            await query(`
                UPDATE leads SET status = $1, step = $2, last_contacted_at = CURRENT_TIMESTAMP WHERE id = $3
            `, [newStatus, nextStepNum, lead.id]);

            // Log Message (if automated) with variant
            if (!result.manual) {
                await query(`
                    INSERT INTO messages (lead_id, type, direction, content, variant)
                    VALUES ($1, $2, 'OUTBOUND', $3, $4)
                `, [lead.id, stepConfig.type, filledContent, variant]);
            }
        }
    }
}

module.exports = { runSequence, SEQUENCE_FILE };
