const OpenAI = require('openai');
require('dotenv').config();

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

async function generateText(prompt) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  });
  return response.choices[0].message.content.trim();
}

async function generateChat(systemPrompt, userMessage) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.4,
  });
  return response.choices[0].message.content.trim();
}

async function generateChatWithHistory(systemPrompt, messages) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature: 0.5,
  });
  return response.choices[0].message.content.trim();
}

module.exports = { generateText, generateChat, generateChatWithHistory };
