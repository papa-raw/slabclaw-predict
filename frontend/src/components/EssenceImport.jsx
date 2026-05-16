import { useState } from 'react';

/**
 * EssenceImport — Lobby panel for importing a Walrus blob ID to reincarnate spirits.
 * Props:
 *   onEssenceConfirmed(blobId) — called when user confirms import
 */
export default function EssenceImport({ onEssenceConfirmed, confirmedBlobId }) {
  const [blobInput, setBlobInput] = useState('');
  const [loadStatus, setLoadStatus] = useState('idle'); // idle | loading | loaded | error
  const [confirmStatus, setConfirmStatus] = useState('idle'); // idle | loading | confirmed
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  async function handleLoad() {
    const id = blobInput.trim();
    if (!id) return;
    setLoadStatus('loading');
    setError(null);
    setPreview(null);
    try {
      const res = await fetch('/api/essence/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setPreview(data.preview);
      setLoadStatus('loaded');
    } catch (err) {
      setError(err.message);
      setLoadStatus('error');
    }
  }

  async function handleConfirm() {
    setConfirmStatus('loading');
    // Signal parent (Lobby) with the blob ID and preview — Lobby will pass it to /api/game/ready
    onEssenceConfirmed?.(blobInput.trim(), preview);
    setConfirmStatus('confirmed');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleLoad();
  }

  const isConfirmed = confirmStatus === 'confirmed';

  return (
    <div className="bg-gray-800/40 rounded-lg border border-gray-700/30 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/60 transition-colors"
      >
        <span className="text-xs text-gray-500 uppercase tracking-wider font-mono">
          Import Essence
        </span>
        <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-700/30 pt-4">
          {isConfirmed ? (
            <p className="text-sm text-amber-400 font-mono text-center py-2">
              ✓ Essence loaded — your spirits carry memories of past lives
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                Paste a Walrus blob ID from a previous game to reincarnate your spirits.
              </p>

              {/* Input row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={blobInput}
                  onChange={e => setBlobInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter Walrus blob ID"
                  className="flex-1 bg-gray-900 border border-gray-700/60 rounded px-3 py-2
                             text-xs font-mono text-gray-300 placeholder-gray-600
                             focus:outline-none focus:border-amber-700/60"
                />
                <button
                  onClick={handleLoad}
                  disabled={!blobInput.trim() || loadStatus === 'loading'}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800
                             disabled:text-gray-600 rounded text-xs text-white transition-colors whitespace-nowrap"
                >
                  {loadStatus === 'loading' ? '…' : 'Load'}
                </button>
              </div>

              {error && (
                <p className="text-xs text-red-400 font-mono">{error}</p>
              )}

              {/* Preview panel */}
              {preview && loadStatus === 'loaded' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 font-mono tracking-wider">
                      LINEAGE — {preview.deityName}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 font-mono flex-wrap">
                      <span>Depth <span className="text-amber-500">{preview.lineageDepth}</span></span>
                      {preview.lineageBonus && (
                        <span className="text-purple-400">{preview.lineageBonus}</span>
                      )}
                      {preview.gameOutcome && (
                        <span className={preview.gameOutcome.isVictory ? 'text-green-500' : 'text-gray-500'}>
                          {preview.gameOutcome.isVictory ? '✓ Victory' : '✗ Defeat'}
                        </span>
                      )}
                      {preview.gameOutcome && (
                        <span>{preview.gameOutcome.totalBattles || 0} battles</span>
                      )}
                    </div>
                  </div>

                  {/* Candidates */}
                  {preview.candidates?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] text-gray-500 font-mono tracking-wider">
                        REINCARNATION CANDIDATES
                      </div>
                      {preview.candidates.map((c, i) => (
                        <div
                          key={i}
                          className="bg-gray-900/60 rounded px-3 py-2 text-xs space-y-0.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-amber-400 font-header font-semibold">{c.name}</span>
                            <span className="text-gray-600 font-mono text-[10px]">
                              Gen {c.generation} · {c.personalityProfile}
                            </span>
                          </div>
                          {c.pastLifeNames?.length > 1 && (
                            <div className="text-gray-500 text-[10px]">
                              Past lives: {c.pastLifeNames.slice(1).join(' → ')}
                            </div>
                          )}
                          <div className="flex gap-3 text-gray-500 font-mono text-[10px]">
                            <span>+{c.xpCarryover} XP</span>
                            <span>+{c.bondCarryover?.depth || 0} bond</span>
                            <span>{c.kills} kills</span>
                            <span>{c.hexesClaimed} hexes</span>
                            {c.reincarnationCount > 0 && (
                              <span className="text-purple-400">✦ {c.reincarnationCount}x reborn</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Core memories preview */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 font-mono tracking-wider">
                      MEMORIES CARRIED FORWARD
                    </div>
                    {preview.coreMemories?.length > 0 ? (
                      preview.coreMemories.slice(0, 3).map((m, i) => (
                        <p key={i} className="text-[11px] text-gray-500 italic">"{m}"</p>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-600 italic">No memories recorded — this spirit begins anew.</p>
                    )}
                  </div>

                  <button
                    onClick={handleConfirm}
                    disabled={confirmStatus === 'loading'}
                    className="w-full py-2 bg-amber-800 hover:bg-amber-700 disabled:bg-gray-800
                               rounded text-white text-sm font-display transition-colors"
                  >
                    {confirmStatus === 'loading' ? 'Confirming…' : 'Confirm Import'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
