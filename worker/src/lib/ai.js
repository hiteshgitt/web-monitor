// Zealot assistant (Pro): answers questions about one site using its real monitoring data, via Google Gemini
import { ApiError } from './util.js';

// Tried in order: when Google says a model is overloaded or rate-limited (or it times out), the next one answers.
// Each model has its own quota, so a model that is out of quota is skipped too. Flash-Lite refuses the
// "no thinking" setting (HTTP 400), so it is sent only to the models that accept it.
export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash', noThinking: true },
  { id: 'gemini-2.5-flash', noThinking: true },
  { id: 'gemini-3.5-flash-lite', noThinking: false },
];

export async function askZealot(env, query, site) {
  if (!env.GOOGLE_AI_API_KEY) {
    throw new ApiError(503, 'The AI assistant is not configured yet (GOOGLE_AI_API_KEY).', { service: 'AI Insights' });
  }

  const prompt = `You are an expert web analytics and performance assistant. Based on the following website data for ${site.name} (${site.url}), answer the user's question or analyze the fix/issue they pasted.

User question or pasted content:
"""
${query}
"""

Website data (times are in milliseconds, memory/CPU are percentages; null means not measured):
- Platform: ${site.platform}
- Status: ${site.status}
- Uptime (30 days): ${site.uptime ?? 'unknown'}%
- Response time: ${site.responseTime ?? 'unknown'} ms
- Analytics: ${JSON.stringify(site.analytics || {})}
- Performance: ${JSON.stringify(site.performance || {})}
- SEO: ${JSON.stringify(site.seo || {})}
- Security: ${JSON.stringify(site.security || {})}

If the user asked a question, answer using only this data. If they pasted an error, fix suggestion, or issue text, explain how it relates to this site's data and give specific next steps. Reply in plain text only, no JSON.`;

  let busy = false;
  let quota = false;
  for (const { id: model, noThinking } of GEMINI_MODELS) {
    let response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GOOGLE_AI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1500, temperature: 0.7, ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
        }),
        signal: AbortSignal.timeout(25000),
      });
    } catch (error) {
      console.error('Zealot: Gemini unreachable', model, error.message);
      busy = true;
      continue;
    }
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
      if (text) return { answer: text, model };
      busy = true; // an empty answer (e.g. blocked or cut off): try the next model
      continue;
    }
    // Any failure (overloaded, out of quota, a setting one model refuses) moves on to the next model; the
    // real reason stays in the logs.
    console.error('Zealot: Gemini error', model, response.status, data?.error?.message);
    if (response.status === 429) quota = true;
    else busy = true;
  }
  throw new ApiError(503, quota && !busy
    ? 'Zealot has reached its AI limit for now. Please try again later.'
    : 'Zealot is very busy right now. Please try again in a minute.', { service: 'AI Insights' });
}
