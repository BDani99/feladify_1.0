const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const ai = require('../services/ai');
const aiService = require('../services/aiService');

async function runTests() {
  console.log('=== Test 1: Testing ai.js (generateText) ===');
  try {
    const text = await ai.generateText('Say hello in exactly 3 words.');
    console.log(`Result from ai.generateText:\n"${text}"\n`);
  } catch (err) {
    console.error('Test 1 failed:', err.message);
  }

  console.log('=== Test 2: Testing aiService.js (generateResponse) ===');
  try {
    const res = await aiService.generateResponse(
      'You are a helpful assistant.',
      [{ role: 'user', content: 'Say "banana" in exactly 1 word.' }],
      { temperature: 0.5 }
    );
    console.log(`Result from aiService.generateResponse:\n"${res}"\n`);
  } catch (err) {
    console.error('Test 2 failed:', err.message);
  }

  console.log('=== Test 3: Testing aiService.js (generateResponseStream) ===');
  try {
    const stream = aiService.generateResponseStream(
      'You are a helpful assistant.',
      [{ role: 'user', content: 'Write a 1-sentence welcome message.' }],
      { temperature: 0.5 }
    );
    console.log('Streaming response chunks:');
    for await (const chunk of stream) {
      process.stdout.write(chunk);
    }
    console.log('\n\n=== Stream Done ===\n');
  } catch (err) {
    console.error('Test 3 failed:', err.message);
  }

  console.log('=== Test 4: Testing aiService.js (generateDiagnosticTest) ===');
  try {
    const questions = await aiService.generateDiagnosticTest('Környezetismeret', '6. osztály', 4, 1);
    console.log(`Successfully generated ${questions.length} diagnostic questions:`);
    console.log(JSON.stringify(questions.slice(0, 2), null, 2));
    console.log('=== Test 4 Done ===\n');
  } catch (err) {
    console.error('Test 4 failed:', err.message);
  }
}

runTests();
