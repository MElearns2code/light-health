'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Customer, Flag } from '@/lib/types';
import { FlagPill, RenewalBadge } from '@/components/FlagBadge';
import { differenceInDays, parseISO, format } from 'date-fns';

interface CustomerWithFlags extends Customer {
  profile_validated?: boolean;
  flags?: Flag[];
  top_flag?: Flag;
  days_to_renewal: number;
}

type SortKey = 'risk' | 'renewal' | 'company' | 'value';
type FilterKey = 'all' | 'red' | 'amber' | 'green' | 'unvalidated';

const FLAG_PRIORITY: Record<string, number> = { red: 3, amber: 2, green: 1 };

export default function DashboardPage() {
  const [customers, setCustomers] = useState<CustomerWithFlags[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>('risk');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
    ]).then(async ([customerData]) => {
      // Fetch flags for all customers
      const enriched: CustomerWithFlags[] = await Promise.all(
        customerData.map(async (c: Customer) => {
          const detail = await fetch(`/api/customers/${c.id}`).then(r => r.json());
          const flags: Flag[] = detail.flags ?? [];
          const topFlag = flags.sort((a: Flag, b: Flag) => FLAG_PRIORITY[b.flag_type] - FLAG_PRIORITY[a.flag_type])[0];
          return {
            ...c,
            profile_validated: !!detail.profile?.csm_validated,
            flags,
            top_flag: topFlag,
            days_to_renewal: differenceInDays(parseISO(c.renewal_date), new Date()),
          };
        })
      );
      setCustomers(enriched);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let data = [...customers];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(c => c.company_name.toLowerCase().includes(q) || c.industry.toLowerCase().includes(q) || c.csm_owner.toLowerCase().includes(q));
    }

    if (filter === 'red') data = data.filter(c => c.top_flag?.flag_type === 'red');
    else if (filter === 'amber') data = data.filter(c => c.top_flag?.flag_type === 'amber');
    else if (filter === 'green') data = data.filter(c => !c.top_flag || c.top_flag.flag_type === 'green');
    else if (filter === 'unvalidated') data = data.filter(c => !c.profile_validated);

    data.sort((a, b) => {
      if (sort === 'risk') {
        const aScore = FLAG_PRIORITY[a.top_flag?.flag_type ?? 'green'] ?? 1;
        const bScore = FLAG_PRIORITY[b.top_flag?.flag_type ?? 'green'] ?? 1;
        if (bScore !== aScore) return bScore - aScore;
        return a.days_to_renewal - b.days_to_renewal;
      }
      if (sort === 'renewal') return a.days_to_renewal - b.days_to_renewal;
      if (sort === 'company') return a.company_name.localeCompare(b.company_name);
      if (sort === 'value') return b.contract_value - a.contract_value;
      return 0;
    });

    return data;
  }, [customers, filter, sort, search]);

  const counts = useMemo(() => ({
    red: customers.filter(c => c.top_flag?.flag_type === 'red').length,
    amber: customers.filter(c => c.top_flag?.flag_type === 'amber').length,
    green: customers.filter(c => !c.top_flag || c.top_flag.flag_type === 'green').length,
    renewal60: customers.filter(c => c.days_to_renewal >= 0 && c.days_to_renewal <= 60).length,
  }), [customers]);

  if (loading) return <DashboardLoading />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">All accounts</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            QBR prep and management review. Not your daily view — that is <Link href="/" className="text-indigo-500 hover:underline">the briefing</Link>.
          </p>
        </div>
        <Link href="/upload" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Import</Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Act now', value: counts.red, color: 'text-red-600', bg: 'bg-red-50 border-red-100' },
          { label: 'Early warning', value: counts.amber, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
          { label: 'Healthy', value: counts.green, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { label: 'Renewing in 60d', value: counts.renewal60, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border p-4 ${stat.bg}`}>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search accounts..."
          className="flex-1 min-w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        />
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'red', 'amber', 'green', 'unvalidated'] as FilterKey[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-md font-medium capitalize transition-colors ${
                filter === f ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'unvalidated' ? 'Unvalidated' : f}
            </button>
          ))}
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <option value="risk">Sort: Risk</option>
          <option value="renewal">Sort: Renewal date</option>
          <option value="company">Sort: Company name</option>
          <option value="value">Sort: Contract value</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {customers.length === 0 ? (
            <>
              <p className="mb-3">No customers yet.</p>
              <Link href="/upload" className="text-sm text-indigo-600 hover:underline">Import your first accounts</Link>
            </>
          ) : 'No accounts match your filter.'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Account</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Top flag</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">Renewal</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">ARR</th>
                <th className="text-left text-xs font-medium text-gray-400 px-4 py-3">CSM</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${i === filtered.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">{c.company_name}</p>
                    <p className="text-xs text-gray-400">{c.industry} · {c.company_size} people</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.profile_validated ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Validated</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Review needed</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.top_flag ? (
                      <div>
                        <FlagPill type={c.top_flag.flag_type} />
                        <p className="text-xs text-gray-400 mt-1 max-w-48 truncate">{c.top_flag.category}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">No flags</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RenewalBadge days={c.days_to_renewal} />
                    <p className="text-xs text-gray-400 mt-1">{format(parseISO(c.renewal_date), 'MMM d, yyyy')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-700">${(c.contract_value / 1000).toFixed(0)}k</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-gray-600">{c.csm_owner}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/profiles/${c.id}`} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4 text-center">
        {filtered.length} of {customers.length} accounts shown
      </p>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="h-64 bg-white border border-gray-200 rounded-xl animate-pulse" />
    </div>
  );
}
