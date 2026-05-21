export const AFFINITIES = {
  flame:  { color: '#ef4444', glow: '#fca5a5', icon: '🔥', strong: 'growth', weak: 'tide',   terrains: ['volcanic', 'desert'] },
  tide:   { color: '#3b82f6', glow: '#93c5fd', icon: '🌊', strong: 'flame',  weak: 'growth', terrains: ['ocean', 'coastal'] },
  stone:  { color: '#78716c', glow: '#d6d3d1', icon: '🪨', strong: 'wind',   weak: 'shadow', terrains: ['mountain', 'tundra'] },
  wind:   { color: '#a3e635', glow: '#d9f99d', icon: '💨', strong: 'shadow', weak: 'stone',  terrains: ['grassland'] },
  shadow: { color: '#a855f7', glow: '#d8b4fe', icon: '🌑', strong: 'stone',  weak: 'wind',   terrains: ['forest'] },
  growth: { color: '#22c55e', glow: '#86efac', icon: '🌿', strong: 'tide',   weak: 'flame',  terrains: ['forest', 'coastal'] },
};

export const AFFINITY_NAMES = Object.keys(AFFINITIES);

export const CAPTAIN_CLASSES = {
  vanguard:     { icon: '⚔', aura: 'atkBoost',      auraValue: 0.20, radius: 2, label: 'Vanguard',     desc: '+20% swarmling attack in radius' },
  ranger:       { icon: '⌖', aura: 'speedBoost',    auraValue: 0.30, radius: 3, label: 'Ranger',       desc: '+30% swarmling move speed in radius' },
  harvester:    { icon: '◈', aura: 'gatherBoost',   auraValue: 0.40, radius: 2, label: 'Harvester',    desc: '+40% swarmling gather rate in radius' },
  oracle:       { icon: '✦', aura: 'dodgeBoost',    auraValue: 0.15, radius: 2, label: 'Oracle',       desc: 'Swarmlings in radius dodge 15% of attacks' },
  shieldbearer: { icon: '🛡', aura: 'defBoost',      auraValue: 0.25, radius: 2, label: 'Shieldbearer', desc: '+25% swarmling defense in radius' },
  shadowstep:   { icon: '🗡', aura: 'terrainIgnore', auraValue: 1.00, radius: 2, label: 'Shadowstep',   desc: 'Swarmlings ignore terrain penalties' },
  warden:       { icon: '🏰', aura: 'hexLock',       auraValue: 1.00, radius: 2, label: 'Warden',       desc: 'Territory requires battle to flip' },
  bard:         { icon: '🎵', aura: 'bondBoost',     auraValue: 0.15, radius: 2, label: 'Bard',         desc: '+15% bond growth for all spirits in radius' },
};

export const CLASS_NAMES = Object.keys(CAPTAIN_CLASSES);

export const SWARMLING_NAME_POOLS = {
  flame:  ['Cinder', 'Spark', 'Blaze', 'Flare', 'Scorch', 'Pyre', 'Coal', 'Sear', 'Char', 'Ignite'],
  tide:   ['Ripple', 'Foam', 'Surge', 'Eddy', 'Current', 'Wake', 'Swell', 'Ebb', 'Flow', 'Spray'],
  stone:  ['Shard', 'Flint', 'Gravel', 'Slate', 'Ridge', 'Boulder', 'Crag', 'Pebble', 'Ore', 'Quartz'],
  wind:   ['Breeze', 'Gust', 'Zephyr', 'Draft', 'Squall', 'Vortex', 'Updraft', 'Wisp', 'Gale', 'Tempest'],
  shadow: ['Shade', 'Dusk', 'Gloom', 'Veil', 'Wraith', 'Haze', 'Murk', 'Pall', 'Dim', 'Null'],
  growth: ['Fern', 'Moss', 'Bloom', 'Root', 'Sprout', 'Vine', 'Thorn', 'Leaf', 'Stem', 'Bud'],
};

export function getAffinityAdvantage(attacker, defender) {
  const atk = AFFINITIES[attacker];
  if (!atk) return 0;
  if (atk.strong === defender) return 15;
  if (atk.weak === defender) return -15;
  return 0;
}

export function getAffinityFromTerrain(terrain) {
  for (const [name, data] of Object.entries(AFFINITIES)) {
    if (data.terrains.includes(terrain)) return name;
  }
  return 'shadow';
}

export function affinityMatchesTerrain(affinity, terrain) {
  const aff = AFFINITIES[affinity];
  return aff ? aff.terrains.includes(terrain) : false;
}

function bondAvg(spirit) {
  const b = spirit.bond || {};
  return ((b.depth || 0) + (b.harmony || 0) + (b.adventure || 0) + (b.loyalty || 0)) / 4;
}

export function assignCaptainClass(spirit) {
  const scores = {
    vanguard:     (spirit.combatXP || 0) * 2,
    ranger:       (spirit.explorationXP || 0) * 2,
    harvester:    (spirit.socialXP || 0) * 1.5,
    oracle:       (spirit.wisdomXP || 0) * 2,
    shieldbearer: bondAvg(spirit) * 0.5,
    warden:       (spirit.hexesClaimed || 0) * 3,
    bard:         (spirit.whispersReceived || 0) * 2,
    shadowstep:   (spirit.combatXP || 0) + (spirit.explorationXP || 0),
  };
  return Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];
}

export function pickSwarmlingName(affinity, usedNames) {
  const pool = SWARMLING_NAME_POOLS[affinity] || SWARMLING_NAME_POOLS.shadow;
  const available = pool.filter(n => !usedNames.has(n));
  if (available.length === 0) {
    const suffix = Math.floor(Math.random() * 99) + 1;
    return `${pool[Math.floor(Math.random() * pool.length)]}-${suffix}`;
  }
  return available[Math.floor(Math.random() * available.length)];
}

export const PROMOTION_THRESHOLDS = {
  swarmling_to_captain: 10,
  captain_to_hero: 10,
};

export const LEGENDARY_DEED_XP = {
  kill_captain_or_hero: 3,
  survive_5_battles: 2,
  claim_10_hexes: 2,
  receive_20_whispers: 1,
  spawn_3_children: 1,
};
