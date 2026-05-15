import { useState } from 'react';
import WalletConnect from './WalletConnect.jsx';
import EssenceImport from './EssenceImport.jsx';

export default function Lobby({ playerId, gameState }) {
  const [ready, setReady] = useState(false);
  const [confirmedBlobId, setConfirmedBlobId] = useState(null);
  const [essencePreview, setEssencePreview] = useState(null); // preview data after confirm

  async function handleReady() {
    setReady(true);
    await fetch('/api/game/ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        ...(confirmedBlobId ? { blobId: confirmedBlobId } : {}),
      }),
    });
  }

  function handleEssenceConfirmed(blobId, preview) {
    setConfirmedBlobId(blobId);
    setEssencePreview(preview || null);
  }

  const playerCount = Object.values(gameState.players).filter(p => p.connected).length;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
      <div className="max-w-lg w-full space-y-8 text-center p-8">
        <div>
          <h1 className="text-4xl font-display text-amber-500 font-bold mb-2">Anima Swarm</h1>
          <p className="text-gray-400 text-sm">Deity-controlled AI strategy</p>
        </div>

        <div className="bg-gray-800/60 rounded-lg p-6 border border-gray-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Connected</span>
            <span className="text-amber-400 font-mono">{playerCount}/5</span>
          </div>
          <WalletConnect />
        </div>

        <div className={`bg-gray-800/40 rounded-lg p-4 border text-left space-y-2 transition-colors ${
          confirmedBlobId ? 'border-purple-700/50' : 'border-gray-700/30'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 uppercase tracking-wider font-mono">Your Swarm</p>
            {confirmedBlobId && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/40">
                ✦ Reincarnated
              </span>
            )}
          </div>
          {Object.values(gameState.spirits)
            .filter(s => s.playerId === playerId)
            .map(s => {
              // After essence confirm, mark the seed spirit as "Reborn"
              const isReborn = confirmedBlobId && s.generation === 0;
              // Find previous names from preview, excluding current name
              const rawPrev = essencePreview?.candidates?.[0]?.pastLifeNames || [];
              const prevNames = rawPrev.filter(n => n !== s.name);
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isReborn ? 'bg-purple-400' : 'bg-amber-500'}`} />
                  <span className={`font-header ${isReborn ? 'text-purple-200' : 'text-gray-300'}`}>{s.name}</span>
                  <span className="text-gray-600 text-xs">{s.specialization}</span>
                  {isReborn && (
                    <span className="text-[10px] font-mono text-purple-400">Reborn</span>
                  )}
                  {isReborn && prevNames.length > 0 && (
                    <span className="text-[10px] text-purple-600 italic truncate max-w-[100px]">
                      was {prevNames[0]}
                    </span>
                  )}
                </div>
              );
            })}
        </div>

        <EssenceImport onEssenceConfirmed={handleEssenceConfirmed} confirmedBlobId={confirmedBlobId} />

        <button
          onClick={handleReady}
          disabled={ready}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700
                     disabled:text-gray-500 rounded-lg text-white font-display text-lg
                     transition-colors"
        >
          {ready ? 'Waiting for others...' : 'Start Game'}
        </button>
      </div>
    </div>
  );
}
