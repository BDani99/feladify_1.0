const OpenAI = require('openai');
require('dotenv').config();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const REASONING_CHAIN = [
  { model: 'qwen/qwen3-32b' },
  { model: 'openai/gpt-oss-120b' },
  { model: 'llama-3.3-70b-versatile' },
];

const FAST_CHAIN = [
  { model: 'openai/gpt-oss-20b' },
  { model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { model: 'llama-3.1-8b-instant' },
];

function stripThinking(text) {
  if (!text) return '';
  return text.replace(/(?:\*)?<think>[\s\S]*?(?:<\/think>(?:\*)?|$)/gi, '').trim();
}

async function _callModel(model, messages, temperature) {
  try {
    const response = await groq.chat.completions.create({ model, messages, temperature });
    return stripThinking(response.choices[0].message.content.trim());
  } catch (error) {
    const status = error.status ?? error.response?.status;
    if (status === 429) console.warn(`[AI] Rate limit (429) elérve (${model}). Azonnali fallback...`);
    throw error;
  }
}

async function _withFallback(chain, messages, temperature, callerName) {
  for (let i = 0; i < chain.length; i++) {
    const { model } = chain[i];
    try {
      console.log(`[AI/${callerName}] API hívás → ${model} (${i + 1}/${chain.length})`);
      const content = await _callModel(model, messages, temperature);
      console.log(`[AI/${callerName}] ✓ Válasz kész (${content.length} kar.)`);
      return content;
    } catch (err) {
      const status = err.status ?? err.response?.status ?? 'timeout';
      if (i < chain.length - 1) {
        console.warn(`[AI/${callerName}] ✗ ${model} sikertelen (HTTP ${status}), következő: ${chain[i + 1].model}`);
      } else {
        console.error(`[AI/${callerName}] ✗ Összes modell sikertelen.`);
        throw new Error('Az AI szolgáltatás jelenleg nem elérhető. Kérjük, próbálja újra.');
      }
    }
  }
}

async function generateText(prompt) {
  return _withFallback(REASONING_CHAIN, [{ role: 'user', content: prompt }], 0.3, 'generateText');
}

async function generateChat(systemPrompt, userMessage) {
  return _withFallback(REASONING_CHAIN, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], 0.4, 'generateChat');
}

async function generateChatWithHistory(systemPrompt, messages) {
  return _withFallback(REASONING_CHAIN, [
    { role: 'system', content: systemPrompt },
    ...messages
  ], 0.5, 'generateChatWithHistory');
}

module.exports = { generateText, generateChat, generateChatWithHistory };
