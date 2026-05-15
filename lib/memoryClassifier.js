const SPEC_THRESHOLD = 30; // XP needed to specialize
const SPEC_DOMINANCE = 1.5; // must be 1.5x higher than second-highest

export function evaluateSpecialization(spirit) {
  const xp = {
    warrior: spirit.combatXP || 0,
    scout: spirit.explorationXP || 0,
    gatherer: spirit.socialXP || 0,
    sage: spirit.wisdomXP || 0,
  };

  const sorted = Object.entries(xp).sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;

  if (top[1] < SPEC_THRESHOLD) {
    return spirit.specialization || 'generalist';
  }
  if (second && top[1] < second[1] * SPEC_DOMINANCE) {
    return spirit.specialization || 'generalist';
  }

  spirit.specialization = top[0];
  return top[0];
}

export function addXP(spirit, type, amount) {
  switch (type) {
    case 'combat': spirit.combatXP = (spirit.combatXP || 0) + amount; break;
    case 'exploration': spirit.explorationXP = (spirit.explorationXP || 0) + amount; break;
    case 'social': spirit.socialXP = (spirit.socialXP || 0) + amount; break;
    case 'wisdom': spirit.wisdomXP = (spirit.wisdomXP || 0) + amount; break;
  }
  spirit.specialization = evaluateSpecialization(spirit);
}

export function getSpecBonuses(specialization) {
  const bonuses = {
    warrior: { attackMult: 2, defenseMult: 1.5, memoryMult: 0.5, moveMult: 1 },
    scout: { attackMult: 1, defenseMult: 0.5, memoryMult: 1, moveMult: 2 },
    gatherer: { attackMult: 0.5, defenseMult: 1, memoryMult: 2, moveMult: 1 },
    sage: { attackMult: 0.5, defenseMult: 0.5, memoryMult: 1, moveMult: 1, spawnBonus: 2 },
    generalist: { attackMult: 1, defenseMult: 1, memoryMult: 1, moveMult: 1 },
  };
  return bonuses[specialization] || bonuses.generalist;
}
