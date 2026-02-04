const dotenv = require('dotenv');
const path = require('path');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { db } = require('./db'); // Import DB
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
    aiBrain.logActivity(type, severity, title, description, metadata);
}

// Get AI Feed
app.get('/api/brain/feed', (req, res) => {
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS ai_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            severity TEXT DEFAULT 'LOW',
            title TEXT NOT NULL,
            description TEXT,
            metadata TEXT,
            status TEXT DEFAULT 'PENDING',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        const activities = db.prepare('SELECT * FROM ai_activities ORDER BY created_at DESC LIMIT 50').all();
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
        res.status(500).json({ error: err.message });
    }
});

// Handle AI Action Decision
app.post('/api/brain/action', async (req, res) => {
    const { id, decision } = req.body; // decision: 'APPROVED' | 'REJECTED'
    if (!id || !decision) return res.status(400).json({ error: 'Missing ID or decision' });

    try {
        db.prepare('UPDATE ai_activities SET status = ? WHERE id = ?').run(decision, id);

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
        await runSequence();
        res.json({ success: true, message: 'Sequence run complete' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Get Sequence Config (from JSON)
const { getSequence, SEQUENCE_FILE } = require('./services/sequenceEngine');
const fs = require('fs');

app.get('/api/sequence', (req, res) => {
    res.json(getSequence());
});

app.post('/api/sequence', (req, res) => {
    try {
        const newSequence = req.body; // Array of steps
        if (!Array.isArray(newSequence)) throw new Error('Invalid Format');

        fs.writeFileSync(SEQUENCE_FILE, JSON.stringify(newSequence, null, 2));
        res.json({ success: true, sequence: newSequence });
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
app.get('/api/leads/:id/conversation', (req, res) => {
    try {
        const leadId = req.params.id;
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const history = conversationMemory.getFullConversationHistory(leadId);
        const context = conversationMemory.buildContextForAI(leadId);
        const extractedDetails = detailExtractor.getExtractedDetails(leadId);

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
app.post('/api/leads/:id/advance', (req, res) => {
    try {
        const leadId = req.params.id;
        const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);

        if (lead) {
            // Log the 'Done' task
            const { getSequence } = require('./services/sequenceEngine'); // Lazy load
            const steps = getSequence();
            const currentStep = steps.find(s => s.id === lead.step); // Note: lead.step is next step or current? 
            // In sequenceEngine: "UPDATE leads SET step = nextStepNum... status = 'MANUAL_TASK_DUE'"
            // So lead.step IS the manual step that is due.

            if (currentStep) {
                console.log(`Logging Manual Completion: ${currentStep.type}`);
                db.prepare(`
                  INSERT INTO messages (lead_id, type, direction, content)
                  VALUES (?, ?, 'OUTBOUND', ?)
                `).run(lead.id, currentStep.type, `Manual Task Completed: ${currentStep.description || 'No desc'}`);
            }

            // set status to ACTIVE so it gets picked up for next step
            db.prepare("UPDATE leads SET status = 'ACTIVE', last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?").run(leadId);
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
app.post('/api/leads', (req, res) => {
    try {
        const { name, phone, email, product_interest, source, company, campaign, lead_type, lead_source } = req.body;

        if (!phone && !email) {
            return res.status(400).json({ error: 'Phone or email is required' });
        }

        // Normalize phone
        let cleanPhone = null;
        if (phone) {
            const digits = phone.toString().replace(/\D/g, '');
            if (digits.length === 10) cleanPhone = '+1' + digits;
            else if (digits.length > 10) cleanPhone = '+' + digits;
            else cleanPhone = phone;
        }

        // Auto-detect lead type if not provided
        const leadTypeDetector = require('./services/leadTypeDetector');
        const detected = leadTypeDetector.detectLeadType(source, campaign);

        const finalLeadType = lead_type || detected.leadType;
        const finalLeadSource = lead_source || detected.leadSource;
        const isHot = finalLeadType === 'INBOUND' ? 1 : 0;

        const result = db.prepare(`
            INSERT INTO leads (name, phone, email, product_interest, source, company, campaign, status, step, lead_type, lead_source, is_hot, funnel_stage)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', 0, ?, ?, ?, 'LEAD')
        `).run(name || 'Unknown', cleanPhone, email || null, product_interest || null, source || 'Manual', company || null, campaign || null, finalLeadType, finalLeadSource, isHot);

        res.json({ success: true, leadId: result.lastInsertRowid, leadType: finalLeadType, leadSource: finalLeadSource });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete Lead
app.delete('/api/leads/:id', (req, res) => {
    try {
        const leadId = req.params.id;

        // Delete related records first
        db.prepare('DELETE FROM messages WHERE lead_id = ?').run(leadId);
        db.prepare('DELETE FROM events WHERE lead_id = ?').run(leadId);
        db.prepare('DELETE FROM tasks WHERE lead_id = ?').run(leadId);

        const result = db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);

        if (result.changes > 0) {
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
app.put('/api/contacts/:id', (req, res) => {
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

        for (const [key, value] of Object.entries(fields)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(leadId);
        const sql = `UPDATE leads SET ${updates.join(', ')}, last_activity = CURRENT_TIMESTAMP WHERE id = ?`;

        const result = db.prepare(sql).run(...values);

        if (result.changes > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Contact not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === CSV IMPORT ===
app.post('/api/import/csv', (req, res) => {
    try {
        const { contacts } = req.body;

        if (!Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ error: 'No contacts provided' });
        }

        let imported = 0;
        let skipped = 0;
        let errors = [];

        const insertStmt = db.prepare(`
            INSERT OR IGNORE INTO leads (
                name, first_name, last_name, email, phone, job_title, company, website,
                street_address, city, state, zip_code, country, linkedin_url, 
                job_function, department, email_domain, source, status, step
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0)
        `);

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

                const result = insertStmt.run(
                    name, firstName, lastName, email || null, cleanPhone,
                    jobTitle, company, website, street, city, state, zip, country,
                    linkedin, jobFunction, department, emailDomain, 'CSV Import'
                );

                if (result.changes > 0) imported++;
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
app.get('/api/funnel/stats', (req, res) => {
    try {
        const leads = db.prepare('SELECT * FROM leads').all();
        const stats = funnelAI.getFunnelStats(leads);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get leads by funnel stage
app.get('/api/funnel/leads', (req, res) => {
    try {
        const { stage } = req.query;
        let query = `
            SELECT l.*, 
                (SELECT COUNT(*) FROM messages WHERE lead_id = l.id) as message_count,
                (SELECT MAX(created_at) FROM messages WHERE lead_id = l.id) as last_message_at
            FROM leads l
        `;

        if (stage && stage !== 'all') {
            query += ` WHERE COALESCE(l.funnel_stage, 'LEAD') = ?`;
        }

        query += ` ORDER BY l.stage_changed_at DESC, l.created_at DESC`;

        const leads = stage && stage !== 'all'
            ? db.prepare(query).all(stage)
            : db.prepare(query).all();

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
app.put('/api/leads/:id/stage', (req, res) => {
    try {
        const { id } = req.params;
        const { stage, lock = false } = req.body;

        if (!funnelAI.FUNNEL_STAGES.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const fromStage = lead.funnel_stage || 'LEAD';

        // Update lead
        db.prepare(`
            UPDATE leads SET 
                funnel_stage = ?, 
                stage_changed_at = CURRENT_TIMESTAMP,
                stage_locked = ?,
                ai_confidence = NULL,
                last_ai_reason = NULL
            WHERE id = ?
        `).run(stage, lock ? 1 : 0, id);

        // Log to history
        db.prepare(`
            INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_by, reason)
            VALUES (?, ?, ?, 'MANUAL', 'User manually changed stage')
        `).run(id, fromStage, stage);

        res.json({ success: true, fromStage, toStage: stage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Lock/unlock stage for AI changes
app.put('/api/leads/:id/lock-stage', (req, res) => {
    try {
        const { id } = req.params;
        const { locked } = req.body;

        db.prepare('UPDATE leads SET stage_locked = ? WHERE id = ?').run(locked ? 1 : 0, id);
        res.json({ success: true, locked });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get stage history for a lead
app.get('/api/leads/:id/stage-history', (req, res) => {
    try {
        const { id } = req.params;
        const history = db.prepare(`
            SELECT * FROM stage_history WHERE lead_id = ? ORDER BY created_at DESC
        `).all(id);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// AI analyze and suggest next stage (without applying)
app.post('/api/leads/:id/analyze-stage', (req, res) => {
    try {
        const { id } = req.params;
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);

        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        // Get latest message
        const latestMessage = db.prepare(`
            SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at DESC LIMIT 1
        `).get(id);

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
app.post('/api/leads/:id/apply-ai-stage', (req, res) => {
    try {
        const { id } = req.params;
        const { newStage, confidence, reason } = req.body;

        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
        if (!lead) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        if (lead.stage_locked) {
            return res.status(400).json({ error: 'Stage is locked' });
        }

        const fromStage = lead.funnel_stage || 'LEAD';

        // Update lead
        db.prepare(`
            UPDATE leads SET 
                funnel_stage = ?,
                stage_changed_at = CURRENT_TIMESTAMP,
                ai_confidence = ?,
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
app.post('/api/funnel/batch-analyze', (req, res) => {
    try {
        const leads = db.prepare(`
            SELECT l.*, 
                (SELECT content FROM messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
                (SELECT direction FROM messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_direction
            FROM leads l 
            WHERE l.stage_locked = 0 AND COALESCE(l.funnel_stage, 'LEAD') NOT IN ('WON', 'LOST')
        `).all();

        let updated = 0;
        const changes = [];

        for (const lead of leads) {
            const message = lead.last_message_content ? { content: lead.last_message_content, direction: lead.last_message_direction } : null;
            const eventType = lead.last_message_direction === 'INBOUND' ? 'INBOUND_MESSAGE' : 'OUTBOUND_MESSAGE';

            const analysis = funnelAI.analyzeAndProgress(lead, message, eventType);

            if (analysis.shouldChange) {
                // Apply the change
                db.prepare(`
                    UPDATE leads SET 
                        funnel_stage = ?,
                        stage_changed_at = CURRENT_TIMESTAMP,
                        ai_confidence = ?,
                        last_ai_reason = ?
                    WHERE id = ?
                `).run(analysis.newStage, analysis.confidence, analysis.reason, lead.id);

                db.prepare(`
                    INSERT INTO stage_history (lead_id, from_stage, to_stage, changed_by, confidence, reason)
                    VALUES (?, ?, ?, 'AI', ?, ?)
                `).run(lead.id, analysis.fromStage, analysis.newStage, analysis.confidence, analysis.reason);

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
app.get('/api/companies', (req, res) => {
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
            conditions.push(`(c.name LIKE ? OR c.domain LIKE ?)`);
            params.push(`%${search}%`, `%${search}%`);
        }

        if (industry) {
            conditions.push(`c.industry LIKE ?`);
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

        const companies = db.prepare(sql).all(...params);
        res.json(companies);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Get single company with all leads
app.get('/api/companies/:id', (req, res) => {
    try {
        const companyId = req.params.id;

        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const leads = db.prepare(`
            SELECT * FROM leads 
            WHERE company_id = ? 
            ORDER BY last_activity DESC NULLS LAST, created_at DESC
        `).all(companyId);

        res.json({ ...company, leads });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Create company
app.post('/api/companies', (req, res) => {
    try {
        const { name, domain, industry, company_size, website, street_address, city, state, zip_code, country, phone, notes } = req.body;

        if (!name && !domain) {
            return res.status(400).json({ error: 'Name or domain is required' });
        }

        const result = db.prepare(`
            INSERT INTO companies (name, domain, industry, company_size, website, street_address, city, state, zip_code, country, phone, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
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
        );

        const newCompany = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, company: newCompany });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Update company
app.put('/api/companies/:id', (req, res) => {
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

        for (const [key, value] of Object.entries(fields)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = ?`);
                values.push(value);
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        values.push(companyId);
        const sql = `UPDATE companies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        const result = db.prepare(sql).run(...values);

        if (result.changes > 0) {
            const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
            res.json({ success: true, company });
        } else {
            res.status(404).json({ error: 'Company not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Delete company (and optionally its leads)
app.delete('/api/companies/:id', (req, res) => {
    try {
        const companyId = req.params.id;
        const { deleteLeads = false } = req.query;

        if (deleteLeads === 'true') {
            // Delete all leads under this company
            const leads = db.prepare('SELECT id FROM leads WHERE company_id = ?').all(companyId);
            for (const lead of leads) {
                db.prepare('DELETE FROM messages WHERE lead_id = ?').run(lead.id);
                db.prepare('DELETE FROM events WHERE lead_id = ?').run(lead.id);
                db.prepare('DELETE FROM tasks WHERE lead_id = ?').run(lead.id);
            }
            db.prepare('DELETE FROM leads WHERE company_id = ?').run(companyId);
        } else {
            // Just unlink leads from company
            db.prepare('UPDATE leads SET company_id = NULL WHERE company_id = ?').run(companyId);
        }

        const result = db.prepare('DELETE FROM companies WHERE id = ?').run(companyId);

        if (result.changes > 0) {
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
app.get('/api/companies/:id/leads', (req, res) => {
    try {
        const companyId = req.params.id;

        const leads = db.prepare(`
            SELECT l.*, 
                   (SELECT COUNT(*) FROM messages WHERE lead_id = l.id) as message_count,
                   (SELECT COUNT(*) FROM events WHERE lead_id = l.id) as event_count
            FROM leads l
            WHERE l.company_id = ?
            ORDER BY l.last_activity DESC NULLS LAST, l.created_at DESC
        `).all(companyId);

        res.json(leads);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// Add lead to company
app.post('/api/companies/:id/leads', (req, res) => {
    try {
        const companyId = req.params.id;
        const { name, email, phone, job_title, department, linkedin_url } = req.body;

        // Get company for domain
        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
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

        const result = db.prepare(`
            INSERT INTO leads (name, email, phone, job_title, department, linkedin_url, company_id, company, email_domain, status, step)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0)
        `).run(
            name || 'Unknown',
            email || null,
            cleanPhone,
            job_title || null,
            department || null,
            linkedin_url || null,
            companyId,
            company.name,
            company.domain
        );

        const newLead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
        res.json({ success: true, lead: newLead });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === ACTIVITY TIMELINE ===
app.get('/api/contacts/:id/activity', (req, res) => {
    try {
        const leadId = req.params.id;

        // Get messages
        const messages = db.prepare(`
            SELECT id, 'message' as activity_type, type, direction, content, 
                   classification, created_at
            FROM messages 
            WHERE lead_id = ?
        `).all(leadId);

        // Get events
        const events = db.prepare(`
            SELECT id, 'event' as activity_type, type, meta, created_at
            FROM events 
            WHERE lead_id = ?
        `).all(leadId);

        // Get tasks
        const tasks = db.prepare(`
            SELECT id, 'task' as activity_type, type, title, status, 
                   completed_at, created_at
            FROM tasks 
            WHERE lead_id = ?
        `).all(leadId);

        // Combine and sort by date
        const activities = [...messages, ...events, ...tasks]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json(activities);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === CONTACT NOTES ===
app.post('/api/contacts/:id/notes', (req, res) => {
    try {
        const leadId = req.params.id;
        const { note } = req.body;

        const lead = db.prepare('SELECT notes FROM leads WHERE id = ?').get(leadId);
        if (!lead) return res.status(404).json({ error: 'Contact not found' });

        const timestamp = new Date().toISOString();
        const newNote = `[${timestamp}] ${note}`;
        const updatedNotes = lead.notes ? `${newNote}\n---\n${lead.notes}` : newNote;

        db.prepare('UPDATE leads SET notes = ?, last_activity = CURRENT_TIMESTAMP WHERE id = ?')
            .run(updatedNotes, leadId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === TEAM STATS / LEADERBOARD ===
app.get('/api/team/stats', (req, res) => {
    try {
        // Group by owner
        const stats = db.prepare(`
            SELECT 
                COALESCE(owner, 'Unassigned') as rep_name,
                COUNT(*) as total_leads,
                SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'MANUAL_INTERVENTION' THEN 1 ELSE 0 END) as pending_replies,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active
            FROM leads
            GROUP BY owner
            ORDER BY completed DESC
        `).all();

        // Get message counts per owner
        const messageCounts = db.prepare(`
            SELECT 
                COALESCE(l.owner, 'Unassigned') as rep_name,
                COUNT(m.id) as messages_sent
            FROM leads l
            LEFT JOIN messages m ON l.id = m.lead_id AND m.direction = 'OUTBOUND'
            GROUP BY l.owner
        `).all();

        // Merge stats
        const merged = stats.map(s => {
            const mc = messageCounts.find(m => m.rep_name === s.rep_name);
            return { ...s, messages_sent: mc?.messages_sent || 0 };
        });

        res.json(merged);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === BEST TIME ANALYSIS ===
app.get('/api/analytics/best-times', (req, res) => {
    try {
        // Analyze when replies come in (hour of day)
        const hourlyReplies = db.prepare(`
            SELECT 
                CAST(strftime('%H', created_at) AS INTEGER) as hour,
                COUNT(*) as reply_count
            FROM messages
            WHERE direction = 'INBOUND'
            GROUP BY hour
            ORDER BY reply_count DESC
        `).all();

        // Analyze day of week
        const dailyReplies = db.prepare(`
            SELECT 
                CAST(strftime('%w', created_at) AS INTEGER) as day,
                COUNT(*) as reply_count
            FROM messages
            WHERE direction = 'INBOUND'
            GROUP BY day
            ORDER BY reply_count DESC
        `).all();

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        res.json({
            bestHours: hourlyReplies.slice(0, 5),
            bestDays: dailyReplies.map(d => ({ ...d, dayName: dayNames[d.day] })).slice(0, 3),
            recommendation: hourlyReplies.length > 0
                ? `Best time to send: ${hourlyReplies[0]?.hour}:00`
                : 'Not enough data yet'
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// === OPT-OUT DETECTION ===
app.post('/api/leads/:id/opt-out', (req, res) => {
    try {
        const leadId = req.params.id;

        db.prepare(`
            UPDATE leads 
            SET status = 'OPTED_OUT', last_activity = CURRENT_TIMESTAMP 
            WHERE id = ?
        `).run(leadId);

        // Log the opt-out event
        db.prepare(`
            INSERT INTO events (lead_id, type, meta, created_at)
            VALUES (?, 'OPT_OUT', 'Manual opt-out', CURRENT_TIMESTAMP)
        `).run(leadId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// --- TASK MANAGEMENT API ---

// Get All Tasks
app.get('/api/tasks', (req, res) => {
    try {
        const status = req.query.status || 'PENDING';
        const tasks = db.prepare(`
            SELECT t.*, l.name as lead_name, l.email as lead_email, l.phone as lead_phone
            FROM tasks t
            LEFT JOIN leads l ON t.lead_id = l.id
            WHERE t.status = ?
            ORDER BY t.due_date ASC
        `).all(status);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Complete Task
app.post('/api/tasks/:id/complete', (req, res) => {
    try {
        const taskId = req.params.id;
        db.prepare(`
            UPDATE tasks SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(taskId);

        // Also advance the lead
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (task) {
            db.prepare(`
                UPDATE leads SET status = 'ACTIVE', last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?
            `).run(task.lead_id);

            // Log the completion
            db.prepare(`
                INSERT INTO messages (lead_id, type, direction, content)
                VALUES (?, ?, 'OUTBOUND', ?)
            `).run(task.lead_id, task.type, `Task Completed: ${task.title}`);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Skip Task
app.post('/api/tasks/:id/skip', (req, res) => {
    try {
        const taskId = req.params.id;
        db.prepare(`UPDATE tasks SET status = 'SKIPPED' WHERE id = ?`).run(taskId);

        // Advance the lead anyway
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        if (task) {
            db.prepare(`UPDATE leads SET status = 'ACTIVE' WHERE id = ?`).run(task.lead_id);
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
            db.prepare(`UPDATE messages SET classification = ? WHERE id = ?`).run(result.classification, messageId);
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

app.post('/api/ai/save-sequence', (req, res) => {
    try {
        const { sequence, lead_type = 'OUTBOUND', name } = req.body;

        // If saving to database with lead_type
        if (name) {
            const existing = db.prepare('SELECT id FROM sequences WHERE name = ? AND lead_type = ?').get(name, lead_type);
            if (existing) {
                db.prepare('UPDATE sequences SET steps = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                    .run(JSON.stringify(sequence), existing.id);
                res.json({ success: true, id: existing.id });
            } else {
                const result = db.prepare(
                    'INSERT INTO sequences (name, lead_type, steps) VALUES (?, ?, ?)'
                ).run(name, lead_type, JSON.stringify(sequence));
                res.json({ success: true, id: result.lastInsertRowid });
            }
        } else {
            // Legacy file-based save
            const result = saveSequence(sequence);
            res.json(result);
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === SEQUENCE MANAGEMENT ===

// Get all sequences
app.get('/api/sequences', (req, res) => {
    try {
        const { lead_type } = req.query;
        let sequences;
        if (lead_type) {
            sequences = db.prepare('SELECT * FROM sequences WHERE lead_type = ? ORDER BY created_at DESC').all(lead_type);
        } else {
            sequences = db.prepare('SELECT * FROM sequences ORDER BY lead_type, created_at DESC').all();
        }
        // Parse steps JSON
        sequences = sequences.map(s => ({
            ...s,
            steps: s.steps ? JSON.parse(s.steps) : []
        }));
        res.json(sequences);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single sequence
app.get('/api/sequences/:id', (req, res) => {
    try {
        const seq = db.prepare('SELECT * FROM sequences WHERE id = ?').get(req.params.id);
        if (!seq) return res.status(404).json({ error: 'Sequence not found' });
        seq.steps = seq.steps ? JSON.parse(seq.steps) : [];
        res.json(seq);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create sequence
app.post('/api/sequences', (req, res) => {
    try {
        const { name, lead_type = 'OUTBOUND', description, steps = [] } = req.body;
        const result = db.prepare(
            'INSERT INTO sequences (name, lead_type, description, steps) VALUES (?, ?, ?, ?)'
        ).run(name, lead_type, description || null, JSON.stringify(steps));
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update sequence
app.put('/api/sequences/:id', (req, res) => {
    try {
        const { name, lead_type, description, steps, is_active } = req.body;
        const seq = db.prepare('SELECT * FROM sequences WHERE id = ?').get(req.params.id);
        if (!seq) return res.status(404).json({ error: 'Sequence not found' });

        db.prepare(`
            UPDATE sequences SET 
                name = COALESCE(?, name),
                lead_type = COALESCE(?, lead_type),
                description = COALESCE(?, description),
                steps = COALESCE(?, steps),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            name || null,
            lead_type || null,
            description || null,
            steps ? JSON.stringify(steps) : null,
            is_active ?? null,
            req.params.id
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete sequence
app.delete('/api/sequences/:id', (req, res) => {
    try {
        const result = db.prepare('DELETE FROM sequences WHERE id = ?').run(req.params.id);
        if (result.changes > 0) {
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
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.leadId);
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
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const draft = await autoDraftMessage(lead, channel, context);
        res.json({ draft });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CLIENT API ---

// Get All Leads
app.get('/api/leads', (req, res) => {
    try {
        const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
        res.json(leads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Messages for a Lead
app.get('/api/messages/:leadId', (req, res) => {
    try {
        const messages = db.prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC').all(req.params.leadId);
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Send Manual Message
app.post('/api/messages', async (req, res) => {
    const { leadId, content } = req.body;
    const { sendSMS } = require('./services/twilioHandler'); // Lazy load to ensure services are ready

    try {
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        console.log(`Sending manual SMS to ${lead.phone}: ${content}`);
        const result = await sendSMS(lead.phone, content);

        if (result.success) {
            // Log outgoing 
            db.prepare(`
        INSERT INTO messages (lead_id, type, direction, content)
        VALUES (?, 'MANUAL_SMS', 'OUTBOUND', ?)
      `).run(leadId, content);

            // Update last contact
            db.prepare("UPDATE leads SET last_contacted_at = CURRENT_TIMESTAMP WHERE id = ?").run(leadId);

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
app.get('/api/analytics', (req, res) => {
    try {
        const totalLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
        const activeLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status = 'ACTIVE'").get().count;
        const totalSent = db.prepare("SELECT COUNT(*) as count FROM messages WHERE direction = 'OUTBOUND'").get().count;
        const repliedCount = db.prepare("SELECT COUNT(DISTINCT lead_id) as count FROM messages WHERE direction = 'INBOUND'").get().count;

        // Granular Metrics
        let emailOpens = 0;
        try {
            emailOpens = db.prepare("SELECT COUNT(DISTINCT lead_id) as count FROM events WHERE type = 'EMAIL_OPEN'").get().count;
        } catch (e) {
            // events table might not exist yet if migration failed
            console.warn('Events table missing or empty');
        }

        // Source Breakdown
        const constructionLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE product_interest LIKE '%Construction%'").get().count;
        const hvacLeads = db.prepare("SELECT COUNT(*) as count FROM leads WHERE product_interest LIKE '%HVAC%'").get().count;

        const responseRate = totalLeads > 0 ? ((repliedCount / totalLeads) * 100).toFixed(1) : 0;

        // Channel Breakdown
        const channels = {
            EMAIL: { sent: 0, replies: 0, opens: 0 },
            SMS: { sent: 0, replies: 0 },
            CALL: { completed: 0 },
            LINKEDIN: { completed: 0 }
        };

        const msgStats = db.prepare(`
            SELECT type, direction, COUNT(*) as count 
            FROM messages 
            GROUP BY type, direction
        `).all();

        msgStats.forEach(stat => {
            const type = stat.type; // SMS, EMAIL, CALL, LINKEDIN
            if (channels[type]) {
                if (stat.direction === 'OUTBOUND') {
                    if (type === 'CALL' || type === 'LINKEDIN') channels[type].completed += stat.count;
                    else channels[type].sent += stat.count;
                } else if (stat.direction === 'INBOUND') {
                    if (channels[type]) channels[type].replies += stat.count;
                }
            }
        });

        // Email Opens
        channels.EMAIL.opens = emailOpens;

        // Channel breakdown by lead type (INBOUND vs OUTBOUND)
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

        // Populate channel by type (requires joining tables, approximate for now)
        // ... (existing logic omitted for brevity, assuming standard query)

        // --- INTENT SCORING ---
        const leads = db.prepare('SELECT id, name, company, status, buying_signals, created_at FROM leads').all();

        const scoredLeads = leads.map(lead => {
            let score = 0;
            const signals = lead.buying_signals ? lead.buying_signals.split(',').length : 0;

            // Scoring Rules
            if (lead.status === 'MEETING_BOOKED') score += 50;
            if (lead.status === 'MEETING_REQUEST') score += 40;
            if (lead.status === 'INTERESTED') score += 20;
            score += (signals * 5); // 5 points per signal

            // Check interaction history (simplified)
            const replyCount = db.prepare("SELECT COUNT(*) as count FROM messages WHERE lead_id = ? AND direction = 'INBOUND'").get(lead.id).count;
            score += (replyCount * 5);

            const clickCount = db.prepare("SELECT COUNT(*) as count FROM events WHERE lead_id = ? AND type = 'LINK_CLICK'").get(lead.id).count;
            score += (clickCount * 3);

            const openCount = db.prepare("SELECT COUNT(*) as count FROM events WHERE lead_id = ? AND type = 'EMAIL_OPEN'").get(lead.id).count;
            score += (openCount * 1);

            return { ...lead, score, signalCount: signals };
        }).sort((a, b) => b.score - a.score);

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
        const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
        if (!lead) return res.status(404).json({ error: 'Lead not found' });

        const history = db.prepare('SELECT * FROM messages WHERE lead_id = ? ORDER BY created_at ASC').all(leadId);

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
function logAiActivity(type, severity, title, description, metadata = {}) {
    try {
        const stmt = db.prepare('INSERT INTO ai_activities (type, severity, title, description, metadata, status) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(type, severity, title, description, JSON.stringify(metadata), 'PENDING');
        // In a real system, we would emit a WebSocket event here
    } catch (e) {
        console.error('Failed to log AI activity:', e);
    }
}

// Get AI Feed


// Handle AI Action Decision
app.post('/api/brain/action', (req, res) => {
    const { id, decision } = req.body; // decision: 'APPROVED' | 'REJECTED'
    if (!id || !decision) return res.status(400).json({ error: 'Missing ID or decision' });

    try {
        db.prepare('UPDATE ai_activities SET status = ? WHERE id = ?').run(decision, id);

        // If approved, trigger the actual logic (Mocked for now)
        if (decision === 'APPROVED') {
            const activity = db.prepare('SELECT * FROM ai_activities WHERE id = ?').get(id);
            if (activity && activity.type === 'ACTION_REQUIRED') {
                // Example: Logic to send the email or update the lead would go here
                console.log(`[AI OS] Executing approved action: ${activity.title}`);

                // Log a follow-up completion event
                logAiActivity('SYSTEM_LOG', 'LOW', `Executed: ${activity.title}`, 'Action completed successfully.', {}, 'COMPLETED');
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
    app.get('/{*path}', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = { app };
