import { useState, useEffect, useRef } from 'react';

const TYPE_STYLES = {
  BATTLE:         { icon: '⚔', color: '#ef4444', label: 'Battle' },
  DECREE:         { icon: '📜', color: '#d4a052', label: 'Decree' },
  SCOUT:          { icon: '👁', color: '#3b82f6', label: 'Scout' },
  BETRAYAL:       { icon: '🗡', color: '#f97316', label: 'Betrayal' },
  ALLIANCE:       { icon: '🤝', color: '#22c55e', label: 'Alliance' },
  DEATH_WITNESS:  { icon: '💀', color: '#a855f7', label: 'Death' },
  ENCOUNTER:      { icon: '◈',  color: '#06b6d4', label: 'Encounter' },
  GRUDGE_FORMED:  { icon: '🔥', color: '#ef4444', label: 'Grudge' },
  FEAR_ACQUIRED:  { icon: '💀', color: '#a855f7', label: 'Fear' },
  TRAUMA_ACQUIRED:{ icon: '⚡', color: '#fbbf24', label: 'Trauma' },
  INSUBORDINATE:  { icon: '⛓',  color: '#f97316', label: 'Insubordinate' },
  INSUBORDINATION:{ icon: '⛓',  color: '#f97316', label: 'Refuses Order' },
};

export default function MemoryTimeline({ events, gameState, playerId }) {
  const [memoryEvents, setMemoryEvents] = useState([]);
  const [filter, setFilter] = useState('all');
  const scrollRef = useRef(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    if (!events?.length) return;
    const newMemEvents = [];
    for (const evt of events) {
      if (evt.type === 'memory_event') {
        newMemEvents.push(evt);
      }
      if (evt.type === 'spirit_dialog' && evt.dialogType === 'INSUBORDINATION') {
        newMemEvents.push({
          type: 'memory_event',
          subtype: 'INSUBORDINATION',
          spiritId: evt.sourceId,
          spiritName: evt.sourceName,
          text: evt.text,
          dramatic: true,
          timestamp: evt.timestamp,
        });
      }
    }
    if (newMemEvents.length > 0) {
      setMemoryEvents(prev => {
        const seen = new Set(prev.map(e => `${e.spiritId}-${e.subtype}-${e.timestamp}`));
        const deduped = newMemEvents.filter(e => !seen.has(`${e.spiritId}-${e.subtype}-${e.timestamp}`));
        return deduped.length > 0 ? [...prev, ...deduped].slice(-200) : prev;
      });
    }
  }, [events]);

  useEffect(() => {
    if (autoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [memoryEvents]);

  function handleScroll() {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScroll.current = scrollHeight - scrollTop - clientHeight < 40;
  }

  const filtered = filter === 'all'
    ? memoryEvents
    : filter === 'dramatic'
      ? memoryEvents.filter(e => e.dramatic)
      : filter === 'mine'
        ? memoryEvents.filter(e => e.playerId === playerId)
        : memoryEvents;

  const totalMemories = Object.values(gameState?.spirits || {})
    .reduce((sum, s) => sum + (s.memoryLedger?.length || 0), 0);
  const totalGrudges = Object.values(gameState?.spirits || {})
    .filter(s => s.behaviorRules && Object.keys(s.behaviorRules.grudges || {}).length > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Stats bar */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(107,114,128,0.3)',
        display: 'flex',
        gap: 16,
        fontSize: 11,
        fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        <span style={{ color: '#2dd4bf' }}>
          <span style={{ color: 'var(--text-muted)' }}>Memories</span> {totalMemories}
        </span>
        <span style={{ color: '#ef4444' }}>
          <span style={{ color: 'var(--text-muted)' }}>Grudges</span> {totalGrudges}
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Events {memoryEvents.length}
        </span>
      </div>

      {/* Filters */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        gap: 4,
        flexShrink: 0,
      }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'dramatic', label: 'Dramatic' },
          { id: 'mine', label: 'My Swarm' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '2px 8px',
            fontSize: 10,
            fontFamily: 'monospace',
            borderRadius: 4,
            border: `1px solid ${filter === f.id ? 'rgba(45,212,191,0.4)' : 'transparent'}`,
            background: filter === f.id ? 'rgba(45,212,191,0.1)' : 'transparent',
            color: filter === f.id ? '#2dd4bf' : 'var(--text-muted)',
            cursor: 'pointer',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 8px',
        }}
      >
        {filtered.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 16px',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>🧠</div>
            <div>{filter === 'dramatic' ? 'No dramatic events yet' : 'No memory events yet'}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              {filter === 'dramatic'
                ? 'Grudges, fears, and trauma appear after repeated battles'
                : 'Memories form from battles, decrees, and encounters'}
            </div>
          </div>
        )}

        {filtered.map((evt, i) => {
          const style = TYPE_STYLES[evt.subtype] || TYPE_STYLES.ENCOUNTER;
          const isMine = evt.playerId === playerId;
          const age = gameState?._tickCount
            ? `T${evt.tick || '?'}`
            : '';

          return (
            <div key={`${evt.timestamp}-${i}`} style={{
              display: 'flex',
              gap: 8,
              padding: '6px 4px',
              borderBottom: '1px solid rgba(107,114,128,0.1)',
              opacity: evt.dramatic ? 1 : 0.75,
            }}>
              {/* Timeline dot */}
              <div style={{
                width: 20,
                textAlign: 'center',
                flexShrink: 0,
                fontSize: 12,
              }}>
                {style.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {evt.dramatic && (
                  <div style={{
                    fontSize: 9,
                    fontFamily: 'monospace',
                    letterSpacing: '0.1em',
                    color: style.color,
                    fontWeight: 700,
                    marginBottom: 1,
                  }}>
                    {style.label.toUpperCase()}
                  </div>
                )}
                <div style={{
                  fontSize: 12,
                  color: evt.dramatic ? 'var(--text-primary)' : 'var(--text-secondary)',
                  lineHeight: 1.35,
                }}>
                  <span style={{ color: isMine ? '#2dd4bf' : style.color, fontWeight: 600 }}>
                    {evt.spiritName}
                  </span>
                  {' '}
                  <span>{evt.text?.replace(evt.spiritName, '').trim() || style.label}</span>
                </div>
              </div>

              {/* Timestamp */}
              <div style={{
                fontSize: 9,
                fontFamily: 'monospace',
                color: 'var(--text-muted)',
                flexShrink: 0,
                paddingTop: 2,
              }}>
                {age}
              </div>
            </div>
          );
        })}
      </div>

      {/* Walrus footer */}
      <div style={{
        padding: '8px 12px',
        borderTop: '1px solid rgba(45,212,191,0.2)',
        background: 'rgba(45,212,191,0.04)',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#2dd4bf',
        textAlign: 'center',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}>
        <span style={{ fontSize: 13 }}>🦭</span>
        Memories persist on <span style={{ fontWeight: 700 }}>Walrus</span> across games
      </div>
    </div>
  );
}
