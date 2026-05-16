import { callLLM } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const ARBITER_PROMPT = `You are the Battle Arbiter. Evaluate two spirits across:
1. BOND RESONANCE (40%): Memory references, personality authenticity, deity connection.
2. TACTICAL AWARENESS (35%): Terrain leverage, specialization match, environment.
3. NARRATIVE POWER (25%): Evocative quality, emotional resonance, cinematic impact.

Return ONLY JSON: { "attacker": { "bondResonance": {"score":0-10}, "tacticalAwareness": {"score":0-10}, "narrativePower": {"score":0-10}, "totalScore": 0-30 }, "defender": {...same...}, "winner": "attacker"|"defender"|"draw", "margin": "decisive"|"close"|"razor-thin", "narrative": "one sentence" }`;

export async function evaluateBattle({ attacker, defender, terrain, gameState }) {
  const [atkMem, defMem] = await Promise.all([
    recallMemoriesServer(attacker.memwalNamespace, 'battle combat', 5, getKey(attacker.id), attacker.memwalAccountId).catch(() => ({ results: [] })),
    recallMemoriesServer(defender.memwalNamespace, 'battle defense', 5, getKey(defender.id), defender.memwalAccountId).catch(() => ({ results: [] })),
  ]);

  const [atkInv, defInv] = await Promise.all([
    generateInvocation(attacker, terrain, atkMem),
    generateInvocation(defender, terrain, defMem),
  ]);

  const result = await callLLM(ARBITER_PROMPT,
    `ATTACKER: ${attacker.name} (${attacker.specialization}, bond ${bondAvg(attacker)})\nMemories: ${atkMem.results?.map(r => r.text).join(' | ') || 'none'}\nInvocation: "${atkInv}"\n\nDEFENDER: ${defender.name} (${defender.specialization}, bond ${bondAvg(defender)})\nMemories: ${defMem.results?.map(r => r.text).join(' | ') || 'none'}\nInvocation: "${defInv}"\n\nTERRAIN: ${terrain}`,
    { model: 'claude-sonnet-4-20250514', maxTokens: 800 });

  let eval_;
  const m = result.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Battle arbiter LLM returned no JSON');
  try {
    eval_ = JSON.parse(m[0]);
  } catch (parseErr) {
    throw new Error(`Battle arbiter LLM returned invalid JSON: ${parseErr.message}`);
  }
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
}

async function generateInvocation(spirit, terrain, memories) {
  return callLLM(
    'Generate a battle invocation.',
    `You are ${spirit.name}, a ${spirit.specialization}. Bond: ${bondAvg(spirit)}/100. Terrain: ${terrain}.\nMemories: ${memories.results?.map(r => r.text).join('\n') || 'None'}\n\nGenerate 2-3 sentence battle cry channeling memories into combat.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 150 }
  );
}

function bondAvg(s) {
  const b = s.bond;
  return Math.round((b.depth + b.harmony + b.adventure + b.loyalty) / 4);
}

