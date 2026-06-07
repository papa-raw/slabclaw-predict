/// GradeBadge — slab-colored grade pill. PSA red / BGS gold / CGC blue / SGC slate.
/// Mirrors registry.html getGraderColor().

const GRADER_COLOR = {
  PSA: '#ef4444',
  BGS: '#D4A017',
  BECKETT: '#D4A017',
  CGC: '#3b82f6',
  SGC: '#9ca3af',
  TAG: '#a855f7',
  ACE: '#10b981',
};

export function graderColor(grader) {
  return GRADER_COLOR[(grader || '').toUpperCase()] || '#9ca3af';
}

export default function GradeBadge({ grader, grade, size = 'sm' }) {
  const c = graderColor(grader);
  const pad = size === 'lg' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold tnum ${pad}`}
      style={{ color: c, background: c + '14', border: `1px solid ${c}40` }}
    >
      <span className="tracking-wide">{(grader || '').toUpperCase()}</span>
      <span>{grade}</span>
    </span>
  );
}

/** Raw/ungraded condition chip (NM/MT, EX/LP …). */
export function RawBadge({ label }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-sc-yes"
      style={{ background: '#4CAF5014', border: '1px solid #4CAF5040' }}>
      Raw {label}
    </span>
  );
}
