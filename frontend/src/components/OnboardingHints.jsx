import { useState, useEffect } from 'react';

const HINTS = [
  {
    id: 'welcome',
    title: 'Welcome, Deity',
    body: 'You command an AI swarm through whispers. Click any of your spirits on the map to begin.',
    position: 'center',
    delay: 500,
  },
  {
    id: 'click-spirit',
    title: 'Whisper to Your Spirits',
    body: 'Your spirits glow with your color. Click one to open the spirit panel and send commands through conversation.',
    position: 'center',
    delay: 0,
  },
  {
    id: 'memory',
    title: 'Memory is Power',
    body: 'Every whisper is stored on MemWal (Walrus). Spirits recall memories to make decisions. Watch the Chain Activity panel for live storage operations.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto max-w-sm mx-4 bg-gray-900/95 border border-amber-500/30 rounded-lg p-5 backdrop-blur-sm shadow-xl shadow-black/40">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <h3 className="font-header text-sm text-amber-400 uppercase tracking-wider">{hint.title}</h3>
        </div>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">{hint.body}</p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-gray-600">{currentHint + 1}/{HINTS.length}</span>
          <div className="flex gap-2">
            <button onClick={skipAll}
              className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1 transition-colors">
              Skip
            </button>
            <button onClick={advance}
              className="text-xs text-amber-400 hover:text-amber-300 px-3 py-1 rounded border border-amber-500/30 hover:border-amber-500/60 transition-colors">
              {currentHint >= HINTS.length - 1 ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
