import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();

  const rows = db.prepare(`
    SELECT
      c.id,
      c.contract_value,
      p.csm_validated IS NOT NULL AS validated,
      COUNT(CASE WHEN f.flag_type = 'red'   AND f.is_active = 1 THEN 1 END) AS red_count,
      COUNT(CASE WHEN f.flag_type = 'amber' AND f.is_active = 1 THEN 1 END) AS amber_count,
      COUNT(CASE WHEN f.flag_type = 'green' AND f.is_active = 1 THEN 1 END) AS green_count
    FROM customers c
    LEFT JOIN profiles p ON p.customer_id = c.id
    LEFT JOIN flags f ON f.customer_id = c.id
    GROUP BY c.id
  `).all() as { id: number; contract_value: number; validated: number; red_count: number; amber_count: number; green_count: number }[];

  const totalAccounts = rows.length;
  const totalArr = rows.reduce((sum, r) => sum + r.contract_value, 0);

  // Only count validated accounts toward health — unvalidated flags are preview-only
  const validated = rows.filter(r => r.validated);
  const atRisk = validated.filter(r => r.red_count > 0);
  const arrAtRisk = atRisk.reduce((sum, r) => sum + r.contract_value, 0);

  const redAccounts = validated.filter(r => r.red_count > 0).length;
  const amberAccounts = validated.filter(r => r.red_count === 0 && r.amber_count > 0).length;
  const greenAccounts = validated.filter(r => r.red_count === 0 && r.amber_count === 0 && r.green_count > 0).length;
  const unvalidatedAccounts = rows.filter(r => !r.validated).length;

  return NextResponse.json({
    totalAccounts,
    totalArr,
    arrAtRisk,
    redAccounts,
    amberAccounts,
    greenAccounts,
    unvalidatedAccounts,
  });
}
