const OpenAI = require('openai');
require('dotenv').config();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const PRIMARY_MODEL  = 'qwen/qwen3-32b';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

function stripThinking(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

async function _callModel(model, messages, temperature) {
  const response = await groq.chat.completions.create({
    model,
    messages,
    temperature,
  });
  return stripThinking(response.choices[0].message.content.trim());
}

async function _withFallback(messages, temperature, callerName) {
  try {
    console.log(`[Groq/${callerName}] API hívás → ${PRIMARY_MODEL}`);
    const content = await _callModel(PRIMARY_MODEL, messages, temperature);
    console.log(`[Groq/${callerName}] ✓ Válasz: ${PRIMARY_MODEL} (${content.length} kar.)`);
    return content;
  } catch (primaryError) {
    const status = primaryError.status ?? primaryError.response?.status ?? 'timeout';
    console.warn(`[Groq/${callerName}] ✗ ${PRIMARY_MODEL} sikertelen (HTTP ${status}) → fallback: ${FALLBACK_MODEL}`);
  }

  const content = await _callModel(FALLBACK_MODEL, messages, temperature);
  console.log(`[Groq/${callerName}] ✓ Válasz: ${FALLBACK_MODEL} [FALLBACK] (${content.length} kar.)`);
  return content;
}

async function generateText(prompt) {
  return _withFallback(
    [{ role: 'user', content: prompt }],
    0.3,
    'generateText'
  );
}

async function generateChat(systemPrompt, userMessage) {
  return _withFallback(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    0.4,
    'generateChat'
  );
}

async function generateChatWithHistory(systemPrompt, messages) {
  return _withFallback(
    [{ role: 'system', content: systemPrompt }, ...messages],
    0.5,
    'generateChatWithHistory'
  );
}

module.exports = { generateText, generateChat, generateChatWithHistory };
