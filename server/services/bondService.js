/**
 * bondService.js — Bond relationship mechanics.
 * Tracks Depth / Harmony / Adventure / Loyalty between deity and spirit.
 * Ported from Spiritus bondService with simplified action set.
 */

const BOND_ACTIONS = {
  chat:        { depth: 3, harmony: 1, adventure: 0, loyalty: 1 },
  whisperReceived: { depth: 0, harmony: 2, adventure: 1, loyalty: 0 },
  battleWin:   { depth: 1, harmony: 0, adventure: 5, loyalty: 3 },
  battleLoss:  { depth: 2, harmony: 0, adventure: 3, loyalty: -1 },
  spawn:       { depth: 0, harmony: 3, adventure: 2, loyalty: 5 },
  explore:     { depth: 0, harmony: 0, adventure: 4, loyalty: 0 },
  gather:      { depth: 1, harmony: 2, adventure: 0, loyalty: 0 },
  childDied:   { depth: 3, harmony: -2, adventure: 0, loyalty: 2 },
};

/**
 * Apply a bond action to a spirit's bond stats.
 * Mutates spirit.bond in place. Returns the updated bond.
 *
 * @param {object} spirit - spirit object with bond property
 * @param {string} action - key in BOND_ACTIONS
 * @returns {object} updated bond
 */
export function applyBondAction(spirit, action) {
  const effects = BOND_ACTIONS[action];
  if (!effects) return spirit.bond;

  spirit.bond.depth    = clamp(spirit.bond.depth    + effects.depth,    0, 100);
  spirit.bond.harmony  = clamp(spirit.bond.harmony  + effects.harmony,  0, 100);
  spirit.bond.adventure = clamp(spirit.bond.adventure + effects.adventure, 0, 100);
  spirit.bond.loyalty  = clamp(spirit.bond.loyalty  + effects.loyalty,  0, 100);

  return spirit.bond;
}

/**
 * Calculate the average of all 4 bond dimensions.
 *
 * @param {object} spirit
 * @returns {number} 0–100
 */
export function bondAverage(spirit) {
  return Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );
}

/**
 * Get the bond tier name and numeric tier from an average bond value.
 *
 * @param {number} avg - bond average 0–100
 * @returns {{ name: string, tier: number }}
 */
export function getBondTier(avg) {
  if (avg >= 80) return { name: 'Devoted',  tier: 4 };
  if (avg >= 60) return { name: 'Trusted',  tier: 3 };
  if (avg >= 40) return { name: 'Familiar', tier: 2 };
  if (avg >= 20) return { name: 'Cautious', tier: 1 };
  return { name: 'Stranger', tier: 0 };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
