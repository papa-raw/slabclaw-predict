/// Shared formatters — terminal-style, tabular, compact.

export function usd(value, { cents = false, compact = true } = {}) {
  if (value == null || isNaN(value)) return '—';
  const n = cents ? value / 100 : value;
  if (compact && Math.abs(n) >= 1000) {
    if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
    const k = n / 1000;
    return '$' + (k >= 100 ? Math.round(k) : k.toFixed(1)).toLocaleString() + 'k';
  }
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function usdFull(value, { cents = false } = {}) {
  if (value == null || isNaN(value)) return '—';
  const n = cents ? value / 100 : value;
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function sui(mist, digits = 2) {
  if (mist == null || isNaN(mist)) return '0';
  return (mist / 1_000_000_000).toFixed(digits);
}

export function pct(n, { sign = true } = {}) {
  if (n == null || isNaN(n)) return '—';
  const s = sign && n > 0 ? '+' : '';
  return s + n.toFixed(n >= 100 || n <= -100 ? 0 : 1) + '%';
}

export function shortAddr(a) {
  if (!a) return '';
  return a.slice(0, 6) + '…' + a.slice(-4);
}

export function timeUntil(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export function shortDate(d) {
  // d: 'YYYY-MM-DD' or ISO. Returns 'Mon DD or M/D
  const dt = typeof d === 'string' ? new Date(d.replace(' ', 'T')) : d;
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function toTime(d) {
  const dt = typeof d === 'string' ? new Date(d.replace(' ', 'T')) : d;
  const t = dt.getTime();
  return isNaN(t) ? null : t;
}

// Up/down arrow glyph (registry uses ↗ / ↘)
export function arrow(n) {
  if (n == null) return '';
  return n > 0 ? '↗' : n < 0 ? '↘' : '→';
}
