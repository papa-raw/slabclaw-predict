import { useState } from 'react';
import { getAvatarUrl } from '@lib/avatarUrl.js';

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
    <div className="space-y-3">
          {isConfirmed ? (
            <p className="text-sm text-amber-400 font-mono text-center py-2">
              ✓ Essence loaded — your spirits carry memories of past lives
            </p>
          ) : (
            <>
              <p className="text-base" style={{ color: 'var(--text-primary)' }}>
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
                  className="flex-1 rounded px-3 py-2
                             text-sm font-mono
                             focus:outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--gold-dim)',
                    color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={handleLoad}
                  disabled={!blobInput.trim() || loadStatus === 'loading'}
                  className="px-4 py-2 rounded text-sm font-mono transition-colors whitespace-nowrap disabled:opacity-40"
                  style={{
                    background: 'var(--gold-dim)',
                    color: 'var(--text-primary)',
                  }}
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
                    <div className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      LINEAGE — {preview.deityName}
                    </div>
                    <div className="flex gap-3 text-sm font-mono flex-wrap" style={{ color: 'var(--text-primary)' }}>
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
                      <div className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                        REINCARNATION CANDIDATES
                      </div>
                      {preview.candidates.map((c, i) => (
                        <div
                          key={i}
                          className="rounded px-3 py-2 text-sm space-y-1"
                          style={{ background: 'var(--bg-elevated)' }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {c.avatarBlobId ? (
                                <img src={getAvatarUrl(c.avatarBlobId)} alt={c.name}
                                  className="w-6 h-6 rounded-full object-cover border border-purple-700/40" />
                              ) : null}
                              <span className="text-amber-400 font-header font-semibold">{c.name}</span>
                            </div>
                            <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                              Gen {c.generation} · {c.personalityProfile}
                            </span>
                          </div>
                          {c.pastLifeNames?.length > 1 && (
                            <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                              Past lives: {c.pastLifeNames.slice(1).join(' → ')}
                            </div>
                          )}
                          <div className="flex gap-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
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
                    <div className="text-xs font-mono tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                      MEMORIES CARRIED FORWARD
                    </div>
                    {preview.coreMemories?.length > 0 ? (
                      preview.coreMemories.slice(0, 3).map((m, i) => (
                        <p key={i} className="text-sm italic" style={{ color: 'var(--text-primary)' }}>"{m}"</p>
                      ))
                    ) : (
                      <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>No memories recorded — this spirit begins anew.</p>
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
  );
}
