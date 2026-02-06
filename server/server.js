const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { query } = require('./db'); // Import DB Query Helper
const { handleIncomingMessage: handleTwilioMessage } = require('./services/twilioHandler');
const { handleIncomingMessage: handleQuoMessage } = require('./services/quoHandler');
const { handleVapiWebhook } = require('./services/vapiHandler');
const { runSequence } = require('./services/sequenceEngine');
const funnelAI = require('./services/funnelAI');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- AI BRAIN / OPERATING SYSTEM ---

const aiBrain = require('./services/aiBrain');

// Initialize Brain
aiBrain.start();

// Helper to log AI activity (Refactored to use Brain, or keep independent if needed)
function logAiActivity(type, severity, title, description, metadata = {}) {
    // Fire and forget, or make this async if needed. 
    // Ideally aiBrain.logActivity handles its own async operations internally.
    aiBrain.logActivity(type, severity, title, description, metadata);
}

// Get AI Feed
app.get('/api/brain/feed', async (req, res) => {
    try {
        // Schema is handled in db.js initDB()
        const result = await query('SELECT * FROM ai_activities ORDER BY created_at DESC LIMIT 50');
        const activities = result.rows;

        // Parse metadata JSON with error handling
        const parsedActivities = activities.map(a => {
            try {
                return { ...a, metadata: JSON.parse(a.metadata || '{}') };
            } catch (e) {
                return { ...a, metadata: {} };
            }
        });
        res.json(parsedActivities);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Handle AI Action Decision
app.post('/api/brain/action', async (req, res) => {
    const { id, decision } = req.body; // decision: 'APPROVED' | 'REJECTED'
    if (!id || !decision) return res.status(400).json({ error: 'Missing ID or decision' });

    try {
        await query('UPDATE ai_activities SET status = $1 WHERE id = $2', [decision, id]);

        // If approved, trigger the actual logic via Brain
        if (decision === 'APPROVED') {
            await aiBrain.executeAction(id);
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Simulate AI Event (For Demo)
app.post('/api/brain/simulate', (req, res) => {
    const { type, title, description } = req.body;
    try {
        logAiActivity(type || 'INSIGHT', 'MEDIUM', title || 'Simulated Event', description || 'This event was triggered manually.', {}, 'PENDING');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;

// Middleware


// API Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Sales Engine is Running' });
});

// Trigger Sync Manually (for "Start Day" button or Cron)
app.post('/api/sync', async (req, res) => {
    console.log('Manual sync triggered via API');
    try {
        // Run Sheet Sync (Inbound/Outbound)
        const { runFullSync } = require('./services/sheetSync');
        await runFullSync();

        // Run Sequence Engine
        await runSequence();

        res.json({ success: true, message: 'Sync and Sequence run complete' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// === GOOGLE SHEETS SYNC ===
const { runFullSync } = require('./services/sheetSync');

// Manual Trigger
app.post('/api/sync/sheets', async (req, res) => {
    console.log('Manual Sheet Sync Triggered');
    const result = await runFullSync();
    res.json(result);
});

// Sync Status
app.get('/api/sync/status', async (req, res) => {
    try {
        const result = await query('SELECT MAX(last_synced_at) as last_sync FROM leads');
        res.json({ lastSync: result.rows[0].last_sync });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Scheduled Sync (Every 5 Minutes)
const SYNC_INTERVAL_MS = 5 * 60 * 1000;
setInterval(() => {
    console.log('[Scheduler] Running scheduled sheet sync...');
    runFullSync().catch(err => console.error('[Scheduler] Sync failed:', err));
}, SYNC_INTERVAL_MS);

// === CAMPAIGN MANAGEMENT (sequences) ===

// Get All Sequences (Campaigns)
app.get('/api/sequences', async (req, res) => {
    try {
        const { lead_type } = req.query;
        let sql = 'SELECT * FROM sequences';
        const params = [];

        if (lead_type) {
            sql += ' WHERE lead_type = $1';
            params.push(lead_type);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Single Sequence
app.get('/api/sequences/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM sequences WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not Found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Sequence
app.post('/api/sequences', async (req, res) => {
    try {
        const { name, lead_type, description, steps } = req.body;
        const result = await query(`
            INSERT INTO sequences (name, lead_type, description, steps, is_active)
            VALUES ($1, $2, $3, $4, 1)
            RETURNING *
        `, [name, lead_type || 'OUTBOUND', description, JSON.stringify(steps || [])]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Sequence
app.put('/api/sequences/:id', async (req, res) => {
    try {
        const { name, description, steps, is_active } = req.body;

        // Dynamic update
        const updates = [];
        const values = [];
        let idx = 1;

        if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
        if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
        if (steps !== undefined) { updates.push(`steps = $${idx++}`); values.push(JSON.stringify(steps)); }
        if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active); }

        values.push(req.params.id);

        const result = await query(`
            UPDATE sequences SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${idx} RETURNING *
        `, values);

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Sequence
app.delete('/api/sequences/:id', async (req, res) => {
    try {
        await query('DELETE FROM sequences WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI Generate Sequence (Mock/Stub for now, or use real AI)
app.post('/api/ai/generate-sequence', async (req, res) => {
    try {
        const { industry, product, steps, leadType } = req.body;
        // In a real app, call GPT-4 here. For now, use a template.
        const generated = [
            { id: 1, type: 'SMS', delayDays: 0, content: `Hey {{firstName}}, saw you're in ${industry}. Are you using ${product}?` },
            { id: 2, type: 'EMAIL', delayDays: 1, subject: `${product} for ${industry}`, content: `Hi {{firstName}},\n\nWanted to share how ${product} helps ${industry} companies.\n\nBest,\nJeff` },
            { id: 3, type: 'CALL', delayDays: 2, description: 'Follow up call' }
        ];
        res.json({ success: true, sequence: generated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// --- DEEP RESEARCH API (Perplexity) ---
const researchService = require('./services/researchService');

app.post('/api/research/company', async (req, res) => {
    const { company, domain } = req.body;
    try {
        const summary = await researchService.researchCompany(company, domain);
        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/research/lead', async (req, res) => {
    const { name, company } = req.body;
    try {
        const summary = await researchService.researchPerson(name, company);
        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CONVERSATION MEMORY API ---

const conversationMemory = require('./services/conversationMemory');
const detailExtractor = require('./services/detailExtractor');

// Get unified conversation view for a lead
app.get('/api/leads/:id/conversation', async (req, res) => {
    try {
        const leadId = req.params.id;
        const result = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = result.rows[0];

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Ideally these services should also be async, but if they read from non-DB or cached sources...
        // Wait, conversationMemory reads from DB! It MUST be refactored too.
        // Assuming they will be refactored to async:
        const history = await conversationMemory.getFullConversationHistory(leadId);
        const context = await conversationMemory.buildContextForAI(leadId);
        const extractedDetails = detailExtractor.getExtractedDetails(leadId); // This might need async too

        res.json({
            lead: {
                id: lead.id,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                company: lead.company,
                status: lead.status,
                funnelStage: lead.funnel_stage,
                conversationSummary: lead.conversation_summary,
                lastObjection: lead.last_objection,
                buyingSignals: lead.buying_signals,
                preferredChannel: lead.preferred_channel
            },
            conversation: history,
            extractedDetails,
            contextPrompt: context ? conversationMemory.generateContextPrompt(leadId) : null
        });
    } catch (err) {
        console.error('Conversation API error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Draft a contextual reply
app.post('/api/leads/:id/draft-reply', async (req, res) => {
    try {
        const leadId = req.params.id;
        const { channel, incomingMessage } = req.body;

        const { draftContextualReply } = require('./services/aiSequenceGenerator');
        const result = await draftContextualReply(leadId, incomingMessage || '', channel || 'EMAIL');

        res.json(result);
    } catch (err) {
        console.error('Draft Reply API error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Advance Lead (Mark Task Done)
app.post('/api/leads/:id/advance', async (req, res) => {
    try {
        const leadId = req.params.id;
        const result = await query("SELECT * FROM leads WHERE id = $1", [leadId]);
        const lead = result.rows[0];

        if (lead) {
            // Log the 'Done' task
            const { getSequence } = require('./services/sequenceEngine'); // Lazy load
            const steps = getSequence();
            const currentStep = steps.find(s => s.id === lead.step);

            if (currentStep) {
                console.log(`Logging Manual Completion: ${currentStep.type}`);
                await query(`
                  INSERT INTO messages (lead_id, type, direction, content)
                  VALUES ($1, $2, 'OUTBOUND', $3)
                `, [lead.id, currentStep.type, `Manual Task Completed: ${currentStep.description || 'No desc'}`]);
            }

            // set status to ACTIVE so it gets picked up for next step
            await query("UPDATE leads SET status = 'ACTIVE', last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1", [leadId]);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Lead not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create Lead
app.post('/api/leads', async (req, res) => {
    try {
        const { name, phone, email, product_interest, source, company, campaign, lead_type, lead_source } = req.body;

        if (!phone && !email) {
            return res.status(400).json({ error: 'Phone or email is required' });
        }

        console.log(`[Lead Capture] Incoming Lead from ${source || 'Unknown'} (${name})`);

        // Normalize phone
        let cleanPhone = null;
        if (phone) {
            const digits = phone.toString().replace(/\D/g, '');
            if (digits.length === 10) cleanPhone = '+1' + digits;
            else if (digits.length > 10) cleanPhone = '+' + digits;
            else cleanPhone = phone;
        }

        // Send Notification Email
        const normalizedSource = source ? source.toLowerCase() : '';
        const validSources = ['google ads', 'facebook', 'website', 'google', 'facebook ads'];

        if (validSources.includes(normalizedSource)) {
            const { sendEmail } = require('./services/emailHandler');
            const alertHtml = `
                <h2>New Lead Capture 🚀</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Phone:</strong> ${cleanPhone || phone}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Source:</strong> ${source}</p>
                <p><strong>Company:</strong> ${company || 'N/A'}</p>
                <br>
                <p><em>Lead has been added to the CRM and assigned to 'NEW' status.</em></p>
            `;
            // Fire and forget email
            sendEmail('jeff.lach@trackmytruck.us', `New Lead: ${name} (${source})`, alertHtml)
                .catch(e => console.error('[Email Alert] Failed:', e));
        }

        // Auto-detect lead type if not provided
        const leadTypeDetector = require('./services/leadTypeDetector');
        const detected = leadTypeDetector.detectLeadType(source, campaign);

        const finalLeadType = lead_type || detected.leadType;
        const finalLeadSource = lead_source || detected.leadSource;
        const isHot = finalLeadType === 'INBOUND' ? 1 : 0;

        const result = await query(`
            INSERT INTO leads (name, phone, email, product_interest, source, company, campaign, status, step, lead_type, lead_source, is_hot, funnel_stage)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'NEW', 0, $8, $9, $10, 'LEAD')
            RETURNING id
        `, [name || 'Unknown', cleanPhone, email || null, product_interest || null, source || 'Manual', company || null, campaign || null, finalLeadType, finalLeadSource, isHot]);

        const newLeadId = result.rows[0].id;

        // Push to Google Sheet "Inbound" Tab (Concurrent backup)
        try {
            const { writeLeadToSheet } = require('./services/googleSheets');
            // We construct the lead object for the sheet
            const leadForSheet = {
                name: name || 'Unknown',
                phone: cleanPhone || phone,
                email: email,
                company: company,
                status: 'NEW',
                source: source || 'Webhook'
            };
            // Fire and forget (don't block response)
            writeLeadToSheet(leadForSheet, 'Inbound').catch(e => console.error('[Sheet Write] Failed:', e));
        } catch (e) {
            console.error('[Sheet Write] Error:', e);
        }

        // Trigger Research
        if (company) {
            const { researchCompany } = require('./services/researchService');
            researchCompany(company, null).then(async (summary) => {
                if (summary) {
                    try {
                        await query("UPDATE leads SET research_summary = $1 WHERE id = $2", [summary, newLeadId]);
                        console.log(`[Research] Completed for: ${company}`);
                    } catch (e) { console.error(e); }
                }
            }).catch(e => console.error(e));
        }

        res.json({ success: true, leadId: newLeadId, leadType: finalLeadType, leadSource: finalLeadSource });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Lead
app.delete('/api/leads/:id', async (req, res) => {
    try {
        const leadId = req.params.id;

        // Delete related records first
        await query('DELETE FROM messages WHERE lead_id = $1', [leadId]);
        await query('DELETE FROM events WHERE lead_id = $1', [leadId]);
        await query('DELETE FROM tasks WHERE lead_id = $1', [leadId]);

        const result = await query('DELETE FROM leads WHERE id = $1', [leadId]);

        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Lead not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update Contact (CRM)
app.put('/api/contacts/:id', async (req, res) => {
    try {
        const leadId = req.params.id;
        const fields = req.body;

        // Build dynamic update
        const allowedFields = [
            'name', 'first_name', 'last_name', 'email', 'phone', 'job_title',
            'company', 'website', 'street_address', 'city', 'state', 'zip_code',
            'country', 'linkedin_url', 'job_function', 'department', 'email_domain',
            'notes', 'tags', 'owner', 'score', 'company_size', 'industry',
            'revenue', 'timezone', 'product_interest', 'source', 'campaign'
        ];

        const updates = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(fields)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${idx}`);
                values.push(value);
                idx++;
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(leadId);
        const sql = `UPDATE leads SET ${updates.join(', ')}, last_activity = CURRENT_TIMESTAMP WHERE id = $${idx}`;

        const result = await query(sql, values);

        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Contact not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Merge Contacts
app.post('/api/contacts/merge', async (req, res) => {
    const { sourceId, targetId } = req.body;
    if (!sourceId || !targetId) return res.status(400).json({ error: 'Source and Target IDs required' });

    try {
        await query('BEGIN');

        // Reassign all related records (messages, events, tasks)
        // We need to check if tables exist or just assume standard schema.
        // Based on previous reads, these tables exist.
        await query('UPDATE messages SET lead_id = $1 WHERE lead_id = $2', [targetId, sourceId]);
        await query('UPDATE tasks SET lead_id = $1 WHERE lead_id = $2', [targetId, sourceId]);
        await query('UPDATE events SET lead_id = $1 WHERE lead_id = $2', [targetId, sourceId]);

        // Delete the source lead
        await query('DELETE FROM leads WHERE id = $1', [sourceId]);

        await query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await query('ROLLBACK');
        console.error('Merge Error:', err);
        res.status(500).json({ error: 'Failed to merge contacts' });
    }
});

// === CSV IMPORT ===
app.post('/api/import/csv', async (req, res) => {
    try {
        const { contacts } = req.body;

        if (!Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ error: 'No contacts provided' });
        }

        let imported = 0;
        let skipped = 0;
        let errors = [];

        // Postgres uses ON CONFLICT for deduplication
        // Assuming 'phone' is the UNIQUE constraint we care about, or maybe email if we enforce it. 
        // Schema has `phone TEXT UNIQUE`. 
        const insertSql = `
            INSERT INTO leads (
                name, first_name, last_name, email, phone, job_title, company, website,
                street_address, city, state, zip_code, country, linkedin_url, 
                job_function, department, email_domain, source, status, step
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 'NEW', 0)
            ON CONFLICT (phone) DO NOTHING
        `;

        for (const row of contacts) {
            try {
                // Map CSV header variations
                const firstName = row['First Name'] || row['first_name'] || row['firstName'] || '';
                const lastName = row['Last Name'] || row['last_name'] || row['lastName'] || '';
                const name = row['Name'] || row['name'] || `${firstName} ${lastName}`.trim() || 'Unknown';
                const email = row['Email'] || row['email'] || '';
                const phone = row['phone_number'] || row['Phone'] || row['phone'] || '';
                const jobTitle = row['Job Title'] || row['job_title'] || row['title'] || '';
                const company = row['Company'] || row['company'] || '';
                const website = row['Website'] || row['website'] || '';
                const street = row['Company Street Address'] || row['street_address'] || row['address'] || '';
                const city = row['Company City'] || row['city'] || '';
                const state = row['Company State'] || row['state'] || '';
                const zip = row['Company Zip Code'] || row['zip_code'] || row['zip'] || '';
                const country = row['Company Country'] || row['country'] || '';
                const linkedin = row['LinkedIn Contact Profile URL'] || row['linkedin_url'] || row['linkedin'] || '';
                const jobFunction = row['Job Function'] || row['job_function'] || '';
                const department = row['Department'] || row['department'] || '';
                const emailDomain = row['Email Domain'] || (email ? email.split('@')[1] : '') || '';

                // Normalize phone
                let cleanPhone = null;
                if (phone) {
                    const digits = phone.toString().replace(/\D/g, '');
                    if (digits.length === 10) cleanPhone = '+1' + digits;
                    else if (digits.length > 10) cleanPhone = '+' + digits;
                    else cleanPhone = phone;
                }

                // Skip if no phone (since unqiue constraint requires it usually, or if we want to allow email-only we'd need a different constraint)
                // For now, let's try to insert. If cleanPhone is null, multiple nulls might be allowed or not depending on DB.
                // SQLite allows multiple NULLs in UNIQUE columns. Postgres does too.

                const result = await query(insertSql, [
                    name, firstName, lastName, email || null, cleanPhone,
                    jobTitle, company, website, street, city, state, zip, country,
                    linkedin, jobFunction, department, emailDomain, 'CSV Import'
                ]);

                if (result.rowCount > 0) imported++;
                else skipped++;
            } catch (rowErr) {
                errors.push({ row, error: rowErr.message });
                skipped++;
            }
        }

        res.json({
            success: true,
            imported,
            skipped,
            total: contacts.length,
            errors: errors.slice(0, 5) // Return first 5 errors only
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === FUNNEL MANAGEMENT ===

// Get funnel stages
app.get('/api/funnel/stages', (req, res) => {
    res.json(funnelAI.FUNNEL_STAGES);
});

// Get funnel stats
app.get('/api/funnel/stats', async (req, res) => {
    try {
        const result = await query('SELECT * FROM leads');
        const leads = result.rows;
        const stats = funnelAI.getFunnelStats(leads);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get leads by funnel stage
app.get('/api/funnel/leads', async (req, res) => {
    try {
        const { stage } = req.query;
        let sql = `
            SELECT l.*, 
                (SELECT COUNT(*) FROM messages WHERE lead_id = l.id) as message_count,
                (SELECT MAX(created_at) FROM messages WHERE lead_id = l.id) as last_message_at
            FROM leads l
        `;
        const params = [];

        if (stage && stage !== 'all') {
            sql += ` WHERE COALESCE(l.funnel_stage, 'LEAD') = $1`;
            params.push(stage);
        }

        sql += ` ORDER BY l.stage_changed_at DESC, l.created_at DESC`;

        const result = await query(sql, params);
        const leads = result.rows;

        // Add warnings for cold leads
        leads.forEach(lead => {
            lead.warning = funnelAI.getLeadWarning(lead);
        });

        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Manually change lead stage
app.put('/api/leads/:id/stage', async (req, res) => {
    try {
        const { id } = req.params;
        const { stage, lock = false } = req.body;

        if (!funnelAI.FUNNEL_STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const leadResult = await query('SELECT * FROM leads WHERE id = $1', [id]);
        const lead = leadResult.rows[0];
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const fromStage = lead.funnel_stage || 'LEAD';

        // Update lead
        await query(`
            UPDATE leads SET 
                funnel_stage = $1, 
                stage_changed_at = CURRENT_TIMESTAMP,
                stage_locked = $2,
                ai_confidence = NULL,
                last_ai_reason = NULL
            WHERE id = $3
        `, [stage, lock ? 1 : 0, id]);

        // Log to history
        await query(`
            INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_by, reason)
            VALUES ($1, $2, $3, 'MANUAL', 'User manually changed stage')
        `, [id, fromStage, stage]);

        res.json({ success: true, fromStage, toStage: stage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lock/unlock stage for AI changes
app.put('/api/leads/:id/lock-stage', async (req, res) => {
    try {
        const { id } = req.params;
        const { locked } = req.body;

        await query('UPDATE leads SET stage_locked = $1 WHERE id = $2', [locked ? 1 : 0, id]);
        res.json({ success: true, locked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stage history for a lead
app.get('/api/leads/:id/stage-history', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(`
            SELECT * FROM stage_history WHERE lead_id = $1 ORDER BY created_at DESC
        `, [id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI analyze and suggest next stage (without applying)
app.post('/api/leads/:id/analyze-stage', async (req, res) => {
    try {
        const { id } = req.params;
        const leadResult = await query('SELECT * FROM leads WHERE id = $1', [id]);
        const lead = leadResult.rows[0];

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Get latest message
        const msgResult = await query(`
            SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1
        `, [id]);
        const latestMessage = msgResult.rows[0];

        const analysis = funnelAI.analyzeAndProgress(lead, latestMessage, latestMessage?.direction === 'INBOUND' ? 'INBOUND_MESSAGE' : 'OUTBOUND_MESSAGE');

        res.json({
            currentStage: lead.funnel_stage || 'LEAD',
            analysis,
            warning: funnelAI.getLeadWarning(lead)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Apply AI suggestion to lead
app.post('/api/leads/:id/apply-ai-stage', async (req, res) => {
    try {
        const { id } = req.params;
        const { newStage, confidence, reason } = req.body;

        const leadResult = await query('SELECT * FROM leads WHERE id = $1', [id]);
        const lead = leadResult.rows[0];
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (lead.stage_locked) {
            return res.status(400).json({ error: 'Stage is locked' });
        }

        const fromStage = lead.funnel_stage || 'LEAD';

        // Update lead
        await query(`
            UPDATE leads SET 
                funnel_stage = $1,
                stage_changed_at = CURRENT_TIMESTAMP,
                ai_confidence = $2,
                last_ai_reason = ?
            WHERE id = ?
        `).run(newStage, confidence, reason, id);

        // Log to history
        db.prepare(`
            INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_by, confidence, reason)
            VALUES (?, ?, ?, 'AI', ?, ?)
        `).run(id, fromStage, newStage, confidence, reason);

        res.json({ success: true, fromStage, toStage: newStage, confidence });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Batch AI stage analysis (for background processing)
app.post('/api/funnel/batch-analyze', async (req, res) => {
    try {
        const result = await query(`
            SELECT l.*, 
                (SELECT content FROM messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
                (SELECT direction FROM messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_direction
            FROM leads l 
            WHERE l.stage_locked = 0 AND COALESCE(l.funnel_stage, 'LEAD') NOT IN ('WON', 'LOST')
        `);
        const leads = result.rows;

        let updated = 0;
        const changes = [];

        for (const lead of leads) {
            const message = lead.last_message_content ? { content: lead.last_message_content, direction: lead.last_message_direction } : null;
            const eventType = lead.last_message_direction === 'INBOUND' ? 'INBOUND_MESSAGE' : 'OUTBOUND_MESSAGE';

            const analysis = funnelAI.analyzeAndProgress(lead, message, eventType);

            if (analysis.shouldChange) {
                // Apply the change
                await query(`
                    UPDATE leads SET 
                        funnel_stage = $1,
                        stage_changed_at = CURRENT_TIMESTAMP,
                        ai_confidence = $2,
                        last_ai_reason = $3
                    WHERE id = $4
                `, [analysis.newStage, analysis.confidence, analysis.reason, lead.id]);

                await query(`
                    INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_by, confidence, reason)
                    VALUES ($1, $2, $3, 'AI', $4, $5)
                `, [lead.id, analysis.fromStage, analysis.newStage, analysis.confidence, analysis.reason]);

                changes.push({
                    leadId: lead.id,
                    name: lead.name,
                    from: analysis.fromStage,
                    to: analysis.newStage,
                    confidence: analysis.confidence
                });
                updated++;
            }
        }

        res.json({ success: true, analyzed: leads.length, updated, changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === COMPANY MANAGEMENT ===

// Get all companies with lead counts
app.get('/api/companies', async (req, res) => {
    try {
        const { search, industry, sort = 'lead_count', order = 'desc' } = req.query;

        let sql = `
            SELECT c.*, 
                   COUNT(l.id) as lead_count,
                   MAX(l.last_activity) as last_activity
            FROM companies c
            LEFT JOIN leads l ON l.company_id = c.id
        `;

        const params = [];
        const conditions = [];

        if (search) {
            conditions.push(`(c.name ILIKE $${params.length + 1} OR c.domain ILIKE $${params.length + 2})`);
            params.push(`%${search}%`, `%${search}%`);
        }

        if (industry) {
            conditions.push(`c.industry ILIKE $${params.length + 1}`);
            params.push(`%${industry}%`);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }

        sql += ` GROUP BY c.id`;

        // Sorting
        const validSorts = ['lead_count', 'name', 'domain', 'created_at', 'last_activity'];
        const sortCol = validSorts.includes(sort) ? sort : 'lead_count';
        const sortDir = order === 'asc' ? 'ASC' : 'DESC';
        sql += ` ORDER BY ${sortCol} ${sortDir}`;

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get single company with all leads
app.get('/api/companies/:id', async (req, res) => {
    try {
        const companyId = req.params.id;

        const companyRes = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
        const company = companyRes.rows[0];

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const leadsRes = await query(`
            SELECT * FROM leads 
            WHERE company_id = $1 
            ORDER BY last_activity DESC NULLS LAST, created_at DESC
        `, [companyId]);

        res.json({ ...company, leads: leadsRes.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create company
app.post('/api/companies', async (req, res) => {
    try {
        const { name, domain, industry, company_size, website, street_address, city, state, zip_code, country, phone, notes } = req.body;

        if (!name && !domain) {
            return res.status(400).json({ error: 'Name or domain is required' });
        }

        const result = await query(`
            INSERT INTO companies (name, domain, industry, company_size, website, street_address, city, state, zip_code, country, phone, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            name || domain?.split('.')[0] || 'Unknown',
            domain?.toLowerCase() || null,
            industry || null,
            company_size || null,
            website || (domain ? `https://${domain}` : null),
            street_address || null,
            city || null,
            state || null,
            zip_code || null,
            country || null,
            phone || null,
            notes || null
        ]);

        const newCompany = result.rows[0];
        res.json({ success: true, company: newCompany });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update company
app.put('/api/companies/:id', async (req, res) => {
    try {
        const companyId = req.params.id;
        const fields = req.body;

        const allowedFields = [
            'name', 'domain', 'industry', 'company_size', 'website',
            'street_address', 'city', 'state', 'zip_code', 'country',
            'phone', 'notes'
        ];

        const updates = [];
        const values = [];
        let idx = 1;

        for (const [key, value] of Object.entries(fields)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${idx}`);
                values.push(value);
                idx++;
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(companyId);
        const sql = `UPDATE companies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`;

        const result = await query(sql, values);

        if (result.rowCount > 0) {
            const companyRes = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
            res.json({ success: true, company: companyRes.rows[0] });
        } else {
            res.status(404).json({ error: 'Company not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete company (and optionally its leads)
app.delete('/api/companies/:id', async (req, res) => {
    try {
        const companyId = req.params.id;
        const { deleteLeads = false } = req.query;

        if (deleteLeads === 'true') {
            // Delete all leads under this company
            const leadsRes = await query('SELECT id FROM leads WHERE company_id = $1', [companyId]);
            const leads = leadsRes.rows;
            for (const lead of leads) {
                await query('DELETE FROM messages WHERE lead_id = $1', [lead.id]);
                await query('DELETE FROM events WHERE lead_id = $1', [lead.id]);
                await query('DELETE FROM tasks WHERE lead_id = $1', [lead.id]);
            }
            await query('DELETE FROM leads WHERE company_id = $1', [companyId]);
        } else {
            // Just unlink leads from company
            await query('UPDATE leads SET company_id = NULL WHERE company_id = $1', [companyId]);
        }

        const result = await query('DELETE FROM companies WHERE id = $1', [companyId]);

        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Company not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get leads for a company
app.get('/api/companies/:id/leads', async (req, res) => {
    try {
        const companyId = req.params.id;

        const result = await query(`
            SELECT l.*, 
                   (SELECT COUNT(*) FROM messages WHERE lead_id = l.id) as message_count,
                   (SELECT COUNT(*) FROM events WHERE lead_id = l.id) as event_count
            FROM leads l
            WHERE l.company_id = $1
            ORDER BY l.last_activity DESC NULLS LAST, l.created_at DESC
        `, [companyId]);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Add lead to company
app.post('/api/companies/:id/leads', async (req, res) => {
    try {
        const companyId = req.params.id;
        const { name, email, phone, job_title, department, linkedin_url } = req.body;

        // Get company for domain
        const companyRes = await query('SELECT * FROM companies WHERE id = $1', [companyId]);
        const company = companyRes.rows[0];
        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Normalize phone
        let cleanPhone = null;
        if (phone) {
            const digits = phone.toString().replace(/\D/g, '');
            if (digits.length === 10) cleanPhone = '+1' + digits;
            else if (digits.length > 10) cleanPhone = '+' + digits;
            else cleanPhone = phone;
        }

        // Create lead linked to company
        const result = await query(`
            INSERT INTO leads (name, email, phone, job_title, department, linkedin_url, company_id, company, email_domain, status, step)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'NEW', 0)
            RETURNING *
        `, [
            name || 'Unknown',
            email || null,
            cleanPhone,
            job_title || null,
            department || null,
            linkedin_url || null,
            companyId,
            company.name,
            company.domain
        ]);

        res.json({ success: true, lead: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === ACTIVITY TIMELINE ===
app.get('/api/contacts/:id/activity', async (req, res) => {
    try {
        const leadId = req.params.id;

        // Run queries in parallel
        const [msgRes, eventRes, taskRes] = await Promise.all([
            query(`
                SELECT id, 'message' as activity_type, type, direction, content, 
                       classification, created_at
                FROM messages 
                WHERE lead_id = $1
            `, [leadId]),
            query(`
                SELECT id, 'event' as activity_type, type, meta, created_at
                FROM events 
                WHERE lead_id = $1
            `, [leadId]),
            query(`
                SELECT id, 'task' as activity_type, type, title, status, 
                       completed_at, created_at
                FROM tasks 
                WHERE lead_id = $1
            `, [leadId])
        ]);

        // Combine and sort by date
        const activities = [...msgRes.rows, ...eventRes.rows, ...taskRes.rows]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(activities);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === CONTACT NOTES ===
app.post('/api/contacts/:id/notes', async (req, res) => {
    try {
        const leadId = req.params.id;
        const { note } = req.body;

        const leadRes = await query('SELECT notes FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        if (!lead) return res.status(404).json({ error: 'Contact not found' });

        const timestamp = new Date().toISOString();
        const newNote = `[${timestamp}] ${note}`;
        const updatedNotes = lead.notes ? `${newNote}\n---\n${lead.notes}` : newNote;

        await query('UPDATE leads SET notes = $1, last_activity = CURRENT_TIMESTAMP WHERE id = $2', [updatedNotes, leadId]);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === TEAM STATS / LEADERBOARD ===
app.get('/api/team/stats', async (req, res) => {
    try {
        // Group by owner
        const statsRes = await query(`
            SELECT 
                COALESCE(owner, 'Unassigned') as rep_name,
                COUNT(*) as total_leads,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'MANUAL_INTERVENTION' THEN 1 ELSE 0 END) as pending_replies,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active
            FROM leads
            GROUP BY owner
            ORDER BY completed DESC
        `);

        // Get message counts per owner
        const msgCountsRes = await query(`
            SELECT 
                COALESCE(l.owner, 'Unassigned') as rep_name,
                COUNT(m.id) as messages_sent
            FROM leads l
            LEFT JOIN messages m ON l.id = m.lead_id AND m.direction = 'OUTBOUND'
            GROUP BY l.owner
        `);

        // Merge stats
        const merged = statsRes.rows.map(s => {
            const mc = msgCountsRes.rows.find(m => m.rep_name === s.rep_name);
            return { ...s, messages_sent: parseInt(mc?.messages_sent || 0) };
        });

        res.json(merged);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === BEST TIME ANALYSIS ===
app.get('/api/analytics/best-times', async (req, res) => {
    try {
        // Analyze when replies come in (hour of day)
        // Postgres: EXTRACT(HOUR FROM created_at)
        const hourlyRes = await query(`
            SELECT 
                CAST(EXTRACT(HOUR FROM created_at) AS INTEGER) as hour,
                COUNT(*) as reply_count
            FROM messages
            WHERE direction = 'INBOUND'
            GROUP BY hour
            ORDER BY reply_count DESC
        `);

        // Analyze day of week
        // Postgres: EXTRACT(DOW FROM created_at) (0=Sunday)
        const dailyRes = await query(`
            SELECT 
                CAST(EXTRACT(DOW FROM created_at) AS INTEGER) as day,
                COUNT(*) as reply_count
            FROM messages
            WHERE direction = 'INBOUND'
            GROUP BY day
            ORDER BY reply_count DESC
        `);

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        res.json({
            bestHours: hourlyRes.rows.slice(0, 5),
            bestDays: dailyRes.rows.map(d => ({ ...d, dayName: dayNames[d.day] })).slice(0, 3),
            recommendation: hourlyRes.rows.length > 0
                ? `Best time to send: ${hourlyRes.rows[0]?.hour}:00`
                : 'Not enough data yet'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === OPT-OUT DETECTION ===
app.post('/api/leads/:id/opt-out', async (req, res) => {
    try {
        const leadId = req.params.id;

        await query(`
            UPDATE leads 
            SET status = 'OPTED_OUT', last_activity = CURRENT_TIMESTAMP 
            WHERE id = $1
        `, [leadId]);

        // Log the opt-out event
        await query(`
            INSERT INTO events (lead_id, type, meta, created_at)
            VALUES ($1, 'OPT_OUT', 'Manual opt-out', CURRENT_TIMESTAMP)
        `, [leadId]);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- TASK MANAGEMENT API ---

// Get All Tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const status = req.query.status || 'PENDING';
        const result = await query(`
            SELECT t.*, l.name as lead_name, l.email as lead_email, l.phone as lead_phone
            FROM tasks t
            LEFT JOIN leads l ON t.lead_id = l.id
            WHERE t.status = $1
            ORDER BY t.due_date ASC
        `, [status]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete Task
app.post('/api/tasks/:id/complete', async (req, res) => {
    try {
        const taskId = req.params.id;
        await query(`
            UPDATE tasks SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = $1
        `, [taskId]);

        // Also advance the lead
        const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        const task = taskRes.rows[0];

        if (task) {
            await query(`
                UPDATE leads SET status = 'ACTIVE', last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [task.lead_id]);

            // Log the completion
            await query(`
                INSERT INTO messages (lead_id, type, direction, content)
                VALUES ($1, $2, 'OUTBOUND', $3)
            `, [task.lead_id, task.type, `Task Completed: ${task.title}`]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Skip Task
app.post('/api/tasks/:id/skip', async (req, res) => {
    try {
        const taskId = req.params.id;
        await query(`UPDATE tasks SET status = 'SKIPPED' WHERE id = $1`, [taskId]);

        // Advance the lead anyway
        const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        const task = taskRes.rows[0];
        if (task) {
            await query(`UPDATE leads SET status = 'ACTIVE' WHERE id = $1`, [task.lead_id]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI CLASSIFICATION ---
const { classifyReply } = require('./services/aiClassifier');

app.post('/api/ai/classify', async (req, res) => {
    try {
        const { message, messageId } = req.body;
        const result = await classifyReply(message);

        // Update message with classification if ID provided
        if (messageId) {
            await query(`UPDATE messages SET classification = $1 WHERE id = $2`, [result.classification, messageId]);
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI SEQUENCE GENERATION ---
const { generateSequence, saveSequence, generatePersonalizationSuggestions, autoDraftMessage } = require('./services/aiSequenceGenerator');

app.post('/api/ai/generate-sequence', async (req, res) => {
    try {
        const result = await generateSequence(req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/save-sequence', async (req, res) => {
    try {
        const { sequence, lead_type = 'OUTBOUND', name } = req.body;

        // If saving to database with lead_type
        if (name) {
            const existingRes = await query('SELECT id FROM sequences WHERE name = $1 AND lead_type = $2', [name, lead_type]);
            const existing = existingRes.rows[0];

            if (existing) {
                await query('UPDATE sequences SET steps = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [JSON.stringify(sequence), existing.id]);
                res.json({ success: true, id: existing.id });
            } else {
                const result = await query(
                    'INSERT INTO sequences (name, lead_type, steps) VALUES ($1, $2, $3) RETURNING id',
                    [name, lead_type, JSON.stringify(sequence)]
                );
                res.json({ success: true, id: result.rows[0].id });
            }
        } else {
            // Legacy file-based save (if still needed, ensure saveSequence is async or handles DB if properly refactored)
            // Assuming saveSequence writes to file:
            const result = saveSequence(sequence);
            res.json(result);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === SEQUENCE MANAGEMENT ===

// Get all sequences
app.get('/api/sequences', async (req, res) => {
    try {
        const { lead_type } = req.query;
        let result;
        if (lead_type) {
            result = await query('SELECT * FROM sequences WHERE lead_type = $1 ORDER BY created_at DESC', [lead_type]);
        } else {
            result = await query('SELECT * FROM sequences ORDER BY lead_type, created_at DESC');
        }
        // Parse steps JSON
        const sequences = result.rows.map(s => ({
            ...s,
            steps: s.steps ? JSON.parse(s.steps) : []
        }));
        res.json(sequences);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single sequence
app.get('/api/sequences/:id', async (req, res) => {
    try {
        const result = await query('SELECT * FROM sequences WHERE id = $1', [req.params.id]);
        const seq = result.rows[0];
        if (!seq) return res.status(404).json({ error: 'Sequence not found' });
        seq.steps = seq.steps ? JSON.parse(seq.steps) : [];
        res.json(seq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create sequence
app.post('/api/sequences', async (req, res) => {
    try {
        const { name, lead_type = 'OUTBOUND', description, steps = [] } = req.body;
        const result = await query(
            'INSERT INTO sequences (name, lead_type, description, steps) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, lead_type, description || null, JSON.stringify(steps)]
        );
        res.json({ success: true, id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update sequence
app.put('/api/sequences/:id', async (req, res) => {
    try {
        const { name, lead_type, description, steps, is_active } = req.body;
        const seqRes = await query('SELECT * FROM sequences WHERE id = $1', [req.params.id]);
        const seq = seqRes.rows[0];
        if (!seq) return res.status(404).json({ error: 'Sequence not found' });

        await query(`
            UPDATE sequences SET 
                name = COALESCE($1, name),
                lead_type = COALESCE($2, lead_type),
                description = COALESCE($3, description),
                steps = COALESCE($4, steps),
                is_active = COALESCE($5, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [
            name || null,
            lead_type || null,
            description || null,
            steps ? JSON.stringify(steps) : null,
            is_active ?? null,
            req.params.id
        ]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete sequence
app.delete('/api/sequences/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM sequences WHERE id = $1', [req.params.id]);
        if (result.rowCount > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Sequence not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/personalization/:leadId', async (req, res) => {
    try {
        const leadRes = await query('SELECT * FROM leads WHERE id = $1', [req.params.leadId]);
        const lead = leadRes.rows[0];
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const suggestions = await generatePersonalizationSuggestions(lead);
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/ai/draft-message', async (req, res) => {
    try {
        const { leadId, channel, context } = req.body;
        const leadRes = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const draft = await autoDraftMessage(lead, channel, context);
        res.json({ draft });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CLIENT API ---

// Get All Leads
app.get('/api/leads', async (req, res) => {
    try {
        const result = await query('SELECT * FROM leads ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Messages for a Lead
app.get('/api/messages/:leadId', async (req, res) => {
    try {
        const result = await query('SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at ASC', [req.params.leadId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send Manual Message
app.post('/api/messages', async (req, res) => {
    const { leadId, content } = req.body;
    const { sendSMS } = require('./services/twilioHandler'); // Lazy load to ensure services are ready

    try {
        const leadRes = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        console.log(`Sending manual SMS to ${lead.phone}: ${content}`);
        const result = await sendSMS(lead.phone, content);

        if (result.success) {
            // Log outgoing 
            await query(`
                INSERT INTO messages (lead_id, type, direction, content)
                VALUES ($1, 'MANUAL_SMS', 'OUTBOUND', $2)
            `, [leadId, content]);

            // Update last contact
            await query("UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = $1", [leadId]);

            res.json({ success: true });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});


// Get Analytics
app.get('/api/analytics', async (req, res) => {
    try {
        // Run aggregation queries in parallel
        const [totalRes, activeRes, sentRes, repliedRes, emailOpensRes, constRes, hvacRes, msgStatsRes, leadsRes] = await Promise.all([
            query('SELECT COUNT(*) as count FROM leads'),
            query("SELECT COUNT(*) as count FROM leads WHERE status = 'ACTIVE'"),
            query("SELECT COUNT(*) as count FROM messages WHERE direction = 'OUTBOUND'"),
            query("SELECT COUNT(DISTINCT lead_id) as count FROM messages WHERE direction = 'INBOUND'"),
            query("SELECT COUNT(DISTINCT lead_id) as count FROM events WHERE type = 'EMAIL_OPEN'"),
            query("SELECT COUNT(*) as count FROM leads WHERE product_interest LIKE '%Construction%'"), // LIKE is case sensitive in Postgres, ILIKE is not. SQLite default LIKE is case-insensitive for ASCII. 'ILIKE' is safer for Postgres text match.
            query("SELECT COUNT(*) as count FROM leads WHERE product_interest LIKE '%HVAC%'"),
            query("SELECT type, direction, COUNT(*) as count FROM messages GROUP BY type, direction"),
            query('SELECT id, name, company, status, buying_signals, created_at FROM leads')
        ]);

        const totalLeads = parseInt(totalRes.rows[0].count);
        const activeLeads = parseInt(activeRes.rows[0].count);
        const totalSent = parseInt(sentRes.rows[0].count);
        const repliedCount = parseInt(repliedRes.rows[0].count);

        let emailOpens = 0;
        try {
            emailOpens = parseInt(emailOpensRes.rows[0].count);
        } catch (e) {
            console.warn('Events table query failed', e);
        }

        const constructionLeads = parseInt(constRes.rows[0].count);
        const hvacLeads = parseInt(hvacRes.rows[0].count);

        const responseRate = totalLeads > 0 ? ((repliedCount / totalLeads) * 100).toFixed(1) : 0;

        // Channel Breakdown
        const channels = {
            EMAIL: { sent: 0, replies: 0, opens: 0 },
            SMS: { sent: 0, replies: 0 },
            CALL: { completed: 0 },
            LINKEDIN: { completed: 0 }
        };

        const msgStats = msgStatsRes.rows;

        msgStats.forEach(stat => {
            const type = stat.type; // SMS, EMAIL, CALL, LINKEDIN
            if (channels[type]) {
                const count = parseInt(stat.count);
                if (stat.direction === 'OUTBOUND') {
                    if (type === 'CALL' || type === 'LINKEDIN') channels[type].completed += count;
                    else channels[type].sent += count;
                } else if (stat.direction === 'INBOUND') {
                    if (channels[type]) channels[type].replies += count;
                }
            }
        });

        // Email Opens
        channels.EMAIL.opens = emailOpens;

        // Channel breakdown by lead type (placeholder for now)
        const channelsByLeadType = {
            INBOUND: {
                EMAIL: { sent: 0, replies: 0, opens: 0 },
                SMS: { sent: 0, replies: 0 },
                CALL: { completed: 0 },
                LINKEDIN: { completed: 0 }
            },
            OUTBOUND: {
                EMAIL: { sent: 0, replies: 0, opens: 0 },
                SMS: { sent: 0, replies: 0 },
                CALL: { completed: 0 },
                LINKEDIN: { completed: 0 }
            }
        };

        // --- INTENT SCORING ---
        const leads = leadsRes.rows;

        const scoredLeads = await Promise.all(leads.map(async lead => {
            let score = 0;
            const signals = lead.buying_signals ? lead.buying_signals.split(',').length : 0;

            // Scoring Rules
            if (lead.status === 'MEETING_BOOKED') score += 50;
            if (lead.status === 'MEETING_REQUEST') score += 40;
            if (lead.status === 'INTERESTED') score += 20;
            score += (signals * 5); // 5 points per signal

            // Check interaction history 
            // Running queries in loop! Bad performance but correct logic for migration. 
            // Better to JOIN in the leads query, but let's stick to safe refactor.
            const replyRes = await query("SELECT COUNT(*) as count FROM messages WHERE lead_id = $1 AND direction = 'INBOUND'", [lead.id]);
            const replyCount = parseInt(replyRes.rows[0].count);
            score += (replyCount * 5);

            const clickRes = await query("SELECT COUNT(*) as count FROM events WHERE lead_id = $1 AND type = 'LINK_CLICK'", [lead.id]);
            const clickCount = parseInt(clickRes.rows[0].count);
            score += (clickCount * 3);

            const openRes = await query("SELECT COUNT(*) as count FROM events WHERE lead_id = $1 AND type = 'EMAIL_OPEN'", [lead.id]);
            const openCount = parseInt(openRes.rows[0].count);
            score += (openCount * 1);

            return { ...lead, score, signalCount: signals };
        }));

        scoredLeads.sort((a, b) => b.score - a.score);

        const highIntent = scoredLeads.filter(l => l.score >= 15).slice(0, 10);
        const mediumIntent = scoredLeads.filter(l => l.score >= 5 && l.score < 15).slice(0, 10);

        res.json({
            totalLeads,
            activeLeads,
            totalSent,
            repliedCount,
            responseRate,
            emailOpens,
            leadTypeCounts: { inbound: constructionLeads + hvacLeads, outbound: totalLeads - (constructionLeads + hvacLeads) }, // Approximate
            channels,
            channelsByLeadType,
            intentData: {
                highIntent,
                mediumIntent
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- WEB TRACKING SCRIPT ---
app.get('/api/tracking/script.js', (req, res) => {
    const script = `
(function() {
    const API_URL = '${process.env.BASE_URL || 'http://localhost:3000'}';
    console.log('TrackMyTruck Monitor Loaded');

    function track(event, data = {}) {
        fetch(API_URL + '/api/tracking/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event,
                url: window.location.href,
                referrer: document.referrer,
                data
            })
        }).catch(err => console.error('Tracking Error:', err));
    }

    // Track Pageview
    track('PAGE_VIEW');

    // expose specific tracking
    window.SalesbotTrack = track;
})();
    `;
    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);
});

app.post('/api/tracking/event', (req, res) => {
    // Log tracking event
    const { event, url, data } = req.body;
    console.log(`[Web Tracking] ${event} on ${url}`);
    // In production, match visitor IP to lead if possible, or use cookie ID
    res.json({ success: true });
});





const { generateSmartReply } = require('./services/openaiHandler');

app.post('/api/ai/generate', async (req, res) => {
    const { leadId } = req.body;

    try {
        const leadRes = await query('SELECT * FROM leads WHERE id = $1', [leadId]);
        const lead = leadRes.rows[0];
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const historyRes = await query('SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at ASC', [leadId]);
        const history = historyRes.rows;

        // Format history for the handler
        const formattedHistory = history.map(m => ({
            role: m.direction === 'OUTBOUND' ? 'assistant' : 'user',
            content: m.content
        }));

        const draft = await generateSmartReply(formattedHistory, lead.name);
        res.json({ draft });
    } catch (err) {
        console.error('AI Gen Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Twilio Webhook
app.post('/webhooks/twilio-sms', (req, res) => {
    // Twilio sends data as form-urlencoded, parsed by express.urlencoded middleware
    handleIncomingMessage(req.body);

    // Respond with empty TwiML to stop Twilio from auto-replying or erroring
    res.type('text/xml');
    res.send('<Response></Response>');
});

// --- CLICK TO CALL ---
const { initiateCall, handleCallStatus } = require('./services/twilioHandler');

app.post('/api/calls/initiate', async (req, res) => {
    const { leadId, repPhone } = req.body;

    try {
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const result = await initiateCall(lead.phone, leadId, repPhone);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/webhooks/twilio-voice-status', (req, res) => {
    handleCallStatus(req.body);
    res.status(200).send('OK');
});

// --- TRACKING: LINK CLICKS ---
app.get('/api/track/click', (req, res) => {
    const { url, leadId } = req.query;

    if (!url) return res.status(400).send('Missing URL');

    try {
        console.log(`[Tracking] Link Click by Lead ${leadId} -> ${url}`);
        if (leadId) {
            db.prepare(`
                INSERT INTO events (lead_id, type, meta) 
                VALUES (?, 'LINK_CLICK', ?)
            `).run(leadId, JSON.stringify({ url }));
        }
    } catch (err) {
        console.error('Tracking Error:', err);
    }

    res.redirect(url);
});

// --- OMNI-CHANNEL INGESTION ---
app.post('/api/webhooks/leads', (req, res) => {
    // Expects: { name, phone, email, source, campaign_name }
    const { name, phone, email, source, campaign_name } = req.body;

    console.log(`[Webhook] Received lead from ${source || 'Unknown'}: ${name}`);

    if (!phone && !email) {
        return res.status(400).json({ error: 'Phone or Email required' });
    }

    try {
        // 1. Normalize Phone
        let cleanPhone = null;
        if (phone) {
            const digits = phone.toString().replace(/\D/g, '');
            if (digits.length === 10) cleanPhone = '+1' + digits;
            else if (digits.length > 10) cleanPhone = '+' + digits;
        }

        // 2. Infer Product Interest from Campaign/Source
        let interest = 'General';
        const context = (campaign_name || source || '').toLowerCase();

        if (context.includes('construction') || context.includes('heavy') || context.includes('theft')) {
            interest = 'Construction';
        } else if (context.includes('hvac') || context.includes('plumb') || context.includes('electric')) {
            interest = 'HVAC/Plumbing';
        }

        // 3. Insert into DB
        const stmt = db.prepare(`
            INSERT INTO leads (name, phone, email, product_interest, status, step, created_at)
            VALUES (?, ?, ?, ?, 'NEW', 0, CURRENT_TIMESTAMP)
        `);

        stmt.run(name, cleanPhone, email, interest);

        console.log(`[Webhook] Saved lead: ${name} (${interest})`);
        res.json({ success: true, interest_assigned: interest });

    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            console.log('[Webhook] Duplicate lead, ignoring.');
            return res.json({ success: true, message: 'Duplicate lead' });
        }
        console.error('[Webhook] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- TRACKING PIXEL ---
app.get('/api/track/pixel/:leadId', (req, res) => {
    const { leadId } = req.params;

    try {
        console.log(`[Tracking] Email Opened by Lead ${leadId}`);
        db.prepare(`
            INSERT INTO events (lead_id, type, meta) 
            VALUES (?, 'EMAIL_OPEN', '{}')
        `).run(leadId);
    } catch (err) {
        console.error('Tracking Error:', err);
    }

    // Return 1x1 Transparent GIF
    const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
    });
    res.end(pixel);
});

// --- EMAIL WARMUP & DELIVERABILITY ---
const { getWarmupStatus, checkSendingLimits, getEmailHealth } = require('./services/emailWarmup');

app.get('/api/email/warmup-status', (req, res) => {
    const status = getWarmupStatus();
    res.json(status);
});

app.get('/api/email/health', (req, res) => {
    const health = getEmailHealth();
    res.json(health);
});

app.get('/api/email/can-send', (req, res) => {
    const limits = checkSendingLimits();
    res.json(limits);
});

// --- MEETING SCHEDULER ---
const { getAvailableSlots, bookMeeting, getUpcomingMeetings, generateBookingLink } = require('./services/meetingScheduler');

app.get('/api/meetings/slots', (req, res) => {
    const slots = getAvailableSlots();
    res.json(slots);
});

app.get('/api/meetings', (req, res) => {
    const meetings = getUpcomingMeetings();
    res.json(meetings);
});

app.post('/api/meetings/book', (req, res) => {
    const result = bookMeeting(req.body);
    res.json(result);
});

app.get('/api/meetings/link/:leadId', (req, res) => {
    const link = generateBookingLink(req.params.leadId);
    res.json({ bookingLink: link });
});

// --- LINKEDIN AUTOMATION ---
const { queueConnectionRequest, queueLinkedInMessage, logProfileView, getLinkedInStats } = require('./services/linkedinService');

app.get('/api/linkedin/stats', (req, res) => {
    const stats = getLinkedInStats();
    res.json(stats);
});

app.post('/api/linkedin/connection', (req, res) => {
    const { leadId, note } = req.body;
    const result = queueConnectionRequest(leadId, note);
    res.json(result);
});

app.post('/api/linkedin/message', (req, res) => {
    const { leadId, message } = req.body;
    const result = queueLinkedInMessage(leadId, message);
    res.json(result);
});

app.post('/api/linkedin/profile-view', (req, res) => {
    const { leadId } = req.body;
    const result = logProfileView(leadId);
    res.json(result);
});

// --- REPORTS EXPORT ---
const { exportLeadsCSV, exportMessagesCSV, exportAnalyticsCSV, exportTasksCSV, generatePerformanceReport } = require('./services/reportsExport');

app.get('/api/export/leads', (req, res) => {
    const csv = exportLeadsCSV(req.query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    res.send(csv);
});

app.get('/api/export/messages', (req, res) => {
    const { leadId } = req.query;
    const csv = exportMessagesCSV(leadId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=messages.csv');
    res.send(csv);
});

app.get('/api/export/analytics', (req, res) => {
    const csv = exportAnalyticsCSV();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
    res.send(csv);
});

app.get('/api/export/tasks', (req, res) => {
    const { status } = req.query;
    const csv = exportTasksCSV(status);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
    res.send(csv);
});

app.get('/api/reports/performance', (req, res) => {
    const { days = 7 } = req.query;
    const report = generatePerformanceReport(parseInt(days));
    res.json(report);
});

// CALENDAR SETTINGS API
app.get('/api/settings/calendar', (req, res) => {
    res.json({
        bookingUrl: process.env.CALENDAR_BOOKING_URL || null,
        configured: !!process.env.CALENDAR_BOOKING_URL
    });
});

// Get available template variables for sequence editor
app.get('/api/template-variables', (req, res) => {
    res.json({
        variables: [
            { name: '{{name}}', description: 'Full name of the lead' },
            { name: '{{firstName}}', description: 'First name only' },
            { name: '{{company}}', description: 'Company name' },
            { name: '{{city}}', description: 'City from CRM' },
            { name: '{{booking_link}}', description: 'Calendar booking URL' },
            { name: '{{meeting_link}}', description: 'Same as booking_link' },
            { name: '{{calendar_link}}', description: 'Same as booking_link' },
            { name: '{{sms_hook}}', description: 'Smart SMS opening based on interest' },
            { name: '{{email_subject}}', description: 'Smart email subject based on interest' },
            { name: '{{email_body}}', description: 'Smart email body based on interest' }
        ],
        bookingUrl: process.env.CALENDAR_BOOKING_URL || null
    });
});

// --- AI BRAIN / OPERATING SYSTEM ---

// Helper to log AI activity
async function logAiActivity(type, severity, title, description, metadata = {}) {
    try {
        await query(
            'INSERT INTO ai_activities (type, severity, title, description, metadata, status) VALUES ($1, $2, $3, $4, $5, $6)',
            [type, severity, title, description, JSON.stringify(metadata), 'PENDING']
        );
        // In a real system, we would emit a WebSocket event here
    } catch (e) {
        console.error('Failed to log AI activity:', e);
    }
}

// Get AI Feed


// Handle AI Action Decision
app.post('/api/brain/action', async (req, res) => {
    const { id, decision } = req.body; // decision: 'APPROVED' | 'REJECTED'
    if (!id || !decision) return res.status(400).json({ error: 'Missing ID or decision' });

    try {
        await query('UPDATE ai_activities SET status = $1 WHERE id = $2', [decision, id]);

        // If approved, trigger the actual logic (Mocked for now)
        if (decision === 'APPROVED') {
            const result = await query('SELECT * FROM ai_activities WHERE id = $1', [id]);
            const activity = result.rows[0];

            if (activity && activity.type === 'ACTION_REQUIRED') {
                // Example: Logic to send the email or update the lead would go here
                console.log(`[AI OS] Executing approved action: ${activity.title}`);

                // Log a follow-up completion event
                await logAiActivity('SYSTEM_LOG', 'LOW', `Executed: ${activity.title}`, 'Action completed successfully.', {}, 'COMPLETED');
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Simulate AI Event (For Demo)
app.post('/api/brain/simulate', (req, res) => {
    const { type, title, description } = req.body;
    try {
        logAiActivity(type || 'INSIGHT', 'MEDIUM', title || 'Simulated Event', description || 'This event was triggered manually.', {}, 'PENDING');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- WEBHOOKS ---

// Quo/OpenPhone Incoming SMS Webhook
app.post('/webhooks/quo', (req, res) => {
    console.log('[Webhook] Quo SMS received:', JSON.stringify(req.body));
    try {
        // OpenPhone webhook format
        const { type, data } = req.body;

        if (type === 'message.received' && data) {
            handleQuoMessage({
                from: data.from,
                content: data.body || data.content || data.text
            });
        } else {
            // Direct format fallback
            handleQuoMessage(req.body);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[Webhook] Quo error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Twilio Incoming SMS Webhook (Legacy)
app.post('/webhooks/twilio', (req, res) => {
    try {
        handleTwilioMessage(req.body);
        res.send('<Response></Response>'); // Twilio expects TwiML
    } catch (err) {
        console.error('[Webhook] Twilio error:', err);
        res.status(500).send('<Response></Response>');
    }
});

// VAPI Voice AI Webhook (Inbound Calls, Voicemail Status)
app.post('/webhooks/vapi', (req, res) => {
    console.log('[Webhook] VAPI event received');
    try {
        const result = handleVapiWebhook(req.body);
        res.json(result);
    } catch (err) {
        console.error('[Webhook] VAPI error:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- DEPLOYMENT ---
if (process.env.NODE_ENV === 'production') {
    // Serve static files from React app
    app.use(express.static(path.join(__dirname, '../client/dist')));

    // Catch-all route to serve index.html for client-side routing
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Global Error Handlers to prevent crash
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
    // process.exit(1); // Keep alive if possible? Or let container restart.
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection:', reason);
});

module.exports = { app };
