const OpenAI = require('openai');
require('dotenv').config();
const costTracker = require('./costTracker');

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'sk-a4ef2c5339b94ea4a1bcf0f28d59910d',
  baseURL: 'https://api.deepseek.com',
});

const qwenClient = new OpenAI({
  apiKey: process.env.QWEN_API_KEY || 'sk-c5f4512e4eaa4d499397c7c4b627fb95',
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});

const REASONING_CHAIN = [
  { model: 'qwen-3.5-plus', provider: 'qwen' },
  { model: 'dpv4pro', provider: 'deepseek' },
];

const FAST_CHAIN = [
  { model: 'v4flash', provider: 'deepseek' },
  { model: 'qwen-3.5-flash', provider: 'qwen' },
];

function stripThinking(text) {
  if (!text) return '';
  return text.replace(/(?:\*)?<think>[\s\S]*?(?:<\/think>(?:\*)?|$)/gi, '').trim();
}

async function _callModel(modelConfig, messages, temperature) {
  const { model, provider } = modelConfig;
  let client;
  let actualModel;

  if (provider === 'deepseek') {
    client = deepseekClient;
    actualModel = model === 'dpv4pro' ? 'deepseek-reasoner' : 'deepseek-chat';
  } else if (provider === 'qwen') {
    client = qwenClient;
    actualModel = model === 'qwen-3.5-plus' ? 'qwen-plus' : 'qwen-turbo';
  } else {
    client = deepseekClient;
    actualModel = model;
  }

  try {
    const response = await client.chat.completions.create({
      model: actualModel,
      messages,
      temperature,
    });
    return stripThinking(response.choices[0].message.content.trim());
  } catch (error) {
    const status = error.status ?? error.response?.status;
    if (status === 429) console.warn(`[AI] Rate limit (429) elérve (${model}). Azonnali fallback...`);
    throw error;
  }
}

async function _withFallback(chain, messages, temperature, callerName) {
  const chainType = chain === REASONING_CHAIN ? 'reasoning' : 'fast';
  for (let i = 0; i < chain.length; i++) {
    const modelConfig = chain[i];
    const { model } = modelConfig;
    try {
      console.log(`[AI/${callerName}] API hívás → ${model} (${i + 1}/${chain.length})`);
      const content = await _callModel(modelConfig, messages, temperature);
      console.log(`[AI/${callerName}] ✓ Válasz kész (${content.length} kar.)`);
      costTracker.trackCall({ caller: callerName, chainType, chainPosition: i, messages, output: content });
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

