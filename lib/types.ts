export interface Stakeholder {
  name: string;
  role: string;
}

export interface Customer {
  id: number;
  company_name: string;
  website: string | null;
  industry: string;
  company_size: number;
  key_stakeholders: Stakeholder[];
  modules_in_use: string[];
  contract_value: number;
  renewal_date: string;
  onboarding_milestone_status: string;
  monthly_invoice_volume: number;
  last_exec_contact_date: string;
  csm_owner: string;
  created_at: string;
  updated_at: string;
}

export interface AIProfile {
  company_research: string;
  key_usage_patterns: string[];
  pain_points: string[];
  decision_makers: string[];
  success_definition: string;
  risk_factors: string[];
  healthy_signals: string[];
  industry_context: string;
  onboarding_assessment: string;
}

export interface Profile {
  id: number;
  customer_id: number;
  ai_draft: AIProfile;
  csm_validated: AIProfile | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
}

export interface Flag {
  id: number;
  customer_id: number;
  flag_type: 'green' | 'amber' | 'red';
  category: string;
  description: string;
  confidence: 'low' | 'medium' | 'high';
  owner: string;
  suggested_action: string;
  is_active: number;
  snoozed_until: string | null;
  created_at: string;
}

export interface ActionLog {
  id: number;
  customer_id: number;
  flag_id: number | null;
  action_text: string;
  logged_by: string;
  owner: string;
  due_date: string | null;
  outcome: string | null;
  snooze_until: string;
  created_at: string;
}

export interface BriefingItem {
  customer: Customer;
  flags: Flag[];
  top_flag: Flag;
  briefing_text: string;
  suggested_actions: string[];
  days_to_renewal: number;
  renewal_urgent: boolean;
  pending_outcome?: {
    action_log_id: number;
    action_text: string;
    owner: string;
    logged_at: string;
    days_ago: number;
  };
  open_commitment?: {
    action_log_id: number;
    action_text: string;
    owner: string;
    due_date: string;
    is_overdue: boolean;
  };
}
