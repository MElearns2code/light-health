import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customer_id, flag_id, action_text, logged_by, check_back_date } = body;

  if (!customer_id || !action_text) {
    return NextResponse.json({ error: 'customer_id and action_text are required' }, { status: 400 });
  }

  const db = getDb();
  const snoozeUntil = check_back_date
    ? new Date(check_back_date + 'T23:59:59').toISOString()
    : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const result = db.prepare(`
    INSERT INTO action_logs (customer_id, flag_id, action_text, logged_by, snooze_until)
    VALUES (?, ?, ?, ?, ?)
  `).run(customer_id, flag_id ?? null, action_text, logged_by ?? 'CSM', snoozeUntil);

  return NextResponse.json({ id: result.lastInsertRowid, snooze_until: snoozeUntil });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { action_log_id, outcome } = body;

  if (!action_log_id || !outcome) {
    return NextResponse.json({ error: 'action_log_id and outcome required' }, { status: 400 });
  }

  const db = getDb();
  db.prepare('UPDATE action_logs SET outcome = ? WHERE id = ?').run(outcome, action_log_id);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const db = getDb();
  const logs = db.prepare(`
    SELECT al.*, c.company_name
    FROM action_logs al
    JOIN customers c ON c.id = al.customer_id
    ORDER BY al.created_at DESC
    LIMIT 50
  `).all();
  return NextResponse.json(logs);
}
