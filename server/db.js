const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('sales_platform.db');

// Initialize DB Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT UNIQUE,
    email TEXT,
    product_interest TEXT,
    source TEXT,
    campaign TEXT,
    status TEXT DEFAULT 'NEW', -- NEW, ACTIVE, MANUAL_TASK_DUE, COMPLETED, OPTED_OUT
    step INTEGER DEFAULT 0,
    last_contacted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    type TEXT, -- SMS, EMAIL, CALL, LINKEDIN
    direction TEXT, -- INBOUND, OUTBOUND
    content TEXT,
    variant TEXT, -- A, B, C (for A/B testing)
    classification TEXT, -- INTERESTED, NOT_INTERESTED, OOO, MEETING_REQUEST, UNSUBSCRIBE
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    type TEXT, -- EMAIL_OPEN, LINK_CLICK, REPLY, OPT_OUT
    step_id INTEGER,
    meta TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- INSIGHT, ACTION_REQUIRED, SYSTEM_LOG, DECISION
    severity TEXT DEFAULT 'LOW',
    title TEXT NOT NULL,
    description TEXT,
    metadata TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER,
    type TEXT, -- CALL, LINKEDIN, EMAIL_MANUAL, FOLLOW_UP
    title TEXT,
    description TEXT,
    due_date DATETIME,
    status TEXT DEFAULT 'PENDING', -- PENDING, COMPLETED, SKIPPED
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ab_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    step_id INTEGER,
    lead_id INTEGER,
    variant TEXT, -- A, B, C
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    lead_type TEXT NOT NULL DEFAULT 'OUTBOUND', -- INBOUND or OUTBOUND
    description TEXT,
    steps TEXT, -- JSON array of sequence steps
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Add existing upgrade columns
try { db.exec(`ALTER TABLE messages ADD COLUMN variant TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE messages ADD COLUMN classification TEXT`); } catch (e) { }
try { db.exec(`ALTER TABLE events ADD COLUMN step_id INTEGER`); } catch (e) { }

// === CRM FIELDS UPGRADE ===
// Add new CRM columns to leads table for full contact management

const crmColumns = [
  { name: 'first_name', type: 'TEXT' },
  { name: 'last_name', type: 'TEXT' },
  { name: 'job_title', type: 'TEXT' },
  { name: 'company', type: 'TEXT' },
  { name: 'website', type: 'TEXT' },
  { name: 'street_address', type: 'TEXT' },
  { name: 'city', type: 'TEXT' },
  { name: 'state', type: 'TEXT' },
  { name: 'zip_code', type: 'TEXT' },
  { name: 'country', type: 'TEXT' },
  { name: 'linkedin_url', type: 'TEXT' },
  { name: 'job_function', type: 'TEXT' },
  { name: 'department', type: 'TEXT' },
  { name: 'email_domain', type: 'TEXT' },
  { name: 'notes', type: 'TEXT' },
  { name: 'tags', type: 'TEXT' },
  { name: 'owner', type: 'TEXT' },
  { name: 'score', type: 'INTEGER DEFAULT 0' },
  { name: 'last_activity', type: 'DATETIME' },
  { name: 'company_size', type: 'TEXT' },
  { name: 'industry', type: 'TEXT' },
  { name: 'revenue', type: 'TEXT' },
  { name: 'timezone', type: 'TEXT' },
  { name: 'company_id', type: 'INTEGER REFERENCES companies(id)' },
  // Funnel Stage columns
  { name: 'funnel_stage', type: "TEXT DEFAULT 'LEAD'" },
  { name: 'stage_changed_at', type: 'DATETIME' },
  { name: 'ai_confidence', type: 'INTEGER' },
  { name: 'stage_locked', type: 'INTEGER DEFAULT 0' },
  { name: 'last_ai_reason', type: 'TEXT' },
  // Lead Type columns (Inbound vs Outbound)
  { name: 'lead_type', type: "TEXT DEFAULT 'OUTBOUND'" }, // INBOUND or OUTBOUND
  { name: 'lead_source', type: 'TEXT' }, // google, facebook, website, cold_email, linkedin, etc.
  { name: 'is_hot', type: 'INTEGER DEFAULT 0' } // Priority flag for hot leads
];

crmColumns.forEach(col => {
  try {
    db.exec(`ALTER TABLE leads ADD COLUMN ${col.name} ${col.type}`);
    console.log(`Added column: ${col.name}`);
  } catch (e) {
    // Column already exists
  }
});

// Stage history table for tracking all stage changes
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stage_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      from_stage TEXT,
      to_stage TEXT,
      changed_by TEXT, -- 'AI' or 'MANUAL'
      confidence INTEGER,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch (e) { }

// Helper function to get or create company from email domain
function getOrCreateCompany(email, companyName = null) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();

  // Skip common email providers
  const commonProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'];
  if (commonProviders.includes(domain)) return null;

  // Check if company exists
  let company = db.prepare('SELECT * FROM companies WHERE domain = ?').get(domain);

  if (!company) {
    // Create new company
    const name = companyName || domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    const result = db.prepare(`
      INSERT INTO companies (domain, name, website) VALUES (?, ?, ?)
    `).run(domain, name, `https://${domain}`);

    company = db.prepare('SELECT * FROM companies WHERE id = ?').get(result.lastInsertRowid);
    console.log(`Created company: ${name} (${domain})`);
  }

  return company;
}

// Migrate existing leads to companies
function migrateLeadsToCompanies() {
  const leads = db.prepare('SELECT id, email, company, email_domain FROM leads WHERE company_id IS NULL AND email IS NOT NULL').all();

  let migrated = 0;
  for (const lead of leads) {
    const company = getOrCreateCompany(lead.email, lead.company);
    if (company) {
      db.prepare('UPDATE leads SET company_id = ?, email_domain = ? WHERE id = ?')
        .run(company.id, lead.email?.split('@')[1], lead.id);
      migrated++;
    }
  }

  if (migrated > 0) {
    console.log(`Migrated ${migrated} leads to companies`);
  }
}

// Run migration on startup
migrateLeadsToCompanies();

module.exports = { db, getOrCreateCompany };

