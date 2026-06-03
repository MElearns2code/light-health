import { NextResponse, connection } from 'next/server';
import { getDb } from '@/lib/db';
import { generateDailyBriefing } from '@/lib/claude';
import { Customer, Flag } from '@/lib/types';
import { differenceInDays, parseISO } from 'date-fns';

function parseCustomer(row: Record<string, unknown>): Customer {
  return {
    ...row,
    key_stakeholders: JSON.parse(row.key_stakeholders as string),
    modules_in_use: JSON.parse(row.modules_in_use as string),
  } as Customer;
}

const FLAG_PRIORITY = { red: 3, amber: 2, green: 1 };

export async function GET() {
  await connection();
  const db = getDb();
  const today = new Date();

  const customers = (db.prepare('SELECT * FROM customers ORDER BY renewal_date ASC').all() as Record<string, unknown>[]).map(parseCustomer);

  if (!customers.length) return NextResponse.json({ items: [], generated_at: new Date().toISOString() });

  // Check for 48-hour snoozes
  const recentActions = db.prepare(`
    SELECT customer_id FROM action_logs
    WHERE snooze_until > datetime('now')
    GROUP BY customer_id
  `).all() as { customer_id: number }[];
  const snoozedIds = new Set(recentActions.map(a => a.customer_id));

  const scored: Array<{
    customer: Customer;
    flags: Flag[];
    top_flag: Flag;
    days_to_renewal: number;
    renewal_urgent: boolean;
    score: number;
  }> = [];

  for (const customer of customers) {
    const flags = db.prepare(`
      SELECT * FROM flags WHERE customer_id = ? AND is_active = 1
      AND (snoozed_until IS NULL OR snoozed_until < datetime('now'))
      ORDER BY flag_type DESC
    `).all(customer.id) as Flag[];

    if (!flags.length) continue;

    const daysToRenewal = differenceInDays(parseISO(customer.renewal_date), today);
    const renewalUrgent = daysToRenewal >= 0 && daysToRenewal <= 60;

    const topFlag = flags.sort((a, b) => FLAG_PRIORITY[b.flag_type] - FLAG_PRIORITY[a.flag_type])[0];
    const snoozed = snoozedIds.has(customer.id);

    // Score: red flags = 3pts, amber = 2pts, renewal urgency adds weight
    const flagScore = flags.reduce((acc, f) => acc + FLAG_PRIORITY[f.flag_type], 0);
    const renewalBonus = renewalUrgent ? (60 - Math.max(daysToRenewal, 0)) / 10 : 0;
    const snoozeMultiplier = snoozed ? 0 : 1;
    const score = (flagScore + renewalBonus) * snoozeMultiplier;

    scored.push({
      customer,
      flags,
      top_flag: topFlag,
      days_to_renewal: daysToRenewal,
      renewal_urgent: renewalUrgent,
      score,
    });
  }

  // Sort by score, always include renewal-urgent accounts
  const withRenewal = scored.filter(s => s.renewal_urgent && s.score === 0);
  const byScore = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  const topItems = [...byScore.slice(0, 3), ...withRenewal.filter(r => !byScore.slice(0, 3).find(b => b.customer.id === r.customer.id))].slice(0, 3);

  if (!topItems.length) {
    return NextResponse.json({ items: [], generated_at: new Date().toISOString() });
  }

  let briefingResults: Array<{ briefing_text: string; suggested_actions: string[] }>;
  try {
    briefingResults = await generateDailyBriefing(topItems.map(item => ({
      customer: item.customer,
      flags: item.flags.map(f => ({ flag_type: f.flag_type, description: f.description, category: f.category, confidence: f.confidence })),
      top_flag: { flag_type: item.top_flag.flag_type, description: item.top_flag.description, category: item.top_flag.category },
      days_to_renewal: item.days_to_renewal,
    })));
  } catch {
    // Fallback if Claude is unavailable
    briefingResults = topItems.map(item => ({
      briefing_text: item.top_flag.description,
      suggested_actions: [item.top_flag.suggested_action, 'Review account history', 'Escalate to team lead'],
    }));
  }

  const items = topItems.map((item, i) => {
    const cid = item.customer.id;

    type ActionRow = { id: number; action_text: string; owner: string; created_at: string; due_date: string | null };

    const pendingRow = db.prepare(`
      SELECT id, action_text, COALESCE(owner, logged_by) AS owner, created_at, due_date
      FROM action_logs
      WHERE customer_id = ? AND outcome IS NULL AND snooze_until <= datetime('now')
      ORDER BY snooze_until DESC LIMIT 1
    `).get(cid) as ActionRow | undefined;

    const openRow = db.prepare(`
      SELECT id, action_text, COALESCE(owner, logged_by) AS owner, COALESCE(due_date, snooze_until) AS due_date
      FROM action_logs
      WHERE customer_id = ? AND outcome IS NULL AND snooze_until > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(cid) as ActionRow | undefined;

    return {
      customer: item.customer,
      flags: item.flags,
      top_flag: item.top_flag,
      briefing_text: briefingResults[i]?.briefing_text ?? item.top_flag.description,
      suggested_actions: briefingResults[i]?.suggested_actions ?? [item.top_flag.suggested_action],
      days_to_renewal: item.days_to_renewal,
      renewal_urgent: item.renewal_urgent,
      ...(pendingRow && {
        pending_outcome: {
          action_log_id: pendingRow.id,
          action_text: pendingRow.action_text,
          owner: pendingRow.owner,
          logged_at: pendingRow.created_at,
          days_ago: differenceInDays(today, new Date(pendingRow.created_at)),
        },
      }),
      ...(openRow && {
        open_commitment: {
          action_log_id: openRow.id,
          action_text: openRow.action_text,
          owner: openRow.owner,
          due_date: openRow.due_date ?? '',
          is_overdue: openRow.due_date ? new Date(openRow.due_date) < today : false,
        },
      }),
    };
  });

  return NextResponse.json({ items, generated_at: new Date().toISOString() });
}
