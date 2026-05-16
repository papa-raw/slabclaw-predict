import { neighbors, hexId, axialDistance } from './hexMath.js';

/**
 * A* pathfinding on hex grid. Returns array of hex IDs from start to goal (inclusive).
 * Returns null if no path exists.
 */
export function findPath(startHexId, goalHexId, hexMap, opts = {}) {
  const { avoidOcean = true, maxSteps = 30 } = opts;

  const start = hexMap[startHexId];
  const goal = hexMap[goalHexId];
  if (!start || !goal) return null;
  if (startHexId === goalHexId) return [startHexId];

  const openSet = new Map();
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();

  gScore.set(startHexId, 0);
  fScore.set(startHexId, heuristic(start, goal));
  openSet.set(startHexId, fScore.get(startHexId));

  while (openSet.size > 0) {
    const current = getLowest(openSet);
    if (current === goalHexId) return reconstructPath(cameFrom, current);

    openSet.delete(current);
    const currentHex = hexMap[current];
    if (!currentHex) continue;

    const adj = neighbors({ q: currentHex.q, r: currentHex.r });
    for (const n of adj) {
      const nId = hexId(n.q, n.r);
      const nHex = hexMap[nId];
      if (!nHex) continue;
      if (avoidOcean && nHex.terrain === 'ocean') continue;

      const moveCost = terrainCost(nHex.terrain);
      const tentativeG = (gScore.get(current) ?? Infinity) + moveCost;

      if (tentativeG < (gScore.get(nId) ?? Infinity)) {
        cameFrom.set(nId, current);
        gScore.set(nId, tentativeG);
        const f = tentativeG + heuristic(nHex, goal);
        fScore.set(nId, f);
        openSet.set(nId, f);
      }
    }

    if (gScore.size > maxSteps * 6) break;
  }

  return null;
}

/**
 * Returns the next hex to move to on the path from current to goal.
 * Returns null if already there or no path.
 */
export function getNextStep(currentHexId, goalHexId, hexMap, opts) {
  const path = findPath(currentHexId, goalHexId, hexMap, opts);
  if (!path || path.length < 2) return null;
  return path[1];
}

/**
 * Returns distance in hops between two hexes (ignoring terrain).
 */
export function hexDistance(hexIdA, hexIdB, hexMap) {
  const a = hexMap[hexIdA];
  const b = hexMap[hexIdB];
  if (!a || !b) return Infinity;
  return axialDistance({ q: a.q, r: a.r }, { q: b.q, r: b.r });
}

/**
 * Find the hex containing a specific spirit by ID.
 */
export function findSpiritHex(spiritId, hexMap) {
  for (const [hId, hex] of Object.entries(hexMap)) {
    if (hex.spiritIds?.includes(spiritId)) return hId;
  }
  return null;
}

function heuristic(a, b) {
  return axialDistance({ q: a.q, r: a.r }, { q: b.q, r: b.r });
}

function terrainCost(terrain) {
  switch (terrain) {
    case 'mountain': return 2;
    case 'tundra': return 1.5;
    case 'volcanic': return 1.5;
    default: return 1;
  }
}

function getLowest(openSet) {
  let lowest = null;
  let lowestF = Infinity;
  for (const [id, f] of openSet) {
    if (f < lowestF) { lowestF = f; lowest = id; }
  }
  return lowest;
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    path.unshift(current);
  }
  return path;
}
