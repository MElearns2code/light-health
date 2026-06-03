import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'light.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  migrateSchema(_db);
  return _db;
}

function migrateSchema(db: Database.Database) {
  const customerCols = (db.prepare("PRAGMA table_info(customers)").all() as { name: string }[]).map(c => c.name);
  if (!customerCols.includes('website')) {
    db.exec("ALTER TABLE customers ADD COLUMN website TEXT");
  }

  const actionCols = (db.prepare("PRAGMA table_info(action_logs)").all() as { name: string }[]).map(c => c.name);
  if (!actionCols.includes('owner'))    db.exec("ALTER TABLE action_logs ADD COLUMN owner TEXT");
  if (!actionCols.includes('due_date')) db.exec("ALTER TABLE action_logs ADD COLUMN due_date TEXT");
  if (!actionCols.includes('outcome'))  db.exec("ALTER TABLE action_logs ADD COLUMN outcome TEXT");
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      website TEXT,
      industry TEXT NOT NULL,
      company_size INTEGER NOT NULL,
      key_stakeholders TEXT NOT NULL,
      modules_in_use TEXT NOT NULL,
      contract_value REAL NOT NULL,
      renewal_date TEXT NOT NULL,
      onboarding_milestone_status TEXT NOT NULL,
      monthly_invoice_volume INTEGER NOT NULL,
      last_exec_contact_date TEXT NOT NULL,
      csm_owner TEXT NOT NULL DEFAULT 'Unassigned',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      ai_draft TEXT NOT NULL,
      csm_validated TEXT,
      validated_at TEXT,
      validated_by TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS flags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      flag_type TEXT NOT NULL CHECK(flag_type IN ('green','amber','red')),
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK(confidence IN ('low','medium','high')),
      owner TEXT NOT NULL,
      suggested_action TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      snoozed_until TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS action_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      flag_id INTEGER REFERENCES flags(id),
      action_text TEXT NOT NULL,
      logged_by TEXT NOT NULL,
      snooze_until TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}
