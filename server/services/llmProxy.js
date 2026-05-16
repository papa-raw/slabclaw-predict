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

  throw new Error(`Unknown LLM_PROVIDER: "${PROVIDER}". Set LLM_PROVIDER to "windfall" or "anthropic".`);
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
