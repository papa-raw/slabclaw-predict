import { useState, useEffect } from 'react';
import WalletConnect from './WalletConnect.jsx';
import EssenceImport from './EssenceImport.jsx';
import { getAvatarUrl } from '@lib/avatarUrl.js';

function truncId(id) {
  if (!id || id.length <= 16) return id || '';
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

export default function Lobby({ playerId, gameState, chainInfo }) {
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
    <div className="h-screen flex flex-col bg-[#0a0e17] overflow-hidden">
      <div className="flex-1 flex flex-col max-w-lg w-full mx-auto px-6 py-4 overflow-y-auto">
        <div className="text-center mb-3">
          <h1 className="text-3xl font-display text-amber-500 font-bold">Anima Swarm</h1>
          <p className="text-gray-400 text-xs mt-1">Command AI spirits through whispers — memories persist on Walrus</p>
        </div>

        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50 space-y-2 mb-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Connected</span>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-mono">{playerCount}/{Object.keys(gameState.players).length}</span>
              <span className="text-gray-600 text-[10px] font-mono">AI fills remaining</span>
            </div>
          </div>
          <WalletConnect />
        </div>

        <div className={`bg-gray-800/40 rounded-lg p-3 border text-left space-y-1 mb-3 transition-colors ${
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
              const isReborn = confirmedBlobId && s.generation === 0;
              const rawPrev = essencePreview?.candidates?.[0]?.pastLifeNames || [];
              const prevNames = rawPrev.filter(n => n !== s.name);
              const candidate = essencePreview?.candidates?.find(c => c.pastLifeNames?.includes(s.name) || c.name === prevNames[0]);
              const avatarUrl = s.avatarBlobId ? getAvatarUrl(s.avatarBlobId) : (candidate?.avatarBlobId ? getAvatarUrl(candidate.avatarBlobId) : null);
              return (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={s.name} className="w-5 h-5 rounded-full object-cover border border-purple-700/40" />
                  ) : (
                    <div className={`w-2 h-2 rounded-full ${isReborn ? 'bg-purple-400' : 'bg-amber-500'}`} />
                  )}
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

        <div className="mb-3">
          <EssenceImport onEssenceConfirmed={handleEssenceConfirmed} confirmedBlobId={confirmedBlobId} />
        </div>

        {chainInfo && (
          <div className="bg-gray-800/30 rounded-lg px-3 py-2 border border-teal-800/30 text-left mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">On-Chain Infrastructure</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Package</span>
                <a href={`${chainInfo.explorers?.sui || 'https://suiscan.xyz/testnet/object/'}${chainInfo.contracts.package.id}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-blue-400 hover:text-blue-300 underline">{truncId(chainInfo.contracts.package.id)}</a>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">MemWal</span>
                <a href={`${chainInfo.explorers?.sui || 'https://suiscan.xyz/testnet/object/'}${chainInfo.memwal.registry.id}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-teal-400 hover:text-teal-300 underline">{truncId(chainInfo.memwal.registry.id)}</a>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Network</span>
                <span className="font-mono text-teal-400">{chainInfo.network}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Storage</span>
                <span className={`font-mono ${chainInfo.storageMode === 'testnet' ? 'text-green-400' : 'text-amber-400'}`}>
                  Walrus {chainInfo.storageMode}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 max-w-lg w-full mx-auto px-6 pb-4">
        <button
          onClick={handleReady}
          disabled={ready}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700
                     disabled:text-gray-500 rounded-lg text-white font-display text-lg
                     transition-colors"
        >
          {ready ? 'Starting...' : 'Begin'}
        </button>
      </div>
    </div>
  );
}
