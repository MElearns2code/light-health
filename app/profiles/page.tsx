'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlagPill, RenewalBadge } from '@/components/FlagBadge';
import { differenceInDays, parseISO } from 'date-fns';
import { Customer } from '@/lib/types';

interface CustomerWithMeta extends Customer {
  profile_id?: number;
  profile_validated?: boolean;
}

interface Summary {
  totalAccounts: number;
  totalArr: number;
  arrAtRisk: number;
  redAccounts: number;
  amberAccounts: number;
  greenAccounts: number;
  unvalidatedAccounts: number;
}

export default function ProfilesPage() {
  const [customers, setCustomers] = useState<CustomerWithMeta[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/summary').then(r => r.json()),
    ]).then(([data, sum]) => {
      setCustomers(data);
      setSummary(sum);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingState />;

  if (!customers.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <p className="text-gray-500 mb-4">No customers imported yet.</p>
        <Link href="/upload" className="inline-block px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          Import customers
        </Link>
      </div>
    );
  }

  const validated = customers.filter(c => c.profile_validated);
  const pending = customers.filter(c => !c.profile_validated);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Customer profiles</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review each AI-drafted profile before health flags go live.
            {pending.length > 0 && <span className="ml-1.5 text-amber-600 font-medium">{pending.length} awaiting review.</span>}
          </p>
        </div>
        <Link href="/upload" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          + Import more
        </Link>
      </div>

      {summary && summary.totalAccounts > 0 && <HealthSummary summary={summary} />}

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Needs review ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map(c => <CustomerRow key={c.id} customer={c} validated={false} />)}
          </div>
        </section>
      )}

      {validated.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Validated ({validated.length})
          </h2>
          <div className="space-y-2">
            {validated.map(c => <CustomerRow key={c.id} customer={c} validated={true} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function CustomerRow({ customer: c, validated }: { customer: CustomerWithMeta; validated: boolean }) {
  const days = differenceInDays(parseISO(c.renewal_date), new Date());

  return (
    <Link
      href={`/profiles/${c.id}`}
      className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-200 hover:shadow-sm group"
    >
      <div className="flex items-center gap-4">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${validated ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        <div>
          <p className="text-sm font-medium text-gray-900 group-hover:text-indigo-700">{c.company_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">{c.industry} · {c.company_size} employees · CSM: {c.csm_owner}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-gray-400">Renewal</p>
          <RenewalBadge days={days} />
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          validated ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {validated ? 'Validated' : 'Review needed'}
        </span>
        <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function HealthSummary({ summary: s }: { summary: Summary }) {
  const atRiskPct = s.totalArr > 0 ? (s.arrAtRisk / s.totalArr) * 100 : 0;
  const validatedCount = s.redAccounts + s.amberAccounts + s.greenAccounts;
  const fmt = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;

  return (
    <div className="mb-7 bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* ARR metrics */}
        <div className="flex items-start gap-8">
          <div>
            <p className="text-xs text-gray-400 mb-1">Total ARR tracked</p>
            <p className="text-2xl font-semibold text-gray-900">{fmt(s.totalArr)}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.totalAccounts} account{s.totalAccounts !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">ARR at risk</p>
            <p className={`text-2xl font-semibold ${s.arrAtRisk > 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {s.arrAtRisk > 0 ? fmt(s.arrAtRisk) : '—'}
            </p>
            {s.arrAtRisk > 0 && (
              <p className="text-xs text-red-400 mt-0.5">{atRiskPct.toFixed(0)}% of book</p>
            )}
          </div>
        </div>

        {/* Health breakdown */}
        {validatedCount > 0 && (
          <div className="flex-1 min-w-48">
            <p className="text-xs text-gray-400 mb-2">Account health</p>
            <div className="flex items-center gap-1.5 mb-2">
              {s.redAccounts > 0 && (
                <div
                  className="h-2 rounded-full bg-red-400 transition-all"
                  style={{ width: `${(s.redAccounts / validatedCount) * 100}%`, minWidth: '8px' }}
                />
              )}
              {s.amberAccounts > 0 && (
                <div
                  className="h-2 rounded-full bg-amber-400 transition-all"
                  style={{ width: `${(s.amberAccounts / validatedCount) * 100}%`, minWidth: '8px' }}
                />
              )}
              {s.greenAccounts > 0 && (
                <div
                  className="h-2 rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${(s.greenAccounts / validatedCount) * 100}%`, minWidth: '8px' }}
                />
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {s.redAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  {s.redAccounts} at risk
                </span>
              )}
              {s.amberAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  {s.amberAccounts} watch
                </span>
              )}
              {s.greenAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  {s.greenAccounts} healthy
                </span>
              )}
              {s.unvalidatedAccounts > 0 && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                  {s.unvalidatedAccounts} pending review
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl mb-2 animate-pulse" />
      ))}
    </div>
  );
}
