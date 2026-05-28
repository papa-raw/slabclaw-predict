import { getAffinityAdvantage, CAPTAIN_CLASSES } from '../../lib/classSystem.js';

const SPEC_COMBAT = { warrior: 3, scout: 1, gatherer: 0, sage: 1, generalist: 1 };
const TIER_BONUS = { captain: 5, swarmling: 0 };

export async function evaluateBattle({ attacker, defender, terrain, gameState }) {
  const atkAff = attacker.affinity || 'shadow';
  const defAff = defender.affinity || 'shadow';
  const affBonus = getAffinityAdvantage(atkAff, defAff);

  const atkScore = computeCombatScore(attacker, defender, affBonus);
  const defScore = computeCombatScore(defender, attacker, -affBonus);

  const winner = atkScore >= defScore ? 'attacker' : 'defender';
  const diff = Math.abs(atkScore - defScore);
  const margin = diff > 15 ? 'decisive' : diff > 5 ? 'close' : 'razor-thin';

  const winnerSpirit = winner === 'attacker' ? attacker : defender;
  const loserSpirit = winner === 'attacker' ? defender : attacker;

  return {
    winner,
    loser: winner === 'attacker' ? 'defender' : 'attacker',
    narrative: `${winnerSpirit.name} overwhelms ${loserSpirit.name} in a ${margin} ${terrain} clash.`,
    scores: {
      attacker: { totalScore: Math.round(atkScore) },
      defender: { totalScore: Math.round(defScore) },
    },
    attackerInvocation: '',
    defenderInvocation: '',
  };
}

function computeCombatScore(spirit, opponent, affBonus) {
  const base = bondAvg(spirit)
    + (spirit.combatXP || 0) * 2
    + (SPEC_COMBAT[spirit.specialization] || 0) * 5
    + (TIER_BONUS[spirit.tier] || 0)
    + affBonus;

  const rules = spirit.behaviorRules;
  let memoryBonus = 0;
  if (rules) {
    memoryBonus += rules.veteranBonus * 20;

    if (rules.confidence[opponent.playerId]) {
      memoryBonus += Math.min(10, rules.confidence[opponent.playerId] * 2);
    }

    if (rules.grudges[opponent.playerId]) {
      memoryBonus += Math.min(8, rules.grudges[opponent.playerId] * 1.5);
    }

    if (rules.fears[opponent.playerId]) {
      memoryBonus -= Math.min(10, rules.fears[opponent.playerId] * 3);
    }
  }

  const hpFactor = (spirit.hp || 100) / (spirit.maxHp || 100);

  return (base + memoryBonus) * hpFactor + Math.random() * 20;
}

function bondAvg(s) {
  const b = s.bond;
  return Math.round((b.depth + b.harmony + b.adventure + b.loyalty) / 4);
}
