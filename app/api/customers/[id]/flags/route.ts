import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { generateFlags } from '@/lib/flags';
import { Customer, AIProfile } from '@/lib/types';

function parseCustomer(row: Record<string, unknown>): Customer {
  return {
    ...row,
    key_stakeholders: JSON.parse(row.key_stakeholders as string),
    modules_in_use: JSON.parse(row.modules_in_use as string),
  } as Customer;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const customer = parseCustomer(row);
  const profile: AIProfile = body.profile;

  const flagInputs = generateFlags({ customer, profile });
  db.prepare('DELETE FROM flags WHERE customer_id = ?').run(id);

  const insertFlag = db.prepare(`
    INSERT INTO flags (customer_id, flag_type, category, description, confidence, owner, suggested_action, is_active, snoozed_until)
    VALUES (@customer_id, @flag_type, @category, @description, @confidence, @owner, @suggested_action, @is_active, @snoozed_until)
  `);

  const insertAll = db.transaction(() => {
    for (const f of flagInputs) insertFlag.run(f);
  });
  insertAll();

  const flags = db.prepare('SELECT * FROM flags WHERE customer_id = ? AND is_active = 1').all(id);
  return NextResponse.json({ flags });
}
