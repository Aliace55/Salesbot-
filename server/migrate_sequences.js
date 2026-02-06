const fs = require('fs');
const path = require('path');
const { query, pool } = require('./db');
const SEQUENCE_FILE = path.join(__dirname, 'sequence.json');

async function migrate() {
    console.log('Starting Sequence Migration...');

    try {
        // 1. Read existing file
        if (!fs.existsSync(SEQUENCE_FILE)) {
            console.log('No sequence.json found. Skipping.');
            return;
        }

        const data = fs.readFileSync(SEQUENCE_FILE, 'utf8');
        const steps = JSON.parse(data);

        if (!Array.isArray(steps)) {
            console.log('Invalid sequence.json format.');
            return;
        }

        console.log(`Found ${steps.length} steps in sequence.json`);

        // 2. Check if DB has sequences
        const existing = await query('SELECT count(*) FROM sequences');
        if (parseInt(existing.rows[0].count) > 0) {
            console.log('Sequences table already has data. Skipping migration to avoid duplicates.');
            process.exit(0);
        }

        // 3. Insert as Default Outbound Sequence
        await query(`
            INSERT INTO sequences (name, lead_type, description, steps, is_active)
            VALUES ($1, $2, $3, $4, 1)
        `, [
            'Master Outbound Sequence',
            'OUTBOUND',
            'Migrated from legacy JSON file',
            JSON.stringify(steps)
        ]);

        console.log('Migration Complete: Sequence imported to DB.');

    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
