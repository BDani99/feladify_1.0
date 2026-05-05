const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateText(prompt) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash-lite',
    contents: prompt,
  });
  return response.text;
}

module.exports = { generateText };
