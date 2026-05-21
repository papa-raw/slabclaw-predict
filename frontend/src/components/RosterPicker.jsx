import { useState, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDevWallet } from '../lib/devWallet.jsx';
import { getAvatarUrl } from '@lib/avatarUrl.js';

const MAX_SLOTS = 3;

const SPEC_ICONS = { warrior: '⚔', scout: '⌖', gatherer: '◈' };

const SPEC_COLORS = {
  warrior: 'var(--spec-warrior)',
  scout: 'var(--spec-scout)',
  gatherer: 'var(--spec-gatherer)',
};

const STATUS_DOT = {
  0: { color: '#22c55e', label: 'Alive' },
  1: { color: '#ef4444', label: 'Dead' },
  2: { color: '#a855f7', label: 'Ghost' },
};

export default function RosterPicker({ onSelectionChange, selectedIds = [] }) {
  const account = useCurrentAccount();
  const devWallet = useDevWallet();
  const walletAddress = account?.address || devWallet.address;

  const [spirits, setSpirits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!walletAddress) {
      setSpirits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/roster/${walletAddress}`)
      .then(r => {
        if (!r.ok) throw new Error(`Roster fetch failed (${r.status})`);
        return r.json();
      })
      .then(data => {
        if (!cancelled) setSpirits(data.spirits || []);
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [walletAddress]);

  function toggleSelect(objectId) {
    const isSelected = selectedIds.includes(objectId);
    let next;
    if (isSelected) {
      next = selectedIds.filter(id => id !== objectId);
    } else if (selectedIds.length < MAX_SLOTS) {
      next = [...selectedIds, objectId];
    } else {
      return;
    }
    onSelectionChange?.(next);
  }

  if (!walletAddress) {
    return (
      <div className="anima-panel">
        <div className="anima-panel-header">Spirit Roster</div>
        <div className="anima-panel-body">
          <p className="font-body text-sm italic" style={{ color: 'var(--text-muted)' }}>
            Connect wallet to load your spirit roster
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="anima-panel">
      <div className="anima-panel-header flex items-center justify-between">
        <span>Spirit Roster</span>
        {spirits.length > 0 && (
          <span className="font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
            {selectedIds.length}/{MAX_SLOTS} selected
          </span>
        )}
      </div>
      <div className="anima-panel-body">
        {loading && (
          <p className="font-mono text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            Loading roster...
          </p>
        )}

        {error && (
          <p className="font-mono text-xs text-red-400 text-center py-4">{error}</p>
        )}

        {!loading && !error && spirits.length === 0 && (
          <p className="font-body text-sm italic" style={{ color: 'var(--text-muted)' }}>
            No spirits in wallet — fresh swarm will be created
          </p>
        )}

        {!loading && spirits.length > 0 && (
          <>
            <p className="font-mono text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
              Select up to {MAX_SLOTS}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {spirits.map(s => {
                const selected = selectedIds.includes(s.objectId);
                const specColor = SPEC_COLORS[s.specialization] || 'var(--text-muted)';
                const specIcon = SPEC_ICONS[s.specialization] || '●';
                const status = STATUS_DOT[s.status] || STATUS_DOT[0];
                const atCap = selectedIds.length >= MAX_SLOTS && !selected;

                return (
                  <button
                    key={s.objectId}
                    type="button"
                    onClick={() => toggleSelect(s.objectId)}
                    disabled={atCap}
                    className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-lg text-center transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: selected ? 'rgba(212,160,82,0.12)' : 'var(--bg-elevated)',
                      border: selected ? '2px solid var(--gold-bright)' : '1px solid var(--gold-dim)',
                      boxShadow: selected ? '0 0 12px var(--gold-glow), inset 0 0 8px rgba(212,160,82,0.08)' : 'none',
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative">
                      {s.avatarBlobId ? (
                        <img
                          src={getAvatarUrl(s.avatarBlobId)}
                          alt={s.name}
                          className="w-11 h-11 rounded-full object-cover"
                          style={{
                            border: `2px solid ${specColor}`,
                            boxShadow: selected ? `0 0 10px ${specColor}60` : 'none',
                          }}
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-header text-base"
                          style={{
                            background: `${specColor}18`,
                            border: `2px solid ${specColor}60`,
                            color: specColor,
                          }}
                        >
                          {s.name?.[0] || '?'}
                        </div>
                      )}
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                        style={{
                          background: status.color,
                          borderColor: 'var(--bg-elevated)',
                          boxShadow: `0 0 4px ${status.color}80`,
                        }}
                        title={status.label}
                      />
                    </div>

                    {/* Name */}
                    <span
                      className="font-header text-xs leading-tight truncate w-full"
                      style={{ color: selected ? 'var(--gold-bright)' : 'var(--text-primary)' }}
                    >
                      {s.name}
                    </span>

                    {/* Spec */}
                    <span
                      className="font-mono uppercase tracking-wider"
                      style={{ color: specColor, fontSize: '0.6rem' }}
                    >
                      {specIcon} {s.specialization}
                    </span>

                    {/* Stats */}
                    <div
                      className="flex flex-wrap justify-center gap-x-1.5 font-mono"
                      style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}
                    >
                      <span>G{s.generation}</span>
                      <span>{s.gamesPlayed}gp</span>
                      <span>{s.totalKills}k</span>
                      {s.reincarnationCount > 0 && (
                        <span style={{ color: '#c084fc' }}>
                          {'✦'}{s.reincarnationCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
