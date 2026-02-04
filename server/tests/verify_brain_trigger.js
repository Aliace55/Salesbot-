require('dotenv').config();
const { db } = require('../db');
const aiBrain = require('../services/aiBrain');

async function testBrainTrigger() {
    console.log('--- Starting AI Brain Verification ---');

    // 1. Setup: Create a Stale Lead
    console.log('1. Creating stale lead...');
    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - 20); // 20 days ago

    const result = db.prepare(`
        INSERT INTO leads (name, email, status, last_activity, last_contacted_at, funnel_stage)
        VALUES ('Test Stale Lead', 'stale@test.com', 'ACTIVE', ?, ?, 'LEAD')
    `).run(staleDate.toISOString(), staleDate.toISOString());

    const leadId = result.lastInsertRowid;
    console.log(`   Created Lead ID: ${leadId}`);

    // 2. Trigger Brain
    console.log('2. Forcing Brain Monitoring Cycle...');
    await aiBrain.runMonitoringCycle();

    // 3. Verify
    console.log('3. Verifying Activity Log...');
    const activity = db.prepare(`
        SELECT * FROM ai_activities 
        WHERE type = 'ACTION_REQUIRED' 
        AND metadata LIKE ?
    `).get(`%${leadId}%`);

    if (activity) {
        console.log('✅ PASS: Brain detected stale lead and logged activity.');
        console.log(`   Activity: ${activity.title}`);
        console.log(`   Description: ${activity.description}`);

        // Clean up
        db.prepare('DELETE FROM leads WHERE id = ?').run(leadId);
        db.prepare('DELETE FROM ai_activities WHERE id = ?').run(activity.id);
    } else {
        console.error('❌ FAIL: No activity found for stale lead.');
        process.exit(1);
    }

    console.log('--- Verification Complete ---');
}

testBrainTrigger();
