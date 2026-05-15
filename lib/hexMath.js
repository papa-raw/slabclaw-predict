export function cubeToAxial(cube) { return { q: cube.q, r: cube.r }; }
export function axialToCube(hex) { return { q: hex.q, r: hex.r, s: -hex.q - hex.r }; }
export function cubeDistance(a, b) { return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s)); }
export function axialDistance(a, b) { return cubeDistance(axialToCube(a), axialToCube(b)); }
const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
export function neighbors(hex) { return DIRECTIONS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r })); }
export function hexToPixel(hex, size) {
  const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
  const y = size * (3 / 2 * hex.r);
  return { x, y };
}
export function pixelToHex(point, size) {
  const q = (Math.sqrt(3) / 3 * point.x - 1 / 3 * point.y) / size;
  const r = (2 / 3 * point.y) / size;
  return hexRound({ q, r });
}
function hexRound(hex) {
  const cube = axialToCube(hex);
  let rq = Math.round(cube.q); let rr = Math.round(cube.r); let rs = Math.round(cube.s);
  const dq = Math.abs(rq - cube.q); const dr = Math.abs(rr - cube.r); const ds = Math.abs(rs - cube.s);
  if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}
export function generateHexGrid(radius) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) { hexes.push({ q, r, id: hexId(q, r) }); }
  }
  return hexes;
}
export function hexId(q, r) { return String((q + 10) * 100 + (r + 10)); }
export function startingPositions(radius, playerCount) {
  const positions = [];
  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    const q = Math.round(radius * Math.cos(angle));
    const r = Math.round(radius * Math.sin(angle));
    positions.push({ q, r, id: hexId(q, r) });
  }
  return positions;
}
