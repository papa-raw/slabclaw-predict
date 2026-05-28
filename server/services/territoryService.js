import { neighbors, axialDistance } from '../../lib/hexMath.js';

export function validateMovement(spirit, targetHexId, gameState) {
  const currentHex = gameState.map.hexes[spirit.hexId];
  const targetHex = gameState.map.hexes[targetHexId];
  if (!currentHex || !targetHex) return { valid: false, reason: 'Invalid hex' };

  const dist = axialDistance(
    { q: currentHex.q, r: currentHex.r },
    { q: targetHex.q, r: targetHex.r }
  );
  if (dist !== 1) return { valid: false, reason: 'Not adjacent' };

  return { valid: true };
}

export function getControlledHexes(playerId, gameState) {
  return Object.values(gameState.map.hexes).filter(h => h.controller === playerId);
}

export function getPlayerTerritoryPercent(playerId, gameState) {
  const total = Object.keys(gameState.map.hexes).length;
  const controlled = getControlledHexes(playerId, gameState).length;
  return Math.round((controlled / total) * 100);
}

export function claimHex(hexId, playerId, gameState) {
  const hex = gameState.map.hexes[hexId];
  if (!hex) return;
  const prevController = hex.controller;
  if (prevController === playerId) return; // already owned
  hex.controller = playerId;
  if (prevController && prevController !== playerId) {
    if (gameState.players[prevController]) {
      gameState.players[prevController].hexesControlled = Math.max(
        0,
        (gameState.players[prevController].hexesControlled || 0) - 1
      );
    }
  }
  if (gameState.players[playerId]) {
    gameState.players[playerId].hexesControlled =
      (gameState.players[playerId].hexesControlled || 0) + 1;
  }
}

export function findRetreatHex(spirit, gameState) {
  const currentHex = gameState.map.hexes[spirit.hexId];
  if (!currentHex) return null;
  const adj = neighbors({ q: currentHex.q, r: currentHex.r });

  for (const a of adj) {
    const hex = Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r);
    if (hex && (hex.controller === spirit.playerId || hex.controller === null)) {
      return hex.id;
    }
  }
  return null; // surrounded — spirit dies
}
