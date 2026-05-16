const OpenAI = require('openai');
require('dotenv').config();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

// Harmonizált modell nevek
const REASONING_MODEL    = 'qwen/qwen3-32b';
const REASONING_FALLBACK = 'openai/gpt-oss-20b';
const FAST_MODEL         = 'llama-3.3-70b-versatile';
const FAST_FALLBACK      = 'openai/gpt-oss-120b';

function stripThinking(text) {
  return text.replace(/(?:\*)?<think>[\s\S]*?(?:<\/think>(?:\*)?|$)/gi, '').trim();
}

async function _callModel(model, messages, temperature) {
  try {
    const response = await groq.chat.completions.create({
      model,
      messages,
      temperature,
    });
    return stripThinking(response.choices[0].message.content.trim());
  } catch (error) {
    const status = error.status ?? error.response?.status;
    if (status === 429) {
      console.warn(`[Groq] Rate limit (429) elérve. Azonnali fallback...`);
    }
    throw error;
  }

}

async function _withFallback(messages, temperature, callerName, useReasoning = true) {
  const primaryModel = useReasoning ? REASONING_MODEL : FAST_MODEL;
  const fallbackModel = useReasoning ? REASONING_FALLBACK : FAST_FALLBACK;

  try {
    console.log(`[Groq/${callerName}] API hívás → ${primaryModel} (fallback: ${fallbackModel})`);
    const content = await _callModel(primaryModel, messages, temperature);
    console.log(`[Groq/${callerName}] ✓ Válasz kész (${content.length} kar.)`);
    return content;
  } catch (primaryError) {
    const status = primaryError.status ?? primaryError.response?.status ?? 'timeout';
    console.warn(`[Groq/${callerName}] ✗ ${primaryModel} sikertelen (HTTP ${status}), próbálkozás fallback-el: ${fallbackModel}`);
    try {
      const content = await _callModel(fallbackModel, messages, temperature);
      console.log(`[Groq/${callerName}] ✓ Válasz kész [FALLBACK] (${content.length} kar.)`);
      return content;
    } catch (fallbackError) {
      console.error(`[Groq/${callerName}] ✗ Fallback modell is sikertelen.`);
      throw fallbackError;
    }
  }
}

async function generateText(prompt) {
  return _withFallback([{ role: 'user', content: prompt }], 0.3, 'generateText', true);
}

async function generateChat(systemPrompt, userMessage) {
  return _withFallback([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ], 0.4, 'generateChat', true);
}

async function generateChatWithHistory(systemPrompt, messages) {
  return _withFallback([
    { role: 'system', content: systemPrompt },
    ...messages
  ], 0.5, 'generateChatWithHistory', true);
}

module.exports = { generateText, generateChat, generateChatWithHistory };

