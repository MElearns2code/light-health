import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { Customer } from '@/lib/types';

function parseCustomer(row: Record<string, unknown>): Customer {
  return {
    ...row,
    key_stakeholders: JSON.parse(row.key_stakeholders as string),
    modules_in_use: JSON.parse(row.modules_in_use as string),
  } as Customer;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const profile = db.prepare('SELECT * FROM profiles WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(id);
  const flags = db.prepare('SELECT * FROM flags WHERE customer_id = ? AND is_active = 1 ORDER BY flag_type DESC').all(id);

  return NextResponse.json({ customer: parseCustomer(customer), profile, flags });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();

  db.prepare('UPDATE customers SET csm_owner = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(body.csm_owner, id);

  return NextResponse.json({ ok: true });
}
