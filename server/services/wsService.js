import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Map(); // playerId → ws

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const playerId = new URL(req.url, 'http://localhost').searchParams.get('playerId');
    if (playerId) {
      clients.set(playerId, ws);
      ws.on('close', () => clients.delete(playerId));
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(playerId, msg);
      } catch {}
    });
  });
}

function handleMessage(playerId, msg) {
  console.log(`[ws] Client message from ${playerId}: ${msg.type || 'unknown'}`);
}

const PERSIST_TYPES = new Set([
  'battle_started', 'battle_resolved', 'swarmling_battle', 'spawn_started', 'spawn_complete',
  'spirit_died', 'territory_claimed', 'game_over',
  'explore_started', 'whisper_arrived', 'spirit_dialog', 'avatar_ready', 'promotion',
]);

export function broadcast(gameState, events) {
  if (events.length > 0) {
    gameState.events = gameState.events || [];
    const now = Date.now();
    for (const evt of events) {
      if (!evt.timestamp) evt.timestamp = now;
      if (PERSIST_TYPES.has(evt.type) && !gameState.events.includes(evt)) {
        gameState.events.push(evt);
      }
    }
    if (gameState.events.length > 200) gameState.events = gameState.events.slice(-200);
  }
  const payload = JSON.stringify({
    type: 'tick',
    state: sanitizeForClient(gameState),
    events,
  });
  for (const ws of clients.values()) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

export function sendToPlayer(playerId, data) {
  const ws = clients.get(playerId);
  if (ws?.readyState === 1) ws.send(JSON.stringify(data));
}

/**
 * Broadcast a state_change event to all connected clients.
 * Called when game status transitions (e.g. lobby → active).
 * Clients receiving this message will update their gameState and transition views.
 */
export function broadcastStateChange(gameState) {
  const payload = JSON.stringify({
    type: 'state_change',
    state: sanitizeForClient(gameState),
  });
  for (const ws of clients.values()) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

export function sanitizeForClient(gameState) {
  // Strip server-only fields (delegateKeys, etc.)
  const { spirits, ...rest } = gameState;
  const clientSpirits = {};
  for (const [id, s] of Object.entries(spirits)) {
    const { delegateKey, _lastDecision, _deityOrder, _captainOrder, _swarmDecree, _chosenByGod, _lastSwarmTick, _style, ...safe } = s;
    clientSpirits[id] = safe;
  }
  return { ...rest, spirits: clientSpirits };
}
