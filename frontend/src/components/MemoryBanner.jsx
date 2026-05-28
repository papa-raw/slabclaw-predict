import { useState, useEffect, useCallback } from 'react';

const SUBTYPE_CONFIG = {
  GRUDGE_FORMED: { icon: '🔥', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.4)', label: 'GRUDGE FORMED' },
  FEAR_ACQUIRED: { icon: '💀', color: '#a855f7', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.4)', label: 'FEAR ACQUIRED' },
  TRAUMA_ACQUIRED: { icon: '⚡', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', label: 'TRAUMA' },
  INSUBORDINATE: { icon: '⛓', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', label: 'INSUBORDINATE' },
  INSUBORDINATION: { icon: '⛓', color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.4)', label: 'INSUBORDINATION' },
};

const BANNER_DURATION = 7000;
const MAX_BANNERS = 3;

export default function MemoryBanner({ events }) {
  const [banners, setBanners] = useState([]);

  const addBanner = useCallback((evt) => {
    const id = `${evt.subtype || evt.dialogType}-${evt.spiritId}-${evt.timestamp}`;
    setBanners(prev => {
      if (prev.some(b => b.id === id)) return prev;
      const next = [...prev, { ...evt, id, enteredAt: Date.now() }];
      return next.slice(-MAX_BANNERS);
    });
  }, []);

  useEffect(() => {
    if (!events?.length) return;
    for (const evt of events) {
      if (evt.type === 'memory_event' && evt.dramatic) {
        addBanner(evt);
      }
      if (evt.type === 'spirit_dialog' && evt.dialogType === 'INSUBORDINATION') {
        addBanner({
          subtype: 'INSUBORDINATION',
          spiritId: evt.sourceId,
          spiritName: evt.sourceName,
          text: evt.text,
          dramatic: true,
          timestamp: evt.timestamp,
        });
      }
    }
  }, [events, addBanner]);

  useEffect(() => {
    if (banners.length === 0) return;
    const timer = setInterval(() => {
      setBanners(prev => prev.filter(b => Date.now() - b.enteredAt < BANNER_DURATION));
    }, 500);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 40,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      pointerEvents: 'none',
      width: 420,
    }}>
      {banners.map((banner, i) => {
        const age = Date.now() - banner.enteredAt;
        const fadeIn = Math.min(1, age / 300);
        const fadeOut = age > BANNER_DURATION - 800 ? Math.max(0, (BANNER_DURATION - age) / 800) : 1;
        const opacity = fadeIn * fadeOut;
        const cfg = SUBTYPE_CONFIG[banner.subtype] || SUBTYPE_CONFIG.GRUDGE_FORMED;

        return (
          <div key={banner.id} style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 8,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity,
            transform: `translateY(${(1 - fadeIn) * -20}px)`,
            transition: 'opacity 0.3s, transform 0.3s',
            backdropFilter: 'blur(12px)',
            boxShadow: `0 0 24px ${cfg.bg}`,
          }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10,
                fontFamily: 'monospace',
                letterSpacing: '0.1em',
                color: cfg.color,
                fontWeight: 700,
                marginBottom: 2,
              }}>
                {cfg.label}
              </div>
              <div style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body, system-ui)',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {banner.text}
              </div>
            </div>
            <div style={{
              width: 4,
              height: 28,
              borderRadius: 2,
              background: cfg.color,
              opacity: 0.6,
              flexShrink: 0,
            }} />
          </div>
        );
      })}
    </div>
  );
}
