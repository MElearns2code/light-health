import Anthropic from '@anthropic-ai/sdk';
import { Customer, AIProfile, BriefingItem } from './types';
import { ensureEnv } from './env';

function getClient() {
  ensureEnv();
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SYSTEM_PROFILE = `You are a customer success analyst at Light, a B2B ERP software company selling to small and mid-size businesses.

Light is an AI-native ERP platform covering accounts payable, general ledger, invoice processing, procurement, and core finance modules. It embeds AI into operational workflows — auto-categorising transactions, flagging anomalies, and surfacing finance insights without manual effort. A healthy Light customer has their chart of accounts configured, AP team processing invoices regularly, key finance modules genuinely adopted (not just activated), and their finance lead engaged.

The two biggest churn signals are:
1. Onboarding marked complete but key modules never used in production — they set it up but never embedded it in their workflow
2. Exec sponsor going dark — silence precedes churn, not complaints

Different industries use Light differently. Your job is to understand how THIS specific company will use the platform — what workflows they'll run through it, what Light features they'll rely on, and therefore what metrics indicate genuine adoption versus surface-level activation.

You generate structured customer profiles that CSMs use to personalise health flags. Be specific, grounded, and direct. No generic SaaS language. Think in terms of operational workflows, finance teams, and ERP adoption patterns.`;

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);
}

export async function fetchWebsiteText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LightERP/1.0)' },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) return null;
    const html = await response.text();
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

export async function generateCustomerProfile(
  customer: Customer,
  websiteText: string | null
): Promise<AIProfile> {
  const stakeholderList = customer.key_stakeholders
    .map(s => `${s.name} (${s.role})`)
    .join(', ');

  const websiteSection = websiteText
    ? `\nWebsite content (extracted):\n${websiteText}\n`
    : '\nNo website content available.\n';

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM_PROFILE,
    messages: [
      {
        role: 'user',
        content: `Generate a customer profile for this Light ERP account.

--- ACCOUNT DATA ---
Company: ${customer.company_name}
Industry: ${customer.industry}
Size: ${customer.company_size} employees
Stakeholders: ${stakeholderList}
Modules in use: ${customer.modules_in_use.join(', ')}
Contract value: $${customer.contract_value.toLocaleString()}
Renewal date: ${customer.renewal_date}
Onboarding status: ${customer.onboarding_milestone_status}
Monthly invoice volume: ${customer.monthly_invoice_volume}
Last exec contact: ${customer.last_exec_contact_date}
--- END ACCOUNT DATA ---
${websiteSection}
Based on what this company does and how businesses like theirs operate, reason through:
1. How will they specifically use Light? Which modules will be load-bearing for their workflows?
2. What does "embedded" look like for this type of business — what behaviours prove the tool is in the flow, not just activated?
3. What are the realistic risks given their industry, size, and current adoption data?

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "company_research": "2-3 sentences summarising what this company does, their business model, and any operational context gleaned from their website or industry knowledge",
  "key_usage_patterns": ["3-4 specific ways this company will use Light — e.g. 'High-volume AP matching for manufacturing supplier invoices', 'Month-end close driven by GL module with cost centre tagging'"],
  "pain_points": ["2-4 specific pain points this type of business typically has with financial operations and ERP adoption"],
  "decision_makers": ["list the actual stakeholders who control renewal and adoption, by name and role"],
  "success_definition": "one specific sentence: what does success look like for this customer 12 months in, in their terms not ours",
  "risk_factors": ["2-4 specific risks based on their profile, industry, size, and current adoption data"],
  "healthy_signals": ["2-3 signals that would indicate they're genuinely embedded and likely to renew"],
  "industry_context": "one sentence about how this industry typically uses ERP — what workflows matter most to them and what Light features they'll rely on most",
  "onboarding_assessment": "one sentence assessing where they are in their adoption journey based on the data provided"
}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type from Claude');

  const cleaned = content.text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned) as AIProfile;
}

export async function generateDailyBriefing(items: Array<{
  customer: Customer;
  flags: { flag_type: string; description: string; category: string; confidence: string }[];
  top_flag: { flag_type: string; description: string; category: string };
  days_to_renewal: number;
}>): Promise<Array<{ briefing_text: string; suggested_actions: string[] }>> {

  const itemSummaries = items.map((item, i) => `
Account ${i + 1}: ${item.customer.company_name}
Industry: ${item.customer.industry}, ${item.customer.company_size} employees
CSM: ${item.customer.csm_owner}
Days to renewal: ${item.days_to_renewal}
Top flag (${item.top_flag.flag_type.toUpperCase()}): ${item.top_flag.description}
All active flags: ${item.flags.map(f => `[${f.flag_type.toUpperCase()}] ${f.category}: ${f.description}`).join(' | ')}
`).join('\n---\n');

  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a senior customer success colleague at Light ERP. You write daily briefings for CSMs — not dashboards, not reports. You write like a smart colleague telling them what actually needs their attention this morning.

Rules:
- One sentence per account: what changed and why it matters. No jargon.
- Three specific action options per account. Name names. Reference their actual situation. Not "follow up" — "Book a workflow review with Sarah Chen (AP lead) and ask why invoice volume dropped in March."
- Keep tone direct, useful, slightly urgent where warranted. Never alarmist.
- Ground every action in ERP adoption context — AP workflows, exec engagement, module adoption, invoice volume.`,
    messages: [
      {
        role: 'user',
        content: `Write briefing text for these ${items.length} accounts that need attention today:

${itemSummaries}

Return ONLY valid JSON array (no markdown):
[
  {
    "briefing_text": "one sentence explaining what changed and why it matters for this account",
    "suggested_actions": ["action 1 — specific, named, grounded", "action 2", "action 3"]
  }
]

Return exactly ${items.length} objects in the array, in the same order as the accounts above.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response from Claude');

  const cleaned = content.text.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleaned);
}
