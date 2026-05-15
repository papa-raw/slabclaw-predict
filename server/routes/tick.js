import { Router } from 'express';
import { resolveTimers } from '../services/timerService.js';
import { runSpiritDecisions } from '../services/spiritDecisionService.js';
import { accumulateMemories } from '../services/memoryGenService.js';
import { checkWinCondition } from '../services/winService.js';
import { broadcast } from '../services/wsService.js';

const router = Router();

let getGameState;
export function setGameStateGetter(fn) { getGameState = fn; }

// POST /api/tick/advance — manual tick advance (for demo / testing)
// Force-resolves all current timers immediately, then triggers a decision cycle
router.post('/advance', async (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  if (state.status !== 'active') return res.status(400).json({ error: 'Game not active' });

  // Expire all timers immediately
  for (const timer of state.activeTimers) {
    timer.completesAt = Date.now() - 1;
  }

  // Run a manual tick cycle
  const events = await resolveTimers(state);
  accumulateMemories(state);

  // Force spirits to make decisions now (reset lastDecision)
  for (const spirit of Object.values(state.spirits)) {
    if (spirit.alive && !spirit.currentAction) {
      spirit._lastDecision = 0;
    }
  }
  runSpiritDecisions(state);

  const winner = checkWinCondition(state);
  if (winner) {
    state.status = 'finished';
    state.winner = winner;
    events.push({ type: 'game_over', winner });
  }

  broadcast(state, events);
  res.json({ message: 'Tick advanced', eventsGenerated: events.length });
});

// POST /api/tick/fast-forward — advance N ticks rapidly (for demo video)
// Resolves timers multiple times, seeding new decisions between rounds
router.post('/fast-forward', async (req, res) => {
  const { ticks = 10 } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  if (state.status !== 'active') return res.status(400).json({ error: 'Game not active' });

  const allEvents = [];

  for (let i = 0; i < ticks; i++) {
    // Expire all timers
    for (const timer of state.activeTimers) {
      timer.completesAt = Date.now() - 1;
    }

    const events = await resolveTimers(state);
    accumulateMemories(state);
    allEvents.push(...events);

    // Reset decision timers so spirits act each round
    for (const spirit of Object.values(state.spirits)) {
      if (spirit.alive && !spirit.currentAction) {
        spirit._lastDecision = 0;
      }
    }
    runSpiritDecisions(state);

    // Yield to event loop so fire-and-forget decisions settle and start their timers
    await new Promise(resolve => setTimeout(resolve, 1));

    const winner = checkWinCondition(state);
    if (winner) {
      state.status = 'finished';
      state.winner = winner;
      allEvents.push({ type: 'game_over', winner });
      break;
    }
  }

  broadcast(state, allEvents);
  res.json({ message: `Fast-forwarded ${ticks} ticks`, eventsGenerated: allEvents.length });
});

export default router;
