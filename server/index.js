import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import tickRoutes, { setGameStateGetter as setTickGetter } from './routes/tick.js';
import gameRoutes, { setGameStateGetter as setGameGetter, setRestartCallback } from './routes/game.js';
import essenceRoutes, { setGameStateGetter as setEssenceGetter } from './routes/essence.js';
import { initWebSocket } from './services/wsService.js';
import { initGame, restartGame } from './services/tickEngine.js';
import { createInitialGameState } from './services/gameInit.js';
import { getProvider } from './services/llmProxy.js';
import { getStorageMode } from './services/walrusService.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
}));
app.use(express.json());

app.use('/api/tick', tickRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/essence', essenceRoutes);

// Initialize WebSocket
initWebSocket(server);

// Initialize game state
const gameState = await createInitialGameState();
setTickGetter(() => gameState);
setGameGetter(() => gameState);
setEssenceGetter(() => gameState);
initGame(gameState);

// Wire restart callback — updates all route getters when game is reset
setRestartCallback(async () => {
  return restartGame([setTickGetter, setGameGetter, setEssenceGetter]);
});

server.listen(PORT, () => {
  console.log(`\n[Anima Swarm] Server + WebSocket running on port ${PORT}`);
  console.log(`  LLM:    ${getProvider()}`);
  console.log(`  Walrus: ${getStorageMode()}`);
  console.log(`  MemWal: ${process.env.MEMWAL_DELEGATE_KEY ? 'live' : 'local cache'}`);
  console.log(`  Sui:    ${process.env.PACKAGE_ID ? 'real (testnet)' : 'mock (no PACKAGE_ID)'}`);
  console.log(`  CORS:   ${process.env.CORS_ORIGIN || 'open (dev)'}\n`);
});
