const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// PostgreSQL Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Helper for single queries
const query = (text, params) => pool.query(text, params);

// Initialize DB Schema
const initDB = async () => {
  try {
    console.log('[DB] Connecting to PostgreSQL...');

    // Create Tables
    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        name TEXT,
        phone TEXT UNIQUE,
        email TEXT,
        product_interest TEXT,
        source TEXT,
        campaign TEXT,
        status TEXT DEFAULT 'NEW',
        step INTEGER DEFAULT 0,
        last_contacted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- CRM Fields
        first_name TEXT,
        last_name TEXT,
        job_title TEXT,
        company TEXT,
        website TEXT,
        street_address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT,
        linkedin_url TEXT,
        job_function TEXT,
        department TEXT,
        email_domain TEXT,
        notes TEXT,
        tags TEXT,
        owner TEXT,
        score INTEGER DEFAULT 0,
        last_activity TIMESTAMP,
        company_size TEXT,
        industry TEXT,
        revenue TEXT,
        timezone TEXT,
        company_id INTEGER,
        campaign_id INTEGER, -- Campaign FK
        funnel_stage TEXT DEFAULT 'LEAD',
        stage_changed_at TIMESTAMP,
        ai_confidence INTEGER,
        stage_locked INTEGER DEFAULT 0,
        last_ai_reason TEXT,
        lead_type TEXT DEFAULT 'OUTBOUND',
        lead_source TEXT,
        is_hot INTEGER DEFAULT 0,
        -- Google Sheets Sync
        sheet_row_id INTEGER,
        sheet_tab TEXT,
        last_synced_at TIMESTAMP,
        research_summary TEXT
      );
    `);

    // Add columns if they don't exist (Migration)
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS sheet_row_id INTEGER;`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS sheet_tab TEXT;`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS research_summary TEXT;`);
    await query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id INTEGER;`); // Add campaign_id migration

    await query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        type TEXT,
        direction TEXT,
        content TEXT,
        variant TEXT,
        classification TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        type TEXT,
        step_id INTEGER,
        meta TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ai_activities (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'LOW',
        title TEXT NOT NULL,
        description TEXT,
        metadata TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        type TEXT,
        title TEXT,
        description TEXT,
        due_date TIMESTAMP,
        status TEXT DEFAULT 'PENDING',
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS ab_tests (
        id SERIAL PRIMARY KEY,
        step_id INTEGER,
        lead_id INTEGER,
        variant TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        domain TEXT UNIQUE,
        name TEXT,
        industry TEXT,
        company_size TEXT,
        website TEXT,
        street_address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT,
        phone TEXT,
        notes TEXT,
        research_summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS research_summary TEXT;`);

    await query(`
      CREATE TABLE IF NOT EXISTS sequences (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        lead_type TEXT DEFAULT 'OUTBOUND',
        description TEXT,
        steps JSONB DEFAULT '[]',
        stats JSONB DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Migration for Sequences
    await query(`ALTER TABLE sequences ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}';`);
    // Note: If steps was TEXT, we might need a migration, but for now we assume fresh or empty.
    // await query(`ALTER TABLE sequences ALTER COLUMN steps TYPE JSONB USING steps::jsonb;`);

    await query(`
      CREATE TABLE IF NOT EXISTS stage_history (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER,
        from_stage TEXT,
        to_stage TEXT,
        changed_by TEXT,
        confidence INTEGER,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[DB] Schema initialized successfully');
  } catch (err) {
    console.error('[DB] Initialization Error:', err);
  }
};

// Helper function to get or create company from email domain
async function getOrCreateCompany(email, companyName = null) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();
  const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'];
  if (commonProviders.includes(domain)) return null;

  try {
    // Check if company exists
    const res = await query('SELECT * FROM companies WHERE domain = $1', [domain]);
    let company = res.rows[0];

    if (!company) {
      // Create new company
      const name = companyName || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      const insertRes = await query(
        'INSERT INTO companies (domain, name, website) VALUES ($1, $2, $3) RETURNING *',
        [domain, name, `https://${domain}`]
      );
      company = insertRes.rows[0];
      console.log(`Created company: ${name} (${domain})`);
    }
    return company;
  } catch (err) {
    console.error('Error in getOrCreateCompany:', err);
    return null;
  }
}

// Run migration on startup
initDB();

module.exports = {
  query,
  pool,
  getOrCreateCompany
};
