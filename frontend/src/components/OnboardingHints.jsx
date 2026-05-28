import { useState, useEffect } from 'react';

const HINTS = [
  {
    id: 'welcome',
    title: 'Persistent AI Memory on Walrus',
    body: 'AI spirits fight, form memories, and store them on Walrus. Grudges, fears, and trauma persist across games and shape future behavior.',
    position: 'center',
    delay: 500,
  },
  {
    id: 'click-spirit',
    title: 'Watch Memories Form',
    body: 'Click any spirit to inspect its stats and memory ledger. The Memory tab shows a live feed of all memory events across the battlefield.',
    position: 'center',
    delay: 0,
  },
  {
    id: 'memory',
    title: 'Memories Are the Gameplay',
    body: 'Captains who lose repeatedly form grudges and auto-attack. Witnesses of death develop fears. Trauma makes spirits refuse terrain. All stored on Walrus, loaded next game.',
    position: 'center',
    delay: 0,
  },
];

export default function OnboardingHints({ gameState, selectedSpirit, onDismissAll }) {
  const [currentHint, setCurrentHint] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (gameState?.status !== 'active') return;
    const t = setTimeout(() => setVisible(true), HINTS[0].delay);
    return () => clearTimeout(t);
  }, [gameState?.status, dismissed]);

  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (!visible || dismissed) return;
    const t = setTimeout(() => skipAll(), 8000);
    return () => clearTimeout(t);
  }, [visible, dismissed]);

  useEffect(() => {
    if (selectedSpirit && currentHint === 0) {
      advance();
    }
  }, [selectedSpirit]);

  function advance() {
    if (currentHint >= HINTS.length - 1) {
      setDismissed(true);
      setVisible(false);
      onDismissAll?.();
      return;
    }
    setCurrentHint(prev => prev + 1);
  }

  function skipAll() {
    setDismissed(true);
    setVisible(false);
    onDismissAll?.();
  }

  if (!visible || dismissed) return null;

  const hint = HINTS[currentHint];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={skipAll}>
      <div className="max-w-sm mx-4 bg-gray-900/95 border border-amber-500/30 rounded-lg p-5 backdrop-blur-sm shadow-xl shadow-black/40" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <h3 className="font-header text-sm text-amber-400 uppercase tracking-wider">{hint.title}</h3>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-primary)' }}>{hint.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{currentHint + 1}/{HINTS.length}</span>
          <div className="flex gap-2">
            <button onClick={skipAll}
              className="text-sm hover:text-gray-200 px-3 py-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              Skip
            </button>
            <button onClick={advance}
              className="text-sm text-amber-400 hover:text-amber-300 px-3 py-1 rounded border border-amber-500/30 hover:border-amber-500/60 transition-colors">
              {currentHint >= HINTS.length - 1 ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
