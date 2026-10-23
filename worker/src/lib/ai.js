// Zealot assistant (Pro): answers questions about one site using its real monitoring data, via Google Gemini
import { ApiError } from './util.js';

const GEMINI_MODEL = 'gemini-3.5-flash';

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

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GOOGLE_AI_API_KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `status ${response.status}`;
    throw new ApiError(response.status === 429 ? 429 : 502, `Google Gemini API Error: ${message}`, { service: 'AI Insights' });
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
  return { answer: text || 'No response generated.' };
}
