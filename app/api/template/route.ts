import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET() {
  const headers = [
    'Company Name', 'Website', 'Industry', 'Company Size', 'Key Stakeholders',
    'Modules in Use', 'Contract Value', 'Renewal Date',
    'Onboarding Status', 'Monthly Invoice Volume', 'Last Exec Contact Date', 'CSM Owner',
  ];

  const example = [
    'Meridian Metals', 'https://meridianmetals.com', 'Manufacturing', 120,
    'Janet Wu (CFO), David Park (AP Lead), Chris Moore (CEO)',
    'AP, General Ledger, Inventory',
    48000, '2026-09-01', 'Complete', 34, '2026-05-10', 'Sarah Chen',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 20) }));

  // Style header row
  headers.forEach((_, i) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cellAddr]) ws[cellAddr] = {};
    ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8F0FE' } } };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');

  // Add instructions sheet
  const instructions = [
    ['Field', 'Format', 'Example'],
    ['Company Name', 'Text', 'Meridian Metals'],
    ['Website', 'URL (optional but recommended)', 'https://meridianmetals.com'],
    ['Industry', 'Text', 'Manufacturing / Accounting / Retail / etc.'],
    ['Company Size', 'Number (headcount)', '120'],
    ['Key Stakeholders', 'Name (Role), Name (Role)', 'Janet Wu (CFO), David Park (AP Lead)'],
    ['Modules in Use', 'Comma-separated', 'AP, General Ledger, Inventory'],
    ['Contract Value', 'Number (annual $)', '48000'],
    ['Renewal Date', 'YYYY-MM-DD', '2026-09-01'],
    ['Onboarding Status', 'Text', 'Complete / In Progress / Not Started'],
    ['Monthly Invoice Volume', 'Number', '34'],
    ['Last Exec Contact Date', 'YYYY-MM-DD', '2026-05-10'],
    ['CSM Owner', 'Text (CSM name)', 'Sarah Chen'],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instructions);
  wsInstr['!cols'] = [{ wch: 28 }, { wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, 'Instructions');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="light_customers_template.xlsx"',
    },
  });
}
