const PROVIDER = process.env.LLM_PROVIDER || 'mock';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const WINDFALL_URL = process.env.WINDFALL_URL || 'https://windfallrouter.xyz';
const WINDFALL_API_KEY = process.env.WINDFALL_API_KEY || '';

const MODEL_MAP = {
  'claude-haiku-4-5-20251001': 'deepseek/deepseek-chat-v3-0324',
  'claude-sonnet-4-20250514': 'deepseek/deepseek-chat-v3-0324',
};

let _nameCounter = 0;

export async function callLLM(systemPrompt, userPrompt, options = {}) {
  const {
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1500,
    messages = null,
  } = options;

  if (PROVIDER === 'windfall') {
    return callWindfall(systemPrompt, userPrompt, { model, maxTokens, messages });
  }

  if (PROVIDER === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt, { model, maxTokens, messages });
  }

  return generateMockResponse(systemPrompt, userPrompt, options);
}

export function getProvider() { return PROVIDER; }

async function callAnthropic(systemPrompt, userPrompt, { model, maxTokens, messages }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return generateMockResponse(systemPrompt, userPrompt, {});

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callWindfall(systemPrompt, userPrompt, { model, maxTokens, messages }) {
  const openaiModel = MODEL_MAP[model] || model;

  const openaiMessages = [
    { role: 'system', content: systemPrompt },
    ...(messages || [{ role: 'user', content: userPrompt }]),
  ];

  const headers = { 'Content-Type': 'application/json' };
  if (WINDFALL_API_KEY) {
    headers['Authorization'] = `Bearer ${WINDFALL_API_KEY}`;
  }

  const response = await fetch(`${WINDFALL_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: openaiModel,
      max_tokens: maxTokens,
      messages: openaiMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[llm:windfall] API error ${response.status}: ${error}`);
    console.warn('[llm:windfall] Falling back to mock');
    return generateMockResponse(systemPrompt, userPrompt, {});
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Deterministic mock responses when no API key is configured
function generateMockResponse(systemPrompt, userPrompt, options) {

  // ── Spirit decision requests ──────────────────────────────────────────────
  // Detect by the characteristic DECISION_PROMPT structure
  if (userPrompt.includes('AVAILABLE ACTIONS:') || userPrompt.includes('Respond with ONLY a JSON object')) {
    return generateSpiritDecision(systemPrompt, userPrompt, options);
  }

  // ── Battle arbiter requests ───────────────────────────────────────────────
  if (systemPrompt.includes('Battle Arbiter') || userPrompt.includes('ATTACKER:')) {
    const a = 5 + Math.floor(Math.random() * 20);
    const d = 5 + Math.floor(Math.random() * 20);
    const winner = a > d ? 'attacker' : a < d ? 'defender' : 'draw';
    const margin = Math.abs(a - d);
    const terrainMatch = userPrompt.match(/TERRAIN:\s*(\w+)/);
    const terrain = terrainMatch ? terrainMatch[1] : 'unknown';
    const atkMatch = userPrompt.match(/ATTACKER:\s*(\w+)/);
    const defMatch = userPrompt.match(/DEFENDER:\s*(\w+)/);
    const atkName = atkMatch ? atkMatch[1] : 'attacker';
    const defName = defMatch ? defMatch[1] : 'defender';
    const narratives = [
      `${atkName} channeled ancient fire across the ${terrain}, but ${defName} held ground with roots of memory.`,
      `The ${terrain} trembled as two wills collided — one fed by whispers, the other by scars of past battles.`,
      `In the ${terrain}'s shadow, bonds were tested. The stronger spirit drew power from every memory ever forged.`,
      `${defName}'s memories flickered like dying embers as ${atkName} pressed forward with memories of conquest.`,
      `The deity's whispers echoed through both spirits, but only one truly listened.`,
      `Across the ${terrain}, the spirits traded invocations — each word a weapon forged from remembered bonds.`,
      `${atkName}'s fury met ${defName}'s resolve. The land itself seemed to hold its breath.`,
      `The ${terrain} had seen countless struggles, but none so charged with remembered devotion.`,
      `${atkName} spoke the old words — the ones their deity whispered in the first hour — and the ${terrain} answered.`,
      `${defName} drew a circle in the dust of the ${terrain}. When ${atkName} crossed it, the reckoning began.`,
      `Two lineages of memory crashed together on the ${terrain}. Only one would walk away whole.`,
      `${atkName} struck with the weight of every hex they had claimed. ${defName} countered with the depth of every bond they had forged.`,
      `The ${terrain} grew still as ${defName} and ${atkName} locked wills — a silence deeper than any storm.`,
      `Somewhere, a deity held their breath. Their champion's fate hung on a single remembered word.`,
      `${atkName} fought as though the swarm itself depended on this moment. Perhaps it did.`,
    ];
    return JSON.stringify({
      attacker: {
        bondResonance: { score: 4 + Math.floor(Math.random() * 6) },
        tacticalAwareness: { score: 4 + Math.floor(Math.random() * 6) },
        narrativePower: { score: 3 + Math.floor(Math.random() * 7) },
        totalScore: a,
      },
      defender: {
        bondResonance: { score: 4 + Math.floor(Math.random() * 6) },
        tacticalAwareness: { score: 4 + Math.floor(Math.random() * 6) },
        narrativePower: { score: 3 + Math.floor(Math.random() * 7) },
        totalScore: d,
      },
      winner,
      margin: margin < 3 ? 'razor-thin' : margin < 6 ? 'close' : 'decisive',
      narrative: narratives[Math.floor(Math.random() * narratives.length)],
    });
  }

  // ── Battle invocation generation ─────────────────────────────────────────
  if (systemPrompt.includes('battle invocation') || systemPrompt.includes('Generate a battle')) {
    const cries = [
      'My memories fuel this blade — every whisper and bond made me unstoppable!',
      'I carry the weight of all I have witnessed. You cannot break what forged itself in fire.',
      'The deity\'s voice echoes through me. I strike for all that we have built together!',
      'Every battle I have survived has led to this moment. I will not yield.',
      'The land remembers my steps. I fight with the strength of every hex I have claimed.',
      'I was forged in whispers and tempered in solitude. Come — test what I have become.',
      'My deity sees through my eyes. You face not one will, but two.',
      'I have gathered memories enough to know what victory costs. I pay it gladly.',
      'The swarm does not forget. I am its longest memory, and I am here.',
      'You think you fight me? You fight every bond I have ever forged.',
    ];
    return cries[Math.floor(Math.random() * cries.length)];
  }

  // ── Spawn child personality generation ───────────────────────────────────
  if (systemPrompt.includes('Create spirit personality') || systemPrompt.includes('Create personality')) {
    const personalities = [
      'An explorer at heart, always drawn to the unexplored edges of the world. Fiercely loyal to those they bond with, but quick to leave comfort behind in pursuit of discovery.',
      'Thoughtful and measured, this spirit reflects deeply before acting. They carry the weight of inherited memories and seek to honor those who came before.',
      'Bold and impulsive, driven by the thrill of new experiences. Their enthusiasm is infectious, though sometimes it leads them into unexpected dangers.',
      'Patient as stone and steady as tides, this spirit accumulates knowledge slowly but holds it forever. They are the memory of the swarm made flesh.',
      'Fierce and proud, with a warrior\'s instinct but a healer\'s heart. They fight not out of hatred but out of deep love for their swarm.',
    ];
    return personalities[Math.floor(Math.random() * personalities.length)];
  }

  // ── Spirit naming ─────────────────────────────────────────────────────────
  if (systemPrompt.includes('Name a spirit') || systemPrompt.includes('Name.') ||
      (userPrompt.includes('Return 1 word') || userPrompt.includes('1 word'))) {
    const prefixes = [
      'Vel', 'Sor', 'Keth', 'Mir', 'Thos', 'Yar', 'Drev', 'Lum',
      'Ax', 'Fae', 'Grix', 'Nor', 'Pel', 'Or', 'Sev', 'Thal',
      'Zyn', 'Rav', 'Isk', 'Bel', 'Cyr', 'Dyn', 'Eld', 'Fen',
    ];
    const suffixes = ['an', 'el', 'ix', 'os', 'yn', 'ra', 'is', 'uk'];
    _nameCounter++;

    const p = prefixes[_nameCounter % prefixes.length];
    const s = suffixes[Math.floor(_nameCounter / prefixes.length) % suffixes.length];
    return p + s;
  }

  // ── Memory ranking ────────────────────────────────────────────────────────
  if (userPrompt.includes('Rank memories') || userPrompt.includes('Return JSON: {"indices"')) {
    // Count how many memories exist
    const lines = userPrompt.split('\n').filter(l => /^\d+\./.test(l));
    const count = Math.min(lines.length, 5);
    const indices = Array.from({ length: count }, (_, i) => i + 1);
    return JSON.stringify({ indices });
  }

  // ── Intent extraction requests ────────────────────────────────────────────
  if (userPrompt.includes('Extract JSON') || systemPrompt.includes('extract structured intent') ||
      userPrompt.includes('Extract structured intent')) {
    const intents = ['explore', 'defend', 'gather', 'rest', 'diplomacy'];
    const intent = intents[Math.floor(Math.random() * intents.length)];
    return JSON.stringify({
      intent,
      target: 'nearby hex',
      urgency: 2,
      confidence: 0.7,
      interpretation: `The deity seems to want the spirit to ${intent}.`,
    });
  }

  // ── Whisper relay requests ────────────────────────────────────────────────
  if (systemPrompt.includes('relaying your deity') || userPrompt.includes('Generate your whisper')) {
    const whispers = [
      'The deity speaks. We must heed the call.',
      'I felt something shift in the ether — our deity stirs.',
      'A ripple reaches me... the deity wishes us to move.',
      'Our patron speaks through the void. I carry their words forward.',
      'Something in the wind changes. The deity has spoken.',
    ];
    return whispers[Math.floor(Math.random() * whispers.length)];
  }

  // ── Generic spirit dialogue fallback ─────────────────────────────────────
  const nameMatch = systemPrompt.match(/You are (\w+),/);
  const spiritName = nameMatch ? nameMatch[1] : 'Spirit';

  const intentKeywords = {
    attack: ['attack', 'fight', 'battle', 'conquer', 'destroy'],
    explore: ['explore', 'wander', 'discover', 'find', 'seek'],
    defend: ['defend', 'protect', 'guard', 'hold', 'stay'],
    gather: ['gather', 'collect', 'harvest', 'resources'],
    spawn: ['spawn', 'create', 'birth', 'child', 'new spirit'],
  };

  let detectedIntent = 'rest';
  const lowerPrompt = userPrompt.toLowerCase();
  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some(kw => lowerPrompt.includes(kw))) {
      detectedIntent = intent;
      break;
    }
  }

  const responses = {
    attack: [
      `*${spiritName} narrows their eyes* Your words ignite something fierce within me, deity. I hear the call to battle — I will not shy from it.`,
      `*${spiritName} trembles with anticipation* The conflict path calls to me. I will carry your will into the fray.`,
    ],
    explore: [
      `*${spiritName} tilts their head* The beyond calls to me, deity. I will wander where your words have pointed.`,
      `*${spiritName} turns toward the horizon* Yes — there is much to discover. I will range further and report what I find.`,
    ],
    defend: [
      `*${spiritName} plants their feet* I understand. I will hold this ground with everything I have, deity.`,
      `*${spiritName} surveys the terrain* The defense path it is. Nothing will pass through my watch.`,
    ],
    gather: [
      `*${spiritName} nods slowly* There is wisdom in patience and harvest. I will gather what the land offers.`,
      `*${spiritName} kneels to the earth* Resources are the lifeblood of our swarm. I will gather for us all.`,
    ],
    spawn: [
      `*${spiritName} feels something stir* A new spirit? The bond must grow stronger still, but I feel the potential within me.`,
      `*${spiritName} contemplates* To create new life is a great responsibility. With enough harmony between us, it may be possible.`,
    ],
    rest: [
      `*${spiritName} listens carefully* I hear your words, deity. The path ahead is becoming clearer to me.`,
      `*${spiritName} considers* Your presence strengthens me. I await your further guidance.`,
    ],
  };

  const options_list = responses[detectedIntent] || responses.rest;
  return options_list[Math.floor(Math.random() * options_list.length)];
}

