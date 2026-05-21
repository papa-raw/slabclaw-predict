import { callLLM } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';
import { getAffinityAdvantage, AFFINITIES, CAPTAIN_CLASSES } from '../../lib/classSystem.js';

const ARBITER_PROMPT = `You are the Battle Arbiter for a deity-controlled spirit swarm war. Evaluate two spirits across:
1. BOND RESONANCE (30%): Memory references, personality authenticity, deity connection.
2. TACTICAL AWARENESS (30%): Terrain leverage, elemental affinity, class abilities.
3. NARRATIVE POWER (20%): Evocative quality, emotional resonance, cinematic impact.
4. ELEMENTAL CLASH (20%): Affinity advantage wheel (flame>growth>stone>wind>shadow>growth cycle).

Return ONLY JSON: { "attacker": { "bondResonance": {"score":0-10}, "tacticalAwareness": {"score":0-10}, "narrativePower": {"score":0-10}, "elementalClash": {"score":0-10}, "totalScore": 0-40 }, "defender": {...same...}, "winner": "attacker"|"defender"|"draw", "margin": "decisive"|"close"|"razor-thin", "narrative": "one sentence battle description" }`;

export async function evaluateBattle({ attacker, defender, terrain, gameState }) {
  const [atkMem, defMem] = await Promise.all([
    recallMemoriesServer(attacker.memwalNamespace, 'battle combat', 5, getKey(attacker.id), attacker.memwalAccountId).catch(() => ({ results: [] })),
    recallMemoriesServer(defender.memwalNamespace, 'battle defense', 5, getKey(defender.id), defender.memwalAccountId).catch(() => ({ results: [] })),
  ]);

  try {
    const [atkInv, defInv] = await Promise.all([
      generateInvocation(attacker, terrain, atkMem),
      generateInvocation(defender, terrain, defMem),
    ]);

    const atkAff = attacker.affinity || 'shadow';
    const defAff = defender.affinity || 'shadow';
    const atkClass = attacker.captainClass ? CAPTAIN_CLASSES[attacker.captainClass] : null;
    const defClass = defender.captainClass ? CAPTAIN_CLASSES[defender.captainClass] : null;
    const affAdvantage = getAffinityAdvantage(atkAff, defAff);
    const affNote = affAdvantage > 0 ? `${atkAff} is STRONG against ${defAff}` : affAdvantage < 0 ? `${atkAff} is WEAK against ${defAff}` : 'neutral matchup';

    const result = await callLLM(ARBITER_PROMPT,
      `ATTACKER: ${attacker.name} (${attacker.tier} ${attacker.specialization}, ${atkAff} affinity${atkClass ? `, ${atkClass.label} class` : ''}, bond ${bondAvg(attacker)}, HP ${attacker.hp ?? 100})\nMemories: ${atkMem.results?.map(r => r.text).join(' | ') || 'none'}\nInvocation: "${atkInv}"\n\nDEFENDER: ${defender.name} (${defender.tier} ${defender.specialization}, ${defAff} affinity${defClass ? `, ${defClass.label} class` : ''}, bond ${bondAvg(defender)}, HP ${defender.hp ?? 100})\nMemories: ${defMem.results?.map(r => r.text).join(' | ') || 'none'}\nInvocation: "${defInv}"\n\nTERRAIN: ${terrain}\nELEMENTAL: ${affNote}`,
      { model: 'claude-sonnet-4-20250514', maxTokens: 800 });

    let eval_;
    const m = result.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Battle arbiter LLM returned no JSON');
    eval_ = JSON.parse(m[0]);
    if (!eval_.winner || !eval_.attacker || !eval_.defender) {
      throw new Error('Battle arbiter LLM returned incomplete evaluation');
    }

    const winner = eval_.winner === 'draw'
      ? (Math.random() > 0.5 ? 'attacker' : 'defender')
      : eval_.winner;

    return {
      winner,
      loser: winner === 'attacker' ? 'defender' : 'attacker',
      narrative: eval_.narrative,
      scores: { attacker: eval_.attacker, defender: eval_.defender },
      attackerInvocation: atkInv,
      defenderInvocation: defInv,
    };
  } catch (err) {
    console.warn(`[battle] LLM arbiter failed (${err.message}), using stat fallback`);
    return statFallbackBattle(attacker, defender);
  }
}

async function generateInvocation(spirit, terrain, memories) {
  const aff = spirit.affinity || 'shadow';
  const cls = spirit.captainClass ? CAPTAIN_CLASSES[spirit.captainClass]?.label : null;
  return callLLM(
    'Generate a battle invocation.',
    `You are ${spirit.name}, a ${spirit.tier} ${spirit.specialization} with ${aff} affinity${cls ? ` and ${cls} class` : ''}. Bond: ${bondAvg(spirit)}/100. Terrain: ${terrain}.\nMemories: ${memories.results?.map(r => r.text).join('\n') || 'None'}\n\nGenerate 2-3 sentence battle cry channeling your element and memories into combat.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 150 }
  );
}

function bondAvg(s) {
  const b = s.bond;
  return Math.round((b.depth + b.harmony + b.adventure + b.loyalty) / 4);
}

function statFallbackBattle(attacker, defender) {
  const SPEC_COMBAT = { warrior: 3, scout: 1, gatherer: 0, sage: 1, generalist: 1 };
  const TIER_BONUS = { hero: 15, captain: 5, swarmling: 0 };
  const affBonus = getAffinityAdvantage(attacker.affinity || 'shadow', defender.affinity || 'shadow');
  const atkScore = bondAvg(attacker) + (attacker.combatXP || 0) * 2 + (SPEC_COMBAT[attacker.specialization] || 0) * 5 + (TIER_BONUS[attacker.tier] || 0) + affBonus + Math.random() * 20;
  const defScore = bondAvg(defender) + (defender.combatXP || 0) * 2 + (SPEC_COMBAT[defender.specialization] || 0) * 5 + (TIER_BONUS[defender.tier] || 0) + Math.random() * 20;
  const winner = atkScore >= defScore ? 'attacker' : 'defender';
  const diff = Math.abs(atkScore - defScore);
  const margin = diff > 15 ? 'decisive' : diff > 5 ? 'close' : 'razor-thin';
  return {
    winner,
    loser: winner === 'attacker' ? 'defender' : 'attacker',
    narrative: `${winner === 'attacker' ? attacker.name : defender.name} prevails in a ${margin} clash.`,
    scores: { attacker: { totalScore: Math.round(atkScore) }, defender: { totalScore: Math.round(defScore) } },
    attackerInvocation: '',
    defenderInvocation: '',
  };
}

