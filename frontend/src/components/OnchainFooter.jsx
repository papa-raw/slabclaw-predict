function truncId(id) {
  if (!id || id.length <= 16) return id || '';
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

export default function OnchainFooter({ chainInfo }) {
  if (!chainInfo) return null;

  return (
    <div
      className="shrink-0 flex items-center justify-center gap-6 px-6 py-2"
      style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--gold-dim)' }}
    >
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--spirit)' }} />
        <span className="font-mono" style={{ color: 'var(--text-muted)' }}>Sui {chainInfo.network}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: chainInfo.storageMode === 'testnet' ? 'var(--spirit-bright)' : 'var(--gold-bright)' }}
        />
        <span className="font-mono" style={{ color: 'var(--text-muted)' }}>Walrus {chainInfo.storageMode}</span>
      </div>
      <a
        href={`${chainInfo.explorers?.sui || 'https://suiscan.xyz/testnet/object/'}${chainInfo.contracts.package.id}`}
        target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-mono underline"
        style={{ color: 'var(--spirit-dim)' }}
      >
        Package {truncId(chainInfo.contracts.package.id)}
      </a>
      <a
        href={`${chainInfo.explorers?.sui || 'https://suiscan.xyz/testnet/object/'}${chainInfo.memwal.registry.id}`}
        target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-mono underline"
        style={{ color: 'var(--spirit-dim)' }}
      >
        MemWal {truncId(chainInfo.memwal.registry.id)}
      </a>
      <div className="h-3 w-px" style={{ background: 'var(--gold-dim)' }} />
      <a href="https://docs.wal.app/" target="_blank" rel="noopener noreferrer"
        className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Walrus Docs</a>
      <a href="https://docs.memwal.ai" target="_blank" rel="noopener noreferrer"
        className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>MemWal Docs</a>
      <a href="https://docs.sui.io" target="_blank" rel="noopener noreferrer"
        className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>Sui Docs</a>
    </div>
  );
}
