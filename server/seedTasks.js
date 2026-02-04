const { db } = require('./db');

try {
    console.log('Seeding Tasks...');

    // Ensure we have at least 4 leads
    const count = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
    if (count < 4) {
        console.log('Not enough leads. Inserting dummies.');
        const insert = db.prepare('INSERT INTO leads (name, phone, status, step) VALUES (?, ?, ?, ?)');
        insert.run('Task Tester 1', '+15550000001', 'NEW', 0);
        insert.run('Task Tester 2', '+15550000002', 'NEW', 0);
        insert.run('Task Tester 3', '+15550000003', 'NEW', 0);
        insert.run('Task Tester 4', '+15550000004', 'NEW', 0);
    }

    // Set 2 leads to Step 3 (LinkedIn) and Manual Task Status
    db.prepare(`
        UPDATE leads 
        SET status = 'MANUAL_TASK_DUE', step = 3 
        WHERE id IN (SELECT id FROM leads LIMIT 2)
    `).run();

    // Set 2 leads to Step 4 (Call) 
    db.prepare(`
        UPDATE leads 
        SET status = 'MANUAL_TASK_DUE', step = 4
        WHERE id IN (SELECT id FROM leads LIMIT 2 OFFSET 2)
    `).run();

    console.log('Success: Updated leads to MANUAL_TASK_DUE.');
} catch (err) {
    console.error('Seed Error:', err);
}
