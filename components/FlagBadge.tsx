type FlagType = 'red' | 'amber' | 'green';
type Confidence = 'low' | 'medium' | 'high';

const FLAG_STYLES: Record<FlagType, { dot: string; bg: string; text: string; label: string }> = {
  red:   { dot: 'bg-red-500',    bg: 'bg-red-900',    text: 'text-red-300',    label: 'Act now' },
  amber: { dot: 'bg-amber-400',  bg: 'bg-amber-900',  text: 'text-amber-300',  label: 'Early warning' },
  green: { dot: 'bg-emerald-500', bg: 'bg-emerald-900', text: 'text-emerald-300', label: 'Healthy' },
};

const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export function FlagPill({ type }: { type: FlagType }) {
  const s = FLAG_STYLES[type];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function ConfidencePill({ level }: { level: Confidence }) {
  const colors: Record<Confidence, string> = {
    high: 'bg-blue-900 text-blue-300',
    medium: 'bg-gray-700 text-gray-300',
    low: 'bg-gray-700 text-gray-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[level]}`}>
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}

export function RenewalBadge({ days }: { days: number }) {
  if (days < 0) return <span className="text-xs text-gray-500">Expired</span>;
  const urgent = days <= 30;
  const warning = days <= 60;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
      urgent ? 'bg-red-900 text-red-300' :
      warning ? 'bg-amber-900 text-amber-300' :
      'bg-gray-700 text-gray-400'
    }`}>
      {days === 0 ? 'Today' : `${days}d`}
    </span>
  );
}
