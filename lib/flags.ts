import { Customer, AIProfile, Flag } from './types';
import { differenceInDays, parseISO } from 'date-fns';

interface FlagInput {
  customer: Customer;
  profile: AIProfile;
}

export function generateFlags({ customer, profile }: FlagInput): Omit<Flag, 'id' | 'created_at'>[] {
  const flags: Omit<Flag, 'id' | 'created_at'>[] = [];
  const today = new Date();

  const renewalDays = differenceInDays(parseISO(customer.renewal_date), today);
  const daysSinceExecContact = differenceInDays(today, parseISO(customer.last_exec_contact_date));
  const modules = customer.modules_in_use.map(m => m.toLowerCase());
  const onboardingStatus = customer.onboarding_milestone_status.toLowerCase();

  const hasAPModule = modules.some(m => m.includes('ap') || m.includes('accounts payable') || m.includes('invoice'));
  const hasGLModule = modules.some(m => m.includes('gl') || m.includes('general ledger') || m.includes('chart'));
  const onboardingComplete = onboardingStatus.includes('complete') || onboardingStatus.includes('done');

  const execContact = customer.key_stakeholders.find(s =>
    s.role.toLowerCase().includes('cfo') ||
    s.role.toLowerCase().includes('controller') ||
    s.role.toLowerCase().includes('vp finance') ||
    s.role.toLowerCase().includes('ceo') ||
    s.role.toLowerCase().includes('founder') ||
    s.role.toLowerCase().includes('exec')
  );

  const apLead = customer.key_stakeholders.find(s =>
    s.role.toLowerCase().includes('ap') ||
    s.role.toLowerCase().includes('accounts payable') ||
    s.role.toLowerCase().includes('accountant') ||
    s.role.toLowerCase().includes('finance')
  );

  // --- RED FLAGS ---

  // Exec sponsor gone dark
  if (daysSinceExecContact > 30) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'red',
      category: 'Exec Engagement',
      description: `${execContact?.name ?? 'Exec sponsor'} last contacted ${daysSinceExecContact} days ago — silence from the top is the strongest churn signal.`,
      confidence: daysSinceExecContact > 45 ? 'high' : 'medium',
      owner: customer.csm_owner,
      suggested_action: `Book a 20-minute exec check-in with ${execContact?.name ?? 'the exec sponsor'} — frame it around their business outcomes, not the software.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Onboarding complete but no invoice volume
  if (onboardingComplete && hasAPModule && customer.monthly_invoice_volume < 5) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'red',
      category: 'Workflow Adoption',
      description: `Onboarding marked complete but only ${customer.monthly_invoice_volume} invoices processed this month — they configured Light but never embedded it in their AP workflow.`,
      confidence: 'high',
      owner: customer.csm_owner,
      suggested_action: `Schedule a workflow review with ${apLead?.name ?? 'the AP lead'} — find out whether they're processing invoices outside Light and why.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Renewal imminent + any amber/red signal
  if (renewalDays <= 30 && renewalDays >= 0) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'red',
      category: 'Renewal Risk',
      description: `Renewal in ${renewalDays} days. ${renewalDays < 14 ? 'Contract decision is imminent.' : 'Not enough time to fix a perception problem — act this week.'}`,
      confidence: 'high',
      owner: customer.csm_owner,
      suggested_action: `Prepare a ROI summary specific to ${customer.company_name}'s use case and book an executive review before the renewal window closes.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Key modules activated but never used
  if (onboardingComplete && !hasAPModule && customer.modules_in_use.length < 2) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'red',
      category: 'Module Adoption',
      description: `Only ${customer.modules_in_use.length} module(s) active post-onboarding — core financial workflows are not running through Light.`,
      confidence: 'medium',
      owner: customer.csm_owner,
      suggested_action: `Run an adoption review: identify which modules were planned vs. actually used, and surface the gap to ${execContact?.name ?? 'the exec sponsor'}.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // --- AMBER FLAGS ---

  // Exec contact stale but not yet critical
  if (daysSinceExecContact > 14 && daysSinceExecContact <= 30) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'amber',
      category: 'Exec Engagement',
      description: `${execContact?.name ?? 'Exec sponsor'} last reached ${daysSinceExecContact} days ago — engagement is cooling. Silence often precedes a decision to not renew.`,
      confidence: 'medium',
      owner: customer.csm_owner,
      suggested_action: `Send a brief value-reminder email to ${execContact?.name ?? 'the exec sponsor'} with one specific metric from their account — keep it under 4 sentences.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Renewal within 60 days — surface regardless of health
  if (renewalDays > 30 && renewalDays <= 60) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'amber',
      category: 'Renewal Window',
      description: `Renewal in ${renewalDays} days. Early enough to course-correct, but the window to influence the decision is opening now.`,
      confidence: 'high',
      owner: customer.csm_owner,
      suggested_action: `Start the renewal conversation with ${execContact?.name ?? 'the exec sponsor'} — share their usage summary and ask what they need to see before signing.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Low invoice volume but onboarding incomplete
  if (!onboardingComplete && customer.monthly_invoice_volume < 10) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'amber',
      category: 'Onboarding Risk',
      description: `Onboarding still in progress and invoice volume is low (${customer.monthly_invoice_volume}/month) — they haven't hit the workflow habit yet.`,
      confidence: 'medium',
      owner: customer.csm_owner,
      suggested_action: `Check in with ${apLead?.name ?? 'the AP team'} on what's blocking full rollout — offer a guided session to get their first batch of invoices through Light.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Small company, missing GL
  if (customer.company_size < 50 && !hasGLModule) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'amber',
      category: 'Module Adoption',
      description: `${customer.company_name} is a ${customer.company_size}-person ${customer.industry.toLowerCase()} business without GL configured — chart of accounts setup is the foundation everything else depends on.`,
      confidence: 'medium',
      owner: customer.csm_owner,
      suggested_action: `Offer a 30-minute chart of accounts setup session — position it as unlocking the rest of their modules, not as a training call.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Industry-specific: manufacturing — high invoice volume expected
  if (customer.industry.toLowerCase().includes('manufactur') && customer.monthly_invoice_volume < 20) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'amber',
      category: 'Usage Baseline',
      description: `Manufacturing businesses typically run high AP volume — ${customer.monthly_invoice_volume} invoices/month is well below expected for ${customer.company_name}'s industry and size.`,
      confidence: 'medium',
      owner: customer.csm_owner,
      suggested_action: `Ask whether vendor invoices are being processed outside Light — if so, find out why and offer an integration review.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // --- GREEN FLAGS ---

  // Healthy exec engagement
  if (daysSinceExecContact <= 14) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'green',
      category: 'Exec Engagement',
      description: `${execContact?.name ?? 'Exec sponsor'} contacted ${daysSinceExecContact} days ago — relationship is active.`,
      confidence: 'high',
      owner: customer.csm_owner,
      suggested_action: `No action needed. Next check-in can wait 2 weeks unless a flag surfaces.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  // Good invoice volume
  if (customer.monthly_invoice_volume >= 20) {
    flags.push({
      customer_id: customer.id,
      flag_type: 'green',
      category: 'Workflow Adoption',
      description: `${customer.monthly_invoice_volume} invoices processed this month — Light is embedded in their AP workflow.`,
      confidence: 'high',
      owner: customer.csm_owner,
      suggested_action: `Consider sharing a usage milestone with ${execContact?.name ?? 'the exec sponsor'} — positive reinforcement builds renewal confidence.`,
      is_active: 1,
      snoozed_until: null,
    });
  }

  return flags;
}
