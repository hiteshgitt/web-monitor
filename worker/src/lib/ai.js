// Zealot assistant (Pro): answers questions about one site using its real monitoring data.
//
// Free providers, tried in order, so Zealot costs nothing:
// 1. Cloudflare Workers AI (env.AI binding): 10,000 free Neurons a day per account. A hard daily cap (ai_usage)
//    keeps the worst case well under that, so it never bills, even on a paid Workers plan.
// 2. Groq (GROQ_API_KEY, free tier, no card on file: past its limits it refuses, it never bills).
// 3. Google Gemini (GOOGLE_AI_API_KEY, free tier: 20 requests a day per model).
// Any failure moves on to the next one; the real reason goes to the logs, the customer gets a plain message.
import { ApiError } from './util.js';

// Gemma 4 26B A4B: 9,091 Neurons per M input tokens, 27,273 per M output (Cloudflare pricing, 2026-11).
// Worst case per answer: ~2,500 input tokens (prompt capped below) + 600 output tokens ≈ 40 Neurons, so
// 200 answers ≈ 8,000 Neurons, under the free 10,000. Not on the 2026-11-20 deprecation list.
export const CF_MODEL = '@cf/google/gemma-4-26b-a4b-it';
export const CF_DAILY_LIMIT = 200;
const CF_MAX_OUTPUT_TOKENS = 600;
const MAX_PROMPT_CHARS = 10000; // ≈ 2,500 tokens
const MAX_QUERY_CHARS = 4000;

const GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_DAILY_LIMIT = 800; // the free tier allows about 1,000 a day; leave room for RuyaShield's checks

// Each Gemini model has its own quota. Flash-Lite refuses the "no thinking" setting (HTTP 400).
export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', noThinking: true },
  { id: 'gemini-2.5-flash', noThinking: true },
  { id: 'gemini-3.5-flash-lite', noThinking: false },
];

const utcDay = (at = new Date()) => at.toISOString().slice(0, 10);

/** Counts one request for this provider today; false once today's cap is reached (the request is not made). */
export async function claimDaily(db, provider, limit, at = new Date()) {
  const row = await db.prepare(`INSERT INTO ai_usage (day, provider, requests) VALUES (?, ?, 1)
    ON CONFLICT (day, provider) DO UPDATE SET requests = requests + 1 RETURNING requests`).bind(utcDay(at), provider).first();
  return Number(row?.requests ?? Infinity) <= limit;
}

export function buildPrompt(query, site) {
  const prompt = `You are an expert web analytics and performance assistant. Based on the following website data for ${site.name} (${site.url}), answer the user's question or analyze the fix/issue they pasted.

User question or pasted content:
"""
${String(query).slice(0, MAX_QUERY_CHARS)}
"""

Website data (times are in milliseconds, memory/CPU are percentages; null means not measured):
- Platform: ${site.platform}
- Status: ${site.status}
- Uptime (30 days): ${site.uptime ?? 'unknown'}%
- Response time: ${site.responseTime ?? 'unknown'} ms
- Analytics: ${JSON.stringify(site.analytics || {})}
- Performance: ${JSON.stringify(site.performance || {})}
- SEO: ${JSON.stringify(site.seo || {})}
- Security: ${JSON.stringify(site.security || {})}`;
  const ending = '\n\nIf the user asked a question, answer using only this data. If they pasted an error, fix suggestion, or issue text, explain how it relates to this site\'s data and give specific next steps. Reply in plain text only, no JSON, in at most about 300 words.';
  return prompt.slice(0, MAX_PROMPT_CHARS - ending.length) + ending;
}

// Workers AI answers in one of two shapes depending on the model.
const workersAiText = (out) => (typeof out?.response === 'string' ? out.response : out?.choices?.[0]?.message?.content || '').trim();

async function viaWorkersAi(env, prompt) {
  if (!env.AI) return { skip: 'not-configured' };
  if (!(await claimDaily(env.DB, 'workers-ai', CF_DAILY_LIMIT))) return { skip: 'daily-cap' };
  const out = await env.AI.run(CF_MODEL, {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: CF_MAX_OUTPUT_TOKENS,
    temperature: 0.7,
    // Gemma 4 reasons first by default, which uses the output budget (and Neurons) and can leave the answer empty.
    chat_template_kwargs: { enable_thinking: false },
  });
  return { text: workersAiText(out), model: CF_MODEL };
}

async function viaGroq(env, prompt) {
  if (!env.GROQ_API_KEY) return { skip: 'not-configured' };
  if (!(await claimDaily(env.DB, 'groq', GROQ_DAILY_LIMIT))) return { skip: 'daily-cap' };
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    // gpt-oss reasons before answering; "low" keeps that short so the answer fits.
    body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 1500, temperature: 0.7, reasoning_effort: 'low' }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: res.status, message: data?.error?.message };
  return { text: String(data?.choices?.[0]?.message?.content || '').trim(), model: GROQ_MODEL };
}

async function viaGemini(env, prompt, model, noThinking) {
  if (!env.GOOGLE_AI_API_KEY) return { skip: 'not-configured' };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GOOGLE_AI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7, ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: res.status, message: data?.error?.message };
  return { text: (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim(), model };
}

export async function askZealot(env, query, site, providers = null) {
  const prompt = buildPrompt(query, site);
  const chain = providers || [
    ['workers-ai', () => viaWorkersAi(env, prompt)],
    ['groq', () => viaGroq(env, prompt)],
    ...GEMINI_MODELS.map(({ id, noThinking }) => [id, () => viaGemini(env, prompt, id, noThinking)]),
  ];
  let tried = 0;
  for (const [name, call] of chain) {
    let r;
    try {
      r = await call();
    } catch (error) {
      console.error('Zealot provider failed', name, error.message);
      tried += 1;
      continue;
    }
    if (r.skip) continue;
    tried += 1;
    if (r.text) return { answer: r.text, model: r.model };
    console.error('Zealot provider failed', name, r.error ?? 'empty answer', r.message ?? '');
  }
  throw new ApiError(503, tried
    ? 'Zealot is very busy right now. Please try again in a minute.'
    : 'The AI assistant is not configured yet.', { service: 'AI Insights' });
}