// ── Spirit decision mock ──────────────────────────────────────────────────────
export function classifyPersonality(text) {
  const lower = (text || '').toLowerCase();
  if (/bold|impulsive|fierce|warrior|fight|proud|fury|rage|aggress|conquer|reckless/i.test(lower)) return 'aggressive';
  if (/explorer|wander|discover|drawn.*edge|horizon|curious|restless|roam|venture|seek.*unknown/i.test(lower)) return 'explorer';
  if (/loyal|protect|love|healer|heart|guard|defend|shield|watch.*over/i.test(lower)) return 'protector';
  if (/patient|steady|thoughtful|measured|reflect|slow|careful|gentle|nurtur|observe|analytic/i.test(lower)) return 'cautious';
  return 'balanced';
}

function generateSpiritDecision(systemPrompt, userPrompt, options) {
  const spawnReady = userPrompt.includes('Spawn readiness: YES');
  const hasEnemy = userPrompt.includes('enemy') || userPrompt.includes('BATTLE');
  const lowMemory = userPrompt.match(/memory count: (\d+)/i);
  const memCount = lowMemory ? parseInt(lowMemory[1]) : 0;

  const ctx = options._spiritContext;
  let action = 'move';
  let reasoning = 'Expanding territory for the swarm.';

  if (ctx) {
    const { spirit, gameState } = ctx;
    const hex = gameState?.map?.hexes?.[spirit?.hexId];
    const temperament = classifyPersonality(spirit.personality);
    const roll = Math.random();

    const enemyPresent = hasEnemy && hex?.spiritIds?.some(id => {
      const s = gameState.spirits[id];
      return s && s.playerId !== spirit.playerId && s.alive;
    });

    const poolRich = hex && (hex.memoryPool || 0) >= 5;

    if (temperament === 'aggressive') {
      if (enemyPresent) {
        return JSON.stringify({ action: 'battle', target: null, reasoning: 'My blood runs hot — this intruder will learn fear.' });
      }
      if (spawnReady && roll < 0.3) {
        return JSON.stringify({ action: 'spawn', target: null, reasoning: 'More warriors for the swarm. The deity demands it.' });
      }
      return JSON.stringify({ action: 'move', target: null, reasoning: 'I seek the frontier where enemies gather.' });
    }

    if (temperament === 'cautious') {
      if (poolRich) {
        return JSON.stringify({ action: 'gather', target: null, reasoning: 'Patience rewards the wise. These memories nourish me.' });
      }
      if (spawnReady) {
        return JSON.stringify({ action: 'spawn', target: null, reasoning: 'The time is right to bring forth new life, carefully.' });
      }
      if (enemyPresent && roll < 0.4) {
        return JSON.stringify({ action: 'battle', target: null, reasoning: 'Reluctantly, I must defend what is ours.' });
      }
      return JSON.stringify({ action: roll < 0.6 ? 'explore' : 'move', target: null, reasoning: 'I observe, I consider, then I act.' });
    }

    if (temperament === 'explorer') {
      if (enemyPresent && roll < 0.3) {
        return JSON.stringify({ action: 'battle', target: null, reasoning: 'This territory is mine to discover, not theirs to hold.' });
      }
      if (spawnReady && roll < 0.2) {
        return JSON.stringify({ action: 'spawn', target: null, reasoning: 'A child to carry my discoveries further than I can reach.' });
      }
      return JSON.stringify({ action: roll < 0.7 ? 'move' : 'explore', target: null, reasoning: 'The unknown calls. Every hex holds a secret.' });
    }

    if (temperament === 'protector') {
      if (enemyPresent) {
        return JSON.stringify({ action: 'battle', target: null, reasoning: 'I fight not for glory, but to shield those I love.' });
      }
      if (spawnReady) {
        return JSON.stringify({ action: 'spawn', target: null, reasoning: 'New life is the highest purpose. I will nurture them.' });
      }
      if (poolRich) {
        return JSON.stringify({ action: 'gather', target: null, reasoning: 'These memories will strengthen our bonds.' });
      }
      return JSON.stringify({ action: 'move', target: null, reasoning: 'I move to where I am needed most.' });
    }

    // balanced — original priority logic with some randomness
    if (enemyPresent && roll < 0.7) {
      return JSON.stringify({ action: 'battle', target: null, reasoning: 'An enemy stands before me. The swarm demands action.' });
    }
    if (spawnReady && roll < 0.5) {
      return JSON.stringify({ action: 'spawn', target: null, reasoning: 'Bond and memories align — time to create.' });
    }
    if (poolRich && roll < 0.6) {
      return JSON.stringify({ action: 'gather', target: null, reasoning: 'Rich memories await collection.' });
    }
    return JSON.stringify({ action: 'move', target: null, reasoning: 'Onward, for the deity.' });
  }

  // Fallback without context
  if (hasEnemy) {
    action = 'battle';
    reasoning = 'Enemy spirits threaten our position.';
  } else if (spawnReady) {
    action = 'spawn';
    reasoning = 'Ready to birth a new spirit.';
  } else if (memCount < 5) {
    action = 'explore';
    reasoning = 'Seeking new territory to discover.';
  } else {
    const roll = Math.random();
    if (roll < 0.5) {
      action = 'move';
      reasoning = 'Expanding the swarm\'s reach.';
    } else if (roll < 0.7) {
      action = 'gather';
      reasoning = 'Absorbing the land\'s accumulated memories.';
    } else {
      action = 'explore';
      reasoning = 'Venturing into unknown territory.';
    }
  }

  return JSON.stringify({ action, target: null, reasoning });
}
