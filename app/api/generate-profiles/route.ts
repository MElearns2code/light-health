import { NextRequest, connection } from 'next/server';
import { getDb } from '@/lib/db';
import { generateCustomerProfile, fetchWebsiteText } from '@/lib/claude';
import { generateFlags } from '@/lib/flags';
import { Customer } from '@/lib/types';

function parseCustomer(row: Record<string, unknown>): Customer {
  return {
    ...row,
    key_stakeholders: JSON.parse(row.key_stakeholders as string),
    modules_in_use: JSON.parse(row.modules_in_use as string),
  } as Customer;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const customerIds: number[] = body.customer_ids ?? [];

  if (!customerIds.length) {
    return new Response(JSON.stringify({ error: 'No customer IDs provided' }), { status: 400 });
  }

  await connection();
  const db = getDb();

  const enc = new TextEncoder();
  const send = (data: object) => enc.encode(JSON.stringify(data) + '\n');

  const stream = new ReadableStream({
    async start(controller) {
      // Enqueue all as queued first so the UI can render all rows immediately
      const customers: Customer[] = [];
      for (const id of customerIds) {
        const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        if (!row) {
          controller.enqueue(send({ type: 'error', customer_id: id, company_name: 'Unknown', error: 'Not found' }));
          continue;
        }
        const customer = parseCustomer(row);
        customers.push(customer);
        controller.enqueue(send({ type: 'queued', customer_id: id, company_name: customer.company_name }));
      }

      for (const customer of customers) {
        const id = customer.id;

        try {
          // Step 1: website fetch
          let websiteText: string | null = null;
          if (customer.website) {
            controller.enqueue(send({ type: 'website_start', customer_id: id, company_name: customer.company_name }));
            websiteText = await fetchWebsiteText(customer.website);
            controller.enqueue(send({ type: 'website_done', customer_id: id, company_name: customer.company_name, found: !!websiteText }));
          } else {
            controller.enqueue(send({ type: 'website_skip', customer_id: id, company_name: customer.company_name }));
          }

          // Step 2: AI profile
          controller.enqueue(send({ type: 'profile_start', customer_id: id, company_name: customer.company_name }));
          const aiDraft = await generateCustomerProfile(customer, websiteText);

          // Upsert profile
          const existing = db.prepare('SELECT id FROM profiles WHERE customer_id = ?').get(id);
          if (existing) {
            db.prepare('UPDATE profiles SET ai_draft = ?, csm_validated = NULL, validated_at = NULL, validated_by = NULL WHERE customer_id = ?')
              .run(JSON.stringify(aiDraft), id);
          } else {
            db.prepare('INSERT INTO profiles (customer_id, ai_draft) VALUES (?, ?)').run(id, JSON.stringify(aiDraft));
          }

          // Step 3: flags
          const flagInputs = generateFlags({ customer, profile: aiDraft });
          db.prepare('DELETE FROM flags WHERE customer_id = ?').run(id);
          const insertFlag = db.prepare(`
            INSERT INTO flags (customer_id, flag_type, category, description, confidence, owner, suggested_action, is_active, snoozed_until)
            VALUES (@customer_id, @flag_type, @category, @description, @confidence, @owner, @suggested_action, @is_active, @snoozed_until)
          `);
          db.transaction(() => { for (const f of flagInputs) insertFlag.run(f); })();

          const redCount = flagInputs.filter(f => f.flag_type === 'red').length;
          const amberCount = flagInputs.filter(f => f.flag_type === 'amber').length;
          const greenCount = flagInputs.filter(f => f.flag_type === 'green').length;

          controller.enqueue(send({
            type: 'done',
            customer_id: id,
            company_name: customer.company_name,
            flag_count: flagInputs.length,
            red: redCount,
            amber: amberCount,
            green: greenCount,
          }));
        } catch (err) {
          controller.enqueue(send({ type: 'error', customer_id: id, company_name: customer.company_name, error: String(err) }));
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
