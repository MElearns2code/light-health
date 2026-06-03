export default function IntegrationsPage() {
  const integrations = [
    {
      name: 'HubSpot',
      desc: 'Pull account data, renewal dates, and contact history directly — no more spreadsheet exports.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-6 h-6" fill="currentColor">
          <circle cx="24" cy="24" r="22" className="text-orange-100" fill="currentColor" />
          <text x="24" y="30" textAnchor="middle" className="text-orange-600" fill="currentColor" fontSize="16" fontWeight="bold">H</text>
        </svg>
      ),
      fields: ['Account name', 'Contract value', 'Renewal date', 'Last activity', 'Contact list'],
      color: 'orange',
    },
    {
      name: 'Mixpanel',
      desc: 'Replace manual invoice volume tracking with real login frequency, feature adoption, and session data per account.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-6 h-6" fill="currentColor">
          <circle cx="24" cy="24" r="22" className="text-purple-100" fill="currentColor" />
          <text x="24" y="30" textAnchor="middle" className="text-purple-600" fill="currentColor" fontSize="16" fontWeight="bold">M</text>
        </svg>
      ),
      fields: ['Login frequency', 'Module usage', 'Feature adoption', 'Session recency'],
      color: 'purple',
    },
    {
      name: 'Zendesk',
      desc: 'Auto-flag accounts with support ticket spikes — the early warning sign that both churned customers showed.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-6 h-6" fill="currentColor">
          <circle cx="24" cy="24" r="22" className="text-green-100" fill="currentColor" />
          <text x="24" y="30" textAnchor="middle" className="text-green-600" fill="currentColor" fontSize="16" fontWeight="bold">Z</text>
        </svg>
      ),
      fields: ['Open ticket count', 'Unresolved tickets', 'Ticket velocity', 'Time to resolve'],
      color: 'green',
    },
    {
      name: 'NPS / Survey tool',
      desc: 'Surface NPS trends per account alongside health flags — a dropping score is a leading indicator, not a lagging one.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-6 h-6" fill="currentColor">
          <circle cx="24" cy="24" r="22" className="text-blue-100" fill="currentColor" />
          <text x="24" y="30" textAnchor="middle" className="text-blue-600" fill="currentColor" fontSize="14" fontWeight="bold">NPS</text>
        </svg>
      ),
      fields: ['Latest NPS score', 'Score trend', 'Response rate', 'Verbatim themes'],
      color: 'blue',
    },
    {
      name: 'Slack',
      desc: 'Deliver the daily briefing directly to each CSM in Slack with inline action buttons — no login required.',
      icon: (
        <svg viewBox="0 0 48 48" className="w-6 h-6" fill="currentColor">
          <circle cx="24" cy="24" r="22" className="text-indigo-100" fill="currentColor" />
          <text x="24" y="30" textAnchor="middle" className="text-indigo-600" fill="currentColor" fontSize="16" fontWeight="bold">S</text>
        </svg>
      ),
      fields: ['Daily briefing delivery', 'Action buttons inline', 'Per-CSM routing', 'Escalation pings'],
      color: 'indigo',
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-xl font-semibold text-gray-900">Integrations</h1>
          <span className="text-xs font-medium bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-full">Phase 2</span>
        </div>
        <p className="text-sm text-gray-500">
          Right now, health data comes in through the Excel upload. Phase 2 replaces this with live data connections — so flags update in real time without anyone touching a spreadsheet.
        </p>
      </div>

      {/* Feedback loop callout */}
      <div className="mb-8 bg-indigo-50 border border-indigo-100 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900 mb-1">Feedback loop — Phase 2</p>
            <p className="text-sm text-indigo-700">
              48 hours after a CSM logs an action, the system asks: "Did the customer respond?" One tap yes/no. Over time, this teaches the system which actions actually work for which customer profiles — improving flag confidence without anyone having to update a model manually.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {integrations.map(integration => (
          <div key={integration.name} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-gray-50">
                  {integration.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{integration.name}</h3>
                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Coming in Phase 2</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{integration.desc}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {integration.fields.map(field => (
                <span key={field} className="text-xs bg-gray-50 border border-gray-100 text-gray-500 px-2.5 py-1 rounded-md">
                  {field}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-5">
        <p className="text-sm font-medium text-gray-700 mb-2">What changes in Phase 2</p>
        <ul className="space-y-2">
          {[
            'Excel upload is replaced by live HubSpot, Mixpanel, and Zendesk connections',
            'Flags update automatically when data changes — not just when a CSM uploads a file',
            'The daily briefing is delivered to Slack with action buttons inline',
            'CSMs never need to log into a separate tool unless they want to',
            '48-hour feedback loop closes: system learns which actions work for which customer types',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
