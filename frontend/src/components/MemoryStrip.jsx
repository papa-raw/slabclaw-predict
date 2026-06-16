import { useMemoryProvenance } from '../hooks/useLiveConsensus';

// Relative "Xm/Xh ago" from an ISO timestamp.
const ago = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const h = ms / 3_600_000;
  return h < 1 ? `${Math.max(1, Math.round(ms / 60_000))}m ago` : `${Math.round(h)}h ago`;
};

/// The live "don't trust, verify" proof of the Walrus thesis: the serving node
/// rebuilt its entire agent memory from a Walrus blob whose pointer it resolved
/// onchain. Renders only when the live node answers — never faked.
export default function MemoryStrip() {
  const mem = useMemoryProvenance();
  if (!mem) return null;

  const when = ago(mem.restoredAt);
  const short = mem.blobId.length > 13 ? `${mem.blobId.slice(0, 10)}…` : mem.blobId;

  return (
    <a
      href={`https://walruscan.com/testnet/blob/${mem.blobId}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Verify the memory snapshot on Walruscan"
      className="group mb-5 flex items-center gap-2 rounded-lg border border-sc-border bg-sc-card/60 px-3 py-2 hover:border-sc-accent/40 transition-colors"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-sc-yes shrink-0 animate-pulse" />
      <span className="min-w-0 text-[11px] text-sc-dim leading-snug">
        <span className="text-white font-medium">Agent memory restored from Walrus</span>
        {' — '}{mem.files} files
        {mem.pointerSource === 'onchain' && <> · pointer resolved onchain</>}
        {when && <> · {when}</>}
      </span>
      <span className="ml-auto hidden sm:flex items-center gap-1 text-[10px] font-mono text-sc-muted group-hover:text-sc-accent shrink-0">
        {short} <span aria-hidden>↗</span>
      </span>
    </a>
  );
}
