/**
 * Test Conversational Memory System
 */
require('dotenv').config();

const conversationMemory = require('./services/conversationMemory');
const detailExtractor = require('./services/detailExtractor');
const { db } = require('./db');

async function test() {
    console.log('Testing Conversational Memory System...\n');

    // Get a sample lead
    const lead = db.prepare('SELECT * FROM leads LIMIT 1').get();

    if (!lead) {
        console.log('No leads found. Creating test data...');

        // Create a test lead
        const result = db.prepare(`
            INSERT INTO leads (name, phone, email, company, status, step)
            VALUES ('Test Lead', '+16305551234', 'test@example.com', 'Test Company', 'ACTIVE', 1)
        `).run();

        const testLeadId = result.lastInsertRowid;

        // Add some test messages
        db.prepare(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES (?, 'EMAIL', 'OUTBOUND', 'Hi! Are you currently tracking your fleet vehicles?')
        `).run(testLeadId);

        db.prepare(`
            INSERT INTO messages (lead_id, type, direction, content)
            VALUES (?, 'EMAIL', 'INBOUND', 'Yes, we have 40 trucks and currently use Samsara but the pricing is too high.')
        `).run(testLeadId);

        console.log('Test data created. Lead ID:', testLeadId);

        // Test extraction
        console.log('\n--- Testing Detail Extraction ---');
        const extractResult = await detailExtractor.processIncomingMessage(
            testLeadId,
            'Yes, we have 40 trucks and currently use Samsara but the pricing is too high.'
        );
        console.log('Extraction result:', extractResult);

        // Get extracted details
        const details = detailExtractor.getExtractedDetails(testLeadId);
        console.log('\nExtracted Details:', details);

        // Test context building
        console.log('\n--- Testing Context Building ---');
        const context = conversationMemory.buildContextForAI(testLeadId);
        console.log('Context object:', JSON.stringify(context, null, 2));

        // Test prompt generation
        console.log('\n--- Testing Prompt Generation ---');
        const prompt = conversationMemory.generateContextPrompt(testLeadId);
        console.log('Generated prompt:\n', prompt);

    } else {
        console.log('Using existing lead:', lead.name, '(ID:', lead.id, ')');

        // Test context building
        const context = conversationMemory.buildContextForAI(lead.id);
        console.log('\nContext:', JSON.stringify(context, null, 2));

        // Test history
        const history = conversationMemory.getFullConversationHistory(lead.id);
        console.log('\nConversation History:', history.length, 'messages');

        // Test details
        const details = detailExtractor.getExtractedDetails(lead.id);
        console.log('\nExtracted Details:', details);
    }

    console.log('\n✅ All tests passed!');
}

test().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
