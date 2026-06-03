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

// Validate and save the CSM-edited profile, then regenerate flags
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  const validated: AIProfile = body.profile;
  const validatedBy: string = body.validated_by ?? 'CSM';

  db.prepare(`
    UPDATE profiles
    SET csm_validated = ?, validated_at = datetime('now'), validated_by = ?
    WHERE customer_id = ?
  `).run(JSON.stringify(validated), validatedBy, id);

  // Regenerate flags from validated profile
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown>;
  const customer = parseCustomer(row);
  const flagInputs = generateFlags({ customer, profile: validated });

  db.prepare('DELETE FROM flags WHERE customer_id = ?').run(id);
  const insertFlag = db.prepare(`
    INSERT INTO flags (customer_id, flag_type, category, description, confidence, owner, suggested_action, is_active, snoozed_until)
    VALUES (@customer_id, @flag_type, @category, @description, @confidence, @owner, @suggested_action, @is_active, @snoozed_until)
  `);
  const insertAll = db.transaction(() => {
    for (const f of flagInputs) insertFlag.run(f);
  });
  insertAll();

  const profile = db.prepare('SELECT * FROM profiles WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(id);
  const flags = db.prepare('SELECT * FROM flags WHERE customer_id = ? AND is_active = 1').all(id);

  return NextResponse.json({ profile, flags });
}
