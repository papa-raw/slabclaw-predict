function truncId(id) {
  if (!id || id.length <= 16) return id || '';
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

export default function OnchainFooter({ chainInfo }) {
  if (!chainInfo) return null;

  const suiExplorer = chainInfo.explorers?.sui || 'https://suiscan.xyz/testnet/object/';

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-6 px-6 py-2"
      style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--gold-dim)' }}
    >
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--spirit)' }} />
        <span style={{ color: 'var(--text-muted)' }}>Sui testnet —</span>
        <a
          href={`${suiExplorer}${chainInfo.contracts.package.id}`}
          target="_blank" rel="noopener noreferrer"
          className="underline"
          style={{ color: 'var(--spirit-dim)' }}
        >
          Package
        </a>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: chainInfo.storageMode === 'testnet' ? 'var(--spirit-bright)' : 'var(--gold-bright)' }}
        />
        <span style={{ color: 'var(--text-muted)' }}>Walrus testnet —</span>
        <a
          href={`${suiExplorer}${chainInfo.memwal.registry.id}`}
          target="_blank" rel="noopener noreferrer"
          className="underline"
          style={{ color: 'var(--spirit-dim)' }}
        >
          Memory Registry
        </a>
      </div>
      {chainInfo.stats && (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2dd4bf' }} />
          <span style={{ color: '#2dd4bf' }}>
            {chainInfo.stats.totalCaptainMemories || 0} captain memories
          </span>
          <span style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--text-muted)' }}>
            {chainInfo.stats.totalMemories || 0} on MemWal
          </span>
        </div>
      )}
    </div>
  );
}
