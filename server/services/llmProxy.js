const PROVIDER = process.env.LLM_PROVIDER || 'windfall';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const WINDFALL_URL = process.env.WINDFALL_URL || 'https://windfallrouter.xyz';
const WINDFALL_API_KEY = process.env.WINDFALL_API_KEY || '';

const DEFAULT_MODEL = 'deepseek/deepseek-chat-v3-0324';
const BATTLE_MODEL = 'accounts/fireworks/models/kimi-k2p5';

const MODEL_MAP = {
  'claude-haiku-4-5-20251001': DEFAULT_MODEL,
  'claude-sonnet-4-20250514': BATTLE_MODEL,
};

// Rate limit tracking
let callsThisMinute = 0;
let minuteStart = Date.now();
const RATE_LIMIT = 50; // stay under 60/min with margin

function checkRateLimit() {
  const now = Date.now();
  if (now - minuteStart > 60_000) {
    callsThisMinute = 0;
    minuteStart = now;
  }
  return callsThisMinute < RATE_LIMIT;
}

export async function callLLM(systemPrompt, userPrompt, options = {}) {
  const {
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1500,
    messages = null,
    _retries = 2,
    _priority = 'normal', // 'high' for user chat, 'normal' for autonomous
  } = options;

  // Skip low-priority calls when near rate limit
  if (_priority !== 'high' && !checkRateLimit()) {
    throw new Error('Rate limit approaching — skipping background call');
  }

  callsThisMinute++;

  const callFn = PROVIDER === 'windfall'
    ? () => callWindfall(systemPrompt, userPrompt, { model, maxTokens, messages })
    : PROVIDER === 'anthropic'
      ? () => callAnthropic(systemPrompt, userPrompt, { model, maxTokens, messages })
      : null;

  if (!callFn) throw new Error(`Unknown LLM_PROVIDER: "${PROVIDER}"`);

  for (let attempt = 0; attempt <= _retries; attempt++) {
    try {
      return await callFn();
    } catch (err) {
      if (err.message?.includes('429') && attempt < _retries) {
        const delay = 3000 * (attempt + 1);
        console.log(`[llm] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${_retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

export function getProvider() { return PROVIDER; }

async function callAnthropic(systemPrompt, userPrompt, { model, maxTokens, messages }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set — cannot call Anthropic provider');

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
    throw new Error(`[llm:windfall] API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export function classifyPersonality(text) {
  const lower = (text || '').toLowerCase();
  if (/bold|impulsive|fierce|warrior|fight|proud|fury|rage|aggress|conquer|reckless/i.test(lower)) return 'aggressive';
  if (/explorer|wander|discover|drawn.*edge|horizon|curious|restless|roam|venture|seek.*unknown/i.test(lower)) return 'explorer';
  if (/loyal|protect|love|healer|heart|guard|defend|shield|watch.*over/i.test(lower)) return 'protector';
  if (/patient|steady|thoughtful|measured|reflect|slow|careful|gentle|nurtur|observe|analytic/i.test(lower)) return 'cautious';
  return 'balanced';
}
