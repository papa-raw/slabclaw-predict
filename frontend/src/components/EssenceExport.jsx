import { useState } from 'react';

/**
 * EssenceExport — Game-over panel that exports the player's SwarmEssence to Walrus.
 * Props:
 *   gameState  — full game state object
 *   playerId   — the human player's ID
 */
export default function EssenceExport({ gameState, playerId }) {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [blobId, setBlobId] = useState(null);
  const [essence, setEssence] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleExport() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/essence/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed');
      setBlobId(data.blobId);
      setEssence(data.essence);
      setStatus('success');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(blobId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  const spiritCount = essence?.spiritLegacies?.length || 0;
  const memoryCount = essence?.coreMemories?.length || 0;

  // Extract 2-3 memorable moments, weighted by drama
  const memorableMoments = (() => {
    const events = gameState?.events || gameState?.eventLog || [];
    const moments = [];

    // Most dramatic battle: deaths rank highest, then close margins
    const battles = events.filter(e => e.type === 'battle_resolved' && e.narrative);
    if (battles.length > 0) {
      const scored = battles.map(b => ({
        ...b,
        drama: (b.loserOutcome === 'died' ? 10 : 3) + (b.margin <= 3 ? 8 : b.margin <= 5 ? 4 : 0),
      }));
      scored.sort((a, b) => b.drama - a.drama);
      moments.push(scored[0].narrative);
      if (scored.length > 2 && scored[1].drama >= 8) moments.push(scored[1].narrative);
    }

    // Spawning milestone
    const spawns = events.filter(e => e.type === 'spawn_complete');
    if (spawns.length > 0) {
      const last = spawns[spawns.length - 1];
      moments.push(`${last.childName || 'A spirit'} emerged as the swarm's ${ordinal(spawns.length)} offspring.`);
    }

    return moments.slice(0, 3);
  })();

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  return (
    <div
      className="rounded-lg p-5 space-y-4 text-left"
      style={{
        background: 'rgba(6,10,18,0.8)',
        border: '1px solid var(--gold-dim)',
        boxShadow: status === 'success' ? '0 0 30px rgba(212,160,82,0.15)' : 'none',
      }}
    >
      <div>
        <div className="text-sm font-mono tracking-wider mb-1" style={{ color: 'var(--gold-bright)' }}>
          PRESERVE YOUR SWARM
        </div>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Export your spirits' memories to Walrus. This blob ID is how they live again.
        </p>
      </div>

      {status === 'idle' && (
        <button
          onClick={handleExport}
          className="w-full py-3 rounded-lg font-display text-base transition-all hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, rgba(180,120,40,0.8), rgba(140,90,30,0.9))',
            color: '#fff',
            border: '1px solid var(--gold-dim)',
            boxShadow: '0 0 20px rgba(212,160,82,0.2)',
          }}
        >
          Export Swarm Essence
        </button>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-3 py-3 text-sm font-mono" style={{ color: 'var(--gold-bright)' }}>
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Preserving essence on Walrus...
        </div>
      )}

      {status === 'success' && blobId && (
        <div className="space-y-4">
          <div className="flex gap-2 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            <span style={{ color: 'var(--gold-bright)' }}>{spiritCount}</span> spirits
            <span style={{ color: 'var(--gold-dim)' }}>·</span>
            <span style={{ color: 'var(--gold-bright)' }}>{memoryCount}</span> memories preserved
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono tracking-wider" style={{ color: 'var(--gold-bright)' }}>
              YOUR BLOB ID — SAVE THIS
            </div>
            <div className="flex items-stretch gap-2">
              <code
                className="flex-1 font-mono text-sm break-all leading-relaxed rounded px-3 py-2.5"
                style={{
                  color: '#86efac',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid var(--gold-dim)',
                }}
              >
                {blobId}
              </code>
              <button
                onClick={handleCopy}
                title="Copy blob ID"
                className="px-4 rounded text-sm font-mono transition-all whitespace-nowrap"
                style={{
                  background: copied ? 'rgba(34,197,94,0.2)' : 'var(--bg-elevated)',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'var(--gold-dim)'}`,
                  color: copied ? '#86efac' : 'var(--text-primary)',
                }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p
              className="text-sm font-body flex items-center gap-1.5"
              style={{
                color: '#fbbf24',
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.15)',
                borderRadius: '6px',
                padding: '8px 12px',
              }}
            >
              <span style={{ fontSize: '1.1em' }}>⚠</span>
              This is your only way to bring your spirits back. Save it somewhere safe.
            </p>
          </div>

          {memorableMoments.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>MEMORABLE MOMENTS</div>
              {memorableMoments.map((m, i) => (
                <p key={i} className="text-sm italic leading-snug" style={{ color: 'var(--text-muted)' }}>"{m}"</p>
              ))}
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-red-400 font-mono">{error}</p>
          <button
            onClick={handleExport}
            className="w-full py-2.5 rounded text-sm transition-colors"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--gold-dim)' }}
          >
            Retry Export
          </button>
        </div>
      )}
    </div>
  );
}
