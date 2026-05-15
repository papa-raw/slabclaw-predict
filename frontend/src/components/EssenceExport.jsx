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
    <div className="bg-gray-900/70 border border-amber-900/40 rounded-lg p-5 space-y-4 text-left">
      <div>
        <div className="text-[10px] text-amber-600 font-mono tracking-wider mb-1">SWARM ESSENCE</div>
        <p className="text-sm text-gray-400">
          Preserve your swarm's memories and playstyle on Walrus. Import in your next game to reincarnate your spirits.
        </p>
      </div>

      {status === 'idle' && (
        <button
          onClick={handleExport}
          className="w-full py-2.5 bg-amber-700 hover:bg-amber-600 rounded-lg text-white font-display
                     text-sm transition-colors"
        >
          Export Swarm Essence
        </button>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-3 py-2.5 text-amber-400 text-sm font-mono">
          <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Preserving essence...
        </div>
      )}

      {status === 'success' && blobId && (
        <div className="space-y-3">
          <div className="flex gap-2 text-xs text-gray-500 font-mono">
            <span className="text-amber-600">{spiritCount}</span> spirits
            <span className="text-gray-600">·</span>
            <span className="text-amber-600">{memoryCount}</span> memories preserved
          </div>

          <div className="space-y-1">
            <div className="text-[10px] text-gray-500 font-mono tracking-wider">BLOB ID</div>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 font-mono text-xs text-green-400 bg-gray-950 border border-gray-700/60
                               rounded px-3 py-2 break-all leading-relaxed">
                {blobId}
              </code>
              <button
                onClick={handleCopy}
                title="Copy blob ID"
                className="px-3 bg-gray-800 hover:bg-gray-700 border border-gray-700/60 rounded text-xs
                           text-gray-400 hover:text-white transition-colors whitespace-nowrap"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {memorableMoments.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] text-gray-500 font-mono tracking-wider">MEMORABLE MOMENTS</div>
              {memorableMoments.map((m, i) => (
                <p key={i} className="text-[11px] text-gray-500 italic leading-snug">"{m}"</p>
              ))}
            </div>
          )}

          <p className="text-[11px] text-gray-600 italic">
            Save this ID — paste it in the lobby next game to reincarnate your spirits.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-xs text-red-400 font-mono">{error}</p>
          <button
            onClick={handleExport}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 text-sm transition-colors"
          >
            Retry Export
          </button>
        </div>
      )}
    </div>
  );
}
