import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (!rows.length) return NextResponse.json({ error: 'Spreadsheet is empty' }, { status: 400 });

  const db = getDb();
  const insertCustomer = db.prepare(`
    INSERT INTO customers (
      company_name, website, industry, company_size, key_stakeholders, modules_in_use,
      contract_value, renewal_date, onboarding_milestone_status,
      monthly_invoice_volume, last_exec_contact_date, csm_owner
    ) VALUES (
      @company_name, @website, @industry, @company_size, @key_stakeholders, @modules_in_use,
      @contract_value, @renewal_date, @onboarding_milestone_status,
      @monthly_invoice_volume, @last_exec_contact_date, @csm_owner
    )
  `);

  const insertMany = db.transaction((customers: Parameters<typeof insertCustomer.run>[0][]) => {
    const ids: number[] = [];
    for (const c of customers) {
      const result = insertCustomer.run(c);
      ids.push(result.lastInsertRowid as number);
    }
    return ids;
  });

  const parsed = rows.map((row) => {
    // Parse stakeholders: expects "Name (Role), Name (Role)" or JSON
    let stakeholders: { name: string; role: string }[] = [];
    const rawStakeholders = String(row['Key Stakeholders'] ?? row['key_stakeholders'] ?? '');
    try {
      stakeholders = JSON.parse(rawStakeholders);
    } catch {
      // Try "Name (Role)" format
      stakeholders = rawStakeholders.split(',').map(s => {
        const match = s.trim().match(/^(.+?)\s*\((.+?)\)$/);
        return match ? { name: match[1].trim(), role: match[2].trim() } : { name: s.trim(), role: 'Unknown' };
      }).filter(s => s.name);
    }

    // Parse modules: expects comma-separated or JSON array
    let modules: string[] = [];
    const rawModules = String(row['Modules in Use'] ?? row['modules_in_use'] ?? '');
    try {
      modules = JSON.parse(rawModules);
    } catch {
      modules = rawModules.split(',').map(m => m.trim()).filter(Boolean);
    }

    // Parse date
    const parseDate = (val: unknown): string => {
      if (!val) return new Date().toISOString().split('T')[0];
      if (val instanceof Date) return val.toISOString().split('T')[0];
      const s = String(val);
      // Excel serial number
      if (/^\d{5}$/.test(s)) {
        const d = XLSX.SSF.parse_date_code(Number(s));
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
      return s;
    };

    const rawWebsite = String(row['Website'] ?? row['website'] ?? '').trim();
    const normalizeUrl = (url: string): string | null => {
      if (!url) return null;
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      return `https://${url}`;
    };

    return {
      company_name: String(row['Company Name'] ?? row['company_name'] ?? ''),
      website: normalizeUrl(rawWebsite),
      industry: String(row['Industry'] ?? row['industry'] ?? ''),
      company_size: Number(row['Company Size'] ?? row['company_size'] ?? 0),
      key_stakeholders: JSON.stringify(stakeholders),
      modules_in_use: JSON.stringify(modules),
      contract_value: Number(row['Contract Value'] ?? row['contract_value'] ?? 0),
      renewal_date: parseDate(row['Renewal Date'] ?? row['renewal_date']),
      onboarding_milestone_status: String(row['Onboarding Status'] ?? row['onboarding_milestone_status'] ?? ''),
      monthly_invoice_volume: Number(row['Monthly Invoice Volume'] ?? row['monthly_invoice_volume'] ?? 0),
      last_exec_contact_date: parseDate(row['Last Exec Contact Date'] ?? row['last_exec_contact_date']),
      csm_owner: String(row['CSM Owner'] ?? row['csm_owner'] ?? 'Unassigned'),
    };
  });

  const invalid = parsed.filter(r => !r.company_name);
  if (invalid.length) return NextResponse.json({ error: 'Some rows are missing Company Name' }, { status: 400 });

  const ids = insertMany(parsed);
  return NextResponse.json({ inserted: ids.length, customer_ids: ids });
}
