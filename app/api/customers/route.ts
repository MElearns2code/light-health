import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Customer } from '@/lib/types';

function parseCustomer(row: Record<string, unknown>): Customer {
  return {
    ...row,
    key_stakeholders: JSON.parse(row.key_stakeholders as string),
    modules_in_use: JSON.parse(row.modules_in_use as string),
  } as Customer;
}

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT c.*,
      p.id as profile_id,
      p.csm_validated IS NOT NULL as profile_validated
    FROM customers c
    LEFT JOIN profiles p ON p.customer_id = c.id
    ORDER BY c.renewal_date ASC
  `).all() as Record<string, unknown>[];

  return NextResponse.json(rows.map(parseCustomer));
}

export async function DELETE() {
  const db = getDb();
  db.prepare('DELETE FROM action_logs').run();
  db.prepare('DELETE FROM flags').run();
  db.prepare('DELETE FROM profiles').run();
  db.prepare('DELETE FROM customers').run();
  return NextResponse.json({ ok: true });
}
