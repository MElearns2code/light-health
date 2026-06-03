'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Customer, Profile, AIProfile, Flag } from '@/lib/types';
import { FlagPill, ConfidencePill, RenewalBadge } from '@/components/FlagBadge';
import { differenceInDays, parseISO, format } from 'date-fns';

interface CustomerDetail {
  customer: Customer;
  profile: Profile & { ai_draft: string; csm_validated: string | null };
  flags: Flag[];
}

export default function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AIProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/customers/${id}`).then(r => r.json()).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-8 text-gray-400">Loading...</div>;
  if (!data) return <div className="max-w-3xl mx-auto px-4 py-8 text-gray-400">Account not found.</div>;

  const { customer, profile, flags } = data;
  const aiProfile: AIProfile = profile ? JSON.parse(profile.ai_draft) : null;
  const validatedProfile: AIProfile | null = profile?.csm_validated ? JSON.parse(profile.csm_validated) : null;
  const currentProfile = editing ?? validatedProfile ?? aiProfile;
  const daysToRenewal = differenceInDays(parseISO(customer.renewal_date), new Date());

  const emptyProfile: AIProfile = {
    company_research: '',
    key_usage_patterns: [],
    pain_points: [],
    decision_makers: customer.key_stakeholders.map(s => `${s.name} (${s.role})`),
    success_definition: '',
    risk_factors: [],
    healthy_signals: [],
    industry_context: '',
    onboarding_assessment: '',
  };
  const startEdit = () => setEditing(validatedProfile ?? (aiProfile ? { ...aiProfile } : emptyProfile));

  const updateField = <K extends keyof AIProfile>(key: K, value: AIProfile[K]) => {
    setEditing(e => e ? { ...e, [key]: value } : null);
  };

  const updateArrayItem = (key: keyof AIProfile, index: number, value: string) => {
    setEditing(e => {
      if (!e) return null;
      const arr = [...(e[key] as string[])];
      arr[index] = value;
      return { ...e, [key]: arr };
    });
  };

  const addArrayItem = (key: keyof AIProfile) => {
    setEditing(e => {
      if (!e) return null;
      return { ...e, [key]: [...(e[key] as string[]), ''] };
    });
  };

  const removeArrayItem = (key: keyof AIProfile, index: number) => {
    setEditing(e => {
      if (!e) return null;
      const arr = (e[key] as string[]).filter((_, i) => i !== index);
      return { ...e, [key]: arr };
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await fetch(`/api/customers/${id}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: editing, validated_by: 'CSM' }),
    });
    const updated = await res.json();
    setData(d => d ? { ...d, profile: updated.profile, flags: updated.flags } : d);
    setEditing(null);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const redFlags = flags.filter(f => f.flag_type === 'red');
  const amberFlags = flags.filter(f => f.flag_type === 'amber');
  const greenFlags = flags.filter(f => f.flag_type === 'green');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => router.back()} className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to profiles
          </button>
          <h1 className="text-xl font-semibold text-gray-900">{customer.company_name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {customer.industry} · {customer.company_size} employees · ${customer.contract_value.toLocaleString()} ARR
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Renewal</p>
          <RenewalBadge days={daysToRenewal} />
          <p className="text-xs text-gray-400 mt-1">{format(parseISO(customer.renewal_date), 'MMM d, yyyy')}</p>
        </div>
      </div>

      {/* Validation banner */}
      {validatedProfile ? (
        <div className="mb-5 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
          <div className="w-4 h-4 bg-emerald-400 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-emerald-800">
            Profile validated · Flags are active
            {profile?.validated_at && <span className="text-emerald-600 ml-1">({format(new Date(profile.validated_at), 'MMM d')})</span>}
          </p>
          <button onClick={startEdit} className="ml-auto text-xs text-emerald-600 hover:text-emerald-800 font-medium">
            Edit profile
          </button>
        </div>
      ) : (
        <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5">
          <div className="w-4 h-4 bg-amber-400 rounded-full flex-shrink-0" />
          <p className="text-sm text-amber-800">AI-drafted profile — review and validate before flags go live</p>
          {!editing && (
            <button onClick={startEdit} className="ml-auto text-xs font-medium px-3 py-1 bg-amber-600 text-white rounded-md hover:bg-amber-700">
              Review &amp; validate
            </button>
          )}
        </div>
      )}

      {saved && (
        <div className="mb-4 text-sm text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2">
          Profile validated — flags have been regenerated.
        </div>
      )}

      {/* Profile editor */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900">Customer profile</h2>
          {!editing && aiProfile && (
            <button onClick={startEdit} className="text-xs text-indigo-600 hover:text-indigo-800">Edit</button>
          )}
        </div>

        {currentProfile ? (
          <div className="space-y-5">
            {(currentProfile.company_research || editing) && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                  <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide">Company research</p>
                </div>
                {editing ? (
                  <textarea
                    value={editing.company_research ?? ''}
                    onChange={e => updateField('company_research', e.target.value)}
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                  />
                ) : (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                    <p className="text-sm text-blue-900">{currentProfile.company_research}</p>
                  </div>
                )}
              </div>
            )}
            {((currentProfile.key_usage_patterns?.length > 0) || editing) && (
              <ArraySection
                title="How they'll use Light"
                items={editing ? (editing.key_usage_patterns ?? []) : currentProfile.key_usage_patterns}
                editing={!!editing}
                onChange={(i, v) => updateArrayItem('key_usage_patterns', i, v)}
                onAdd={() => addArrayItem('key_usage_patterns')}
                onRemove={i => removeArrayItem('key_usage_patterns', i)}
                itemColor="text-indigo-700"
              />
            )}
            <ProfileSection
              title="Industry context"
              value={editing ? editing.industry_context : currentProfile.industry_context}
              editing={!!editing}
              onTextChange={v => updateField('industry_context', v)}
            />
            <ProfileSection
              title="Onboarding assessment"
              value={editing ? editing.onboarding_assessment : currentProfile.onboarding_assessment}
              editing={!!editing}
              onTextChange={v => updateField('onboarding_assessment', v)}
            />
            <ProfileSection
              title="What success looks like"
              value={editing ? editing.success_definition : currentProfile.success_definition}
              editing={!!editing}
              onTextChange={v => updateField('success_definition', v)}
            />
            <ArraySection
              title="Pain points"
              items={editing ? editing.pain_points : currentProfile.pain_points}
              editing={!!editing}
              onChange={(i, v) => updateArrayItem('pain_points', i, v)}
              onAdd={() => addArrayItem('pain_points')}
              onRemove={i => removeArrayItem('pain_points', i)}
            />
            <ArraySection
              title="Decision makers"
              items={editing ? editing.decision_makers : currentProfile.decision_makers}
              editing={!!editing}
              onChange={(i, v) => updateArrayItem('decision_makers', i, v)}
              onAdd={() => addArrayItem('decision_makers')}
              onRemove={i => removeArrayItem('decision_makers', i)}
            />
            <ArraySection
              title="Risk factors"
              items={editing ? editing.risk_factors : currentProfile.risk_factors}
              editing={!!editing}
              onChange={(i, v) => updateArrayItem('risk_factors', i, v)}
              onAdd={() => addArrayItem('risk_factors')}
              onRemove={i => removeArrayItem('risk_factors', i)}
              itemColor="text-red-600"
            />
            <ArraySection
              title="Healthy signals"
              items={editing ? editing.healthy_signals : currentProfile.healthy_signals}
              editing={!!editing}
              onChange={(i, v) => updateArrayItem('healthy_signals', i, v)}
              onAdd={() => addArrayItem('healthy_signals')}
              onRemove={i => removeArrayItem('healthy_signals', i)}
              itemColor="text-emerald-600"
            />
          </div>
        ) : (
          <p className="text-sm text-gray-400">No profile generated yet.</p>
        )}

        {editing && (
          <div className="mt-6 flex gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {saving ? 'Saving...' : 'Validate & activate flags'}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Flags */}
      {flags.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Health flags
            {!validatedProfile && <span className="ml-2 text-xs font-normal text-amber-600">(preview — validate profile to activate)</span>}
          </h2>
          <div className="space-y-3">
            {[...redFlags, ...amberFlags, ...greenFlags].map(flag => (
              <div key={flag.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FlagPill type={flag.flag_type} />
                    <span className="text-xs text-gray-400">{flag.category}</span>
                    <ConfidencePill level={flag.confidence} />
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-2">{flag.description}</p>
                <div className="flex items-start gap-2 bg-indigo-50 rounded-md px-3 py-2">
                  <svg className="w-3.5 h-3.5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-indigo-700">{flag.suggested_action}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">Owner: <span className="font-medium text-gray-600">{flag.owner}</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer data */}
      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Account data</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {[
            ['Modules', customer.modules_in_use.join(', ')],
            ['Invoice volume', `${customer.monthly_invoice_volume}/month`],
            ['Onboarding', customer.onboarding_milestone_status],
            ['Last exec contact', customer.last_exec_contact_date],
            ['CSM Owner', customer.csm_owner],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <p className="text-xs text-gray-400 mb-2">Stakeholders</p>
          <div className="flex flex-wrap gap-2">
            {customer.key_stakeholders.map(s => (
              <span key={s.name} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                {s.name} <span className="text-gray-400">· {s.role}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSection({
  title, value, editing, onTextChange,
}: {
  title: string; value: string; editing: boolean; onTextChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{title}</p>
      {editing ? (
        <textarea
          value={value ?? ''}
          onChange={e => onTextChange(e.target.value)}
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
      ) : (
        <p className="text-sm text-gray-700">{value}</p>
      )}
    </div>
  );
}

function ArraySection({
  title, items, editing, onChange, onAdd, onRemove, itemColor = 'text-gray-700',
}: {
  title: string; items: string[]; editing: boolean;
  onChange: (i: number, v: string) => void;
  onAdd: () => void; onRemove: (i: number) => void;
  itemColor?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{title}</p>
      <ul className="space-y-1.5">
        {(items ?? []).map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            {editing ? (
              <>
                <input
                  value={item}
                  onChange={e => onChange(i, e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                />
                <button
                  onClick={() => onRemove(i)}
                  className="mt-1 text-gray-300 hover:text-red-400 flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                <p className={`text-sm ${itemColor}`}>{item}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <button onClick={onAdd} className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
          + Add item
        </button>
      )}
    </div>
  );
}
