import { useState, useRef, useEffect } from 'react';
import { SPEC_COLORS, getPlayerColor } from '@lib/terrainTypes.js';

/**
 * SpiritPanel — Spirit detail sidebar with chat interface.
 *
 * Props:
 *   spirit     - spirit object from gameState.spirits
 *   gameState  - full (sanitized) game state
 *   playerId   - current player's ID
 *   onClose    - called when the panel's close button is clicked
 *   messages   - persisted message history for this spirit (lifted to App.jsx)
 *   onMessages - setter to update message history
 */
export default function SpiritPanel({ spirit, gameState, playerId, onClose, messages = [], onMessages, onWhispers, onChainOps, chainInfo }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [lastChainOps, setLastChainOps] = useState(null);
  const messagesEndRef = useRef(null);
  const isMine = spirit?.playerId === playerId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!spirit) return null;

  const bondAvg = Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );

  const spiritColor = SPEC_COLORS[spirit.specialization] || getPlayerColor(spirit.playerId, gameState) || '#6b7280';

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || sending || !isMine) return;

    const userMsg = input.trim();
    setInput('');
    onMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spiritId: spirit.id,
          message: userMsg,
          playerId,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      onMessages(prev => [...prev, { role: 'spirit', text: data.response }]);

      if (data.chainOps?.length) {
        onChainOps?.(data.chainOps);
        setLastChainOps(data.chainOps);
        const stored = data.chainOps.filter(o => o.type === 'memory_store').length;
        const recalled = data.chainOps.find(o => o.type === 'memory_recall')?.count || 0;
        const parts = [];
        if (recalled > 0) parts.push(`${recalled} memories recalled`);
        if (stored > 0) parts.push(`${stored} stored on MemWal`);
        if (parts.length) {
          onMessages(prev => [...prev, { role: 'chain', text: parts.join(' · ') }]);
        }
      }

      if (data.whispers?.length) {
        onMessages(prev => [...prev, {
          role: 'system',
          text: `Whispers propagated to ${data.whispers.length} spirit${data.whispers.length > 1 ? 's' : ''}`,
        }]);
        onWhispers?.(data.whispers.map(w => ({ from: spirit.id, to: w.to })));
      }
    } catch (err) {
      console.error('[SpiritPanel] Chat error:', err);
      onMessages(prev => [...prev, { role: 'system', text: `Failed: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  }

  // Bond tier label
  function getBondTierName(avg) {
    if (avg >= 80) return 'Devoted';
    if (avg >= 60) return 'Trusted';
    if (avg >= 40) return 'Familiar';
    if (avg >= 20) return 'Cautious';
    return 'Stranger';
  }

  const bondDimensions = [
    { label: 'Depth',     value: spirit.bond.depth,     color: '#8b5cf6' },
    { label: 'Harmony',   value: spirit.bond.harmony,   color: '#22c55e' },
    { label: 'Adventure', value: spirit.bond.adventure, color: '#f97316' },
    { label: 'Loyalty',   value: spirit.bond.loyalty,   color: '#3b82f6' },
  ];

  const xpBars = [
    { label: 'COM', value: spirit.combatXP,      color: '#dc2626' },
    { label: 'EXP', value: spirit.explorationXP, color: '#2563eb' },
    { label: 'SOC', value: spirit.socialXP,      color: '#16a34a' },
    { label: 'WIS', value: spirit.wisdomXP,      color: '#9333ea' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Spirit Header */}
      <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Spirit Avatar */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ background: spiritColor }}
            >
              {spirit.name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2 leading-tight">
                <h2 className="font-display text-base font-semibold text-white">
                  {spirit.name}
                </h2>
                {spirit.reincarnationCount > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/40 flex-shrink-0">
                    ✦ {spirit.reincarnationCount}x
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                {spirit.specialization} · gen {spirit.generation} · {getBondTierName(bondAvg)} ({bondAvg})
              </p>
              <p className="text-[10px] text-teal-400/60 font-mono flex items-center gap-1 mt-0.5">
                <span className="w-1 h-1 rounded-full bg-teal-400/60" />
                {spirit.memoryCount || 0} memories on MemWal
                {spirit.memwalNamespace && (
                  <span className="text-gray-600">· {spirit.memwalNamespace}</span>
                )}
              </p>
              {spirit.previousNames?.length > 0 && (() => {
                const pastNames = spirit.previousNames.filter(n => n !== spirit.name);
                return pastNames.length > 0 ? (
                  <p className="text-[10px] text-purple-400/70 italic mt-0.5">
                    was {pastNames.slice(0, 2).join(', ')}
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700/50 transition-colors"
            aria-label="Close spirit panel"
          >
            &times;
          </button>
        </div>

        {/* XP Bars */}
        <div className="grid grid-cols-4 gap-1 mb-3">
          {xpBars.map(xp => (
            <div key={xp.label} className="text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">{xp.label}</div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (xp.value / 30) * 100)}%`,
                    background: xp.color,
                  }}
                />
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">{xp.value}</div>
            </div>
          ))}
        </div>

        {/* Bond Dimensions */}
        <div className="grid grid-cols-4 gap-1 mb-2">
          {bondDimensions.map(dim => (
            <div key={dim.label} className="text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">{dim.label.slice(0, 3).toUpperCase()}</div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${dim.value}%`, background: dim.color }}
                />
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">{dim.value}</div>
            </div>
          ))}
        </div>

        {/* Current Action */}
        {spirit.currentAction && (
          <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {spirit.currentAction.type}
            {spirit.currentAction.completesAt && (
              <span className="ml-auto font-mono">
                {Math.max(0, Math.round((spirit.currentAction.completesAt - Date.now()) / 1000))}s
              </span>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            {isMine ? `Whisper to ${spirit.name}...` : `Observing ${spirit.name}`}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-amber-500/20 text-amber-100'
                  : msg.role === 'chain'
                  ? 'bg-teal-900/30 text-teal-400 text-[10px] font-mono border border-teal-700/30'
                  : msg.role === 'system'
                  ? 'bg-gray-700/30 text-gray-400 italic text-xs'
                  : 'bg-gray-700/50 text-gray-200'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — own spirit only */}
      {isMine ? (
        <form onSubmit={sendMessage} className="p-3 border-t border-gray-700/50 flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Whisper to your spirit..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              disabled={sending}
              autoFocus
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3 border-t border-gray-700/50 flex-shrink-0">
          <p className="text-xs text-gray-500 italic text-center">
            Observing {spirit.name} — not your spirit
          </p>
        </div>
      )}
    </div>
  );
}
