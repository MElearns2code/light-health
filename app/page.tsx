'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BriefingItem } from '@/lib/types';
import { FlagPill, ConfidencePill, RenewalBadge } from '@/components/FlagBadge';
import { format, addDays } from 'date-fns';

const CHECK_BACK_PRESETS = [
  { days: 2, label: '2 days' },
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
];

interface CardState {
  outcomeRecorded?: 'resolved' | 'partial' | 'no_difference';
  selectedAction?: string;
  otherText?: string;
  checkBackDate: string;
  committed?: { action: string; checkBackLabel: string };
}

function defaultState(): CardState {
  return { checkBackDate: format(addDays(new Date(), 2), 'yyyy-MM-dd') };
}

export default function BriefingPage() {
  const [data, setData] = useState<{ items: BriefingItem[]; generated_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cardStates, setCardStates] = useState<Record<number, CardState>>({});

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const res = await fetch('/api/briefing');
    const json = await res.json();
    setData(json);
    const initial: Record<number, CardState> = {};
    for (const item of json.items ?? []) initial[item.customer.id] = defaultState();
    setCardStates(initial);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (id: number, update: Partial<CardState>) =>
    setCardStates(prev => ({ ...prev, [id]: { ...prev[id], ...update } }));

  const recordOutcome = async (item: BriefingItem, outcome: 'resolved' | 'partial' | 'no_difference') => {
    if (item.pending_outcome) {
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_log_id: item.pending_outcome.action_log_id, outcome }),
      });
    }
    patch(item.customer.id, { outcomeRecorded: outcome });
  };

  const commitAction = async (item: BriefingItem, action: string, checkBackDate: string) => {
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: item.customer.id,
        flag_id: item.top_flag.id,
        action_text: action,
        logged_by: item.customer.csm_owner,
        check_back_date: checkBackDate,
      }),
    });
    const checkBackLabel = format(new Date(checkBackDate + 'T12:00:00'), 'MMM d');
    patch(item.customer.id, { committed: { action, checkBackLabel }, selectedAction: undefined, otherText: undefined });
  };

  if (loading) return <BriefingLoading />;

  const today = new Date();
  const dayOfWeek = format(today, 'EEEE');
  const dateStr = format(today, 'MMMM d');

  if (!data?.items.length) return <EmptyBriefing dateStr={dateStr} dayOfWeek={dayOfWeek} />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-7">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">{dayOfWeek}, {dateStr}</p>
            <h1 className="text-2xl font-semibold text-gray-900 mt-1">Good morning.</h1>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5"
          >
            <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          {data.items.length === 1 ? 'One account needs your attention today.' : `${data.items.length} accounts need your attention today.`}
        </p>
      </div>

      <div className="space-y-5">
        {data.items.map((item) => {
          const state = cardStates[item.customer.id] ?? defaultState();
          const topFlag = item.top_flag;
          const isResolved = state.outcomeRecorded === 'resolved';

          return (
            <div
              key={item.customer.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                isResolved || state.committed ? 'border-emerald-200 opacity-70' : 'border-gray-200'
              }`}
            >
              {/* Card header */}
              <div className={`px-5 py-4 border-b ${
                topFlag.flag_type === 'red' ? 'bg-red-50 border-red-100' :
                topFlag.flag_type === 'amber' ? 'bg-amber-50 border-amber-100' :
                'bg-emerald-50 border-emerald-100'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <FlagPill type={topFlag.flag_type} />
                      <ConfidencePill level={topFlag.confidence} />
                      {item.renewal_urgent && (
                        <span className="text-xs font-medium text-white bg-red-500 px-2 py-0.5 rounded-full">
                          Renewal {item.days_to_renewal <= 0 ? 'overdue' : `in ${item.days_to_renewal}d`}
                        </span>
                      )}
                    </div>
                    <Link href={`/profiles/${item.customer.id}`} className="hover:underline">
                      <h2 className="text-base font-semibold text-gray-900">{item.customer.company_name}</h2>
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.customer.industry} · {item.customer.company_size} employees · {item.customer.csm_owner}
                    </p>
                  </div>
                  {!item.renewal_urgent && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">Renewal</p>
                      <RenewalBadge days={item.days_to_renewal} />
                    </div>
                  )}
                </div>
              </div>

              {/* Open commitment banner (still active snooze) */}
              {item.open_commitment && !state.committed && (
                <div className={`px-5 py-2.5 border-b flex items-center gap-2 ${
                  item.open_commitment.is_overdue
                    ? 'bg-red-50 border-red-100'
                    : 'bg-indigo-50 border-indigo-100'
                }`}>
                  <svg className={`w-3.5 h-3.5 flex-shrink-0 ${item.open_commitment.is_overdue ? 'text-red-400' : 'text-indigo-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className={`text-xs ${item.open_commitment.is_overdue ? 'text-red-700' : 'text-indigo-700'}`}>
                    {item.open_commitment.is_overdue && <span className="font-semibold">Overdue · </span>}
                    <span className="font-medium">{item.open_commitment.action_text}</span>
                    {' · '}Owned by {item.open_commitment.owner}
                    {item.open_commitment.due_date && ` · impact check ${format(new Date(item.open_commitment.due_date.split('T')[0] + 'T12:00:00'), 'MMM d')}`}
                  </p>
                </div>
              )}

              {/* Card body */}
              <div className="px-5 py-4">
                {/* ── Resolved via outcome ── */}
                {isResolved ? (
                  <div className="flex items-center gap-2.5 py-1">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">Marked as resolved — great work.</p>
                  </div>

                /* ── Committed (new action logged) ── */
                ) : state.committed ? (
                  <div className="flex items-start gap-3 py-1">
                    <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{state.committed.action}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.customer.csm_owner} · impact check on {state.committed.checkBackLabel}
                      </p>
                    </div>
                  </div>

                /* ── Outcome prompt (flag resurfaces after snooze) ── */
                ) : item.pending_outcome && !state.outcomeRecorded ? (
                  <OutcomePrompt
                    item={item}
                    onRecord={(outcome) => recordOutcome(item, outcome)}
                  />

                /* ── Normal briefing + action picker / commit form ── */
                ) : (
                  <>
                    {/* Prior outcome context */}
                    {state.outcomeRecorded && item.pending_outcome && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${state.outcomeRecorded === 'partial' ? 'bg-amber-400' : 'bg-gray-400'}`} />
                        Previous: &ldquo;{item.pending_outcome.action_text}&rdquo; — {
                          state.outcomeRecorded === 'partial' ? 'partially helped' : 'made no difference'
                        }
                      </div>
                    )}

                    <p className="text-[15px] text-gray-800 leading-relaxed mb-4">{item.briefing_text}</p>

                    {/* Secondary flags */}
                    {item.flags.filter(f => f.flag_type !== 'green').length > 1 && (
                      <div className="mb-4 space-y-1.5">
                        {item.flags.filter(f => f.flag_type !== 'green').slice(1, 4).map(flag => (
                          <div key={flag.id} className="flex items-start gap-2 text-xs text-gray-500">
                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${flag.flag_type === 'red' ? 'bg-red-400' : 'bg-amber-400'}`} />
                            <span>{flag.category}: {flag.description}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action selection */}
                    {state.selectedAction && state.selectedAction !== '__other__' ? (
                      <CommitForm
                        action={state.selectedAction}
                        checkBackDate={state.checkBackDate}
                        onChangeCheckBackDate={(d) => patch(item.customer.id, { checkBackDate: d })}
                        onCommit={() => commitAction(item, state.selectedAction!, state.checkBackDate)}
                        onBack={() => patch(item.customer.id, { selectedAction: undefined })}
                      />
                    ) : state.selectedAction === '__other__' ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Describe your action</p>
                        <textarea
                          autoFocus
                          placeholder="What will you do?"
                          value={state.otherText ?? ''}
                          onChange={e => patch(item.customer.id, { otherText: e.target.value })}
                          rows={2}
                          className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const t = state.otherText?.trim();
                              if (t) patch(item.customer.id, { selectedAction: t });
                            }}
                            disabled={!state.otherText?.trim()}
                            className="flex-1 text-sm font-medium px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            Next
                          </button>
                          <button
                            onClick={() => patch(item.customer.id, { selectedAction: undefined, otherText: undefined })}
                            className="text-sm px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Pick an action</p>
                        <div className="space-y-2">
                          {item.suggested_actions.map((action, i) => (
                            <button
                              key={i}
                              onClick={() => patch(item.customer.id, { selectedAction: action })}
                              className="w-full text-left text-sm px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 hover:text-indigo-800 group transition-all"
                            >
                              <span className="inline-flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-gray-100 group-hover:bg-indigo-100 text-gray-500 group-hover:text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {i + 1}
                                </span>
                                {action}
                              </span>
                            </button>
                          ))}
                          <button
                            onClick={() => patch(item.customer.id, { selectedAction: '__other__', otherText: '' })}
                            className="w-full text-left text-sm px-4 py-3 rounded-xl border border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-400 hover:text-indigo-700 group transition-all"
                          >
                            <span className="inline-flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-gray-100 group-hover:bg-indigo-100 text-gray-400 group-hover:text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                +
                              </span>
                              Other — describe your action
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Generated {data?.generated_at ? format(new Date(data.generated_at), 'h:mm a') : ''}
        </p>
        <Link href="/overview" className="text-xs text-gray-400 hover:text-indigo-600 font-medium">
          View all accounts →
        </Link>
      </div>
    </div>
  );
}

function OutcomePrompt({
  item,
  onRecord,
}: {
  item: BriefingItem;
  onRecord: (outcome: 'resolved' | 'partial' | 'no_difference') => void;
}) {
  const po = item.pending_outcome!;
  const when = po.days_ago === 0 ? 'earlier today' : po.days_ago === 1 ? 'yesterday' : `${po.days_ago} days ago`;

  return (
    <div>
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">This flag resurfaces — did the last action help?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {when}, {po.owner} tried: &ldquo;{po.action_text}&rdquo;
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onRecord('resolved')}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Resolved
        </button>
        <button
          onClick={() => onRecord('partial')}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
          Partially helped
        </button>
        <button
          onClick={() => onRecord('no_difference')}
          className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Made no difference
        </button>
      </div>
    </div>
  );
}

function CommitForm({
  action,
  checkBackDate,
  onChangeCheckBackDate,
  onCommit,
  onBack,
}: {
  action: string;
  checkBackDate: string;
  onChangeCheckBackDate: (d: string) => void;
  onCommit: () => void;
  onBack: () => void;
}) {
  const today = new Date();
  const minDate = format(addDays(today, 1), 'yyyy-MM-dd');

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2.5 rounded-lg">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">{action}</span>
      </div>

      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Check impact in</p>

      <div className="flex gap-2 mb-2">
        {CHECK_BACK_PRESETS.map(opt => {
          const presetDate = format(addDays(today, opt.days), 'yyyy-MM-dd');
          return (
            <button
              key={opt.days}
              onClick={() => onChangeCheckBackDate(presetDate)}
              className={`text-sm px-4 py-2 rounded-xl border font-medium transition-all ${
                checkBackDate === presetDate
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <input
        type="date"
        value={checkBackDate}
        min={minDate}
        onChange={e => onChangeCheckBackDate(e.target.value)}
        className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
      />

      <div className="flex gap-2">
        <button
          onClick={onCommit}
          className="flex-1 text-sm font-medium px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
        >
          Commit
        </button>
        <button
          onClick={onBack}
          className="text-sm px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-all"
        >
          Back
        </button>
      </div>
    </div>
  );
}

function EmptyBriefing({ dateStr, dayOfWeek }: { dateStr: string; dayOfWeek: string }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-7">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">{dayOfWeek}, {dateStr}</p>
        <h1 className="text-2xl font-semibold text-gray-900 mt-1">Good morning.</h1>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-gray-700 font-medium mb-1">Nothing urgent today.</p>
        <p className="text-sm text-gray-400 mb-6">
          No accounts are flagged right now. Either everything is healthy, or you have not imported customers yet.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/upload" className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Import customers
          </Link>
          <Link href="/dashboard" className="text-sm px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50">
            View all accounts
          </Link>
        </div>
      </div>
    </div>
  );
}

function BriefingLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-7">
        <div className="h-3 w-32 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-7 w-44 bg-gray-200 rounded animate-pulse" />
      </div>
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl mb-5 overflow-hidden">
          <div className="h-20 bg-gray-100 animate-pulse" />
          <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-12 bg-gray-50 rounded-xl animate-pulse mt-4" />
            <div className="h-12 bg-gray-50 rounded-xl animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
