const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiBase = 'https://api.groq.com/openai/v1';
    this.model = 'llama-3.3-70b-versatile';

    if (!this.apiKey) {
      console.warn('[GroqService] FIGYELMEZTETÉS: GROQ_API_KEY nincs beállítva! Az AI funkciók nem fognak működni.');
    }
  }

  async generateResponse(prompt, messages = [], options = {}) {
    if (!this.apiKey) {
      console.warn('[GroqService] FIGYELMEZTETÉS: API kulcs nincs beállítva!');
      return this._getFallbackResponse(prompt, messages);
    }

    try {
      console.log('[GroqService] API hívás indítása - Modell:', this.model);
      console.log('[GroqService] Rendszerprompt hossza:', prompt.length);
      console.log('[GroqService] Üzenetek száma:', messages.length);

      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: prompt },
            ...messages
          ],
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1024,
          top_p: options.top_p || 1,
          stream: false
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 mp timeout
        }
      );

      const aiResponse = response.data.choices[0].message.content;
      console.log('[GroqService] Sikeres válasz - hossz:', aiResponse.length);
      return aiResponse;
    } catch (error) {
      console.error('[GroqService] API hiba - Típus:', error.response?.status);
      console.error('[GroqService] API hiba - Részletek:', error.response?.data || error.message);
      if (error.code === 'ECONNABORTED') {
        console.error('[GroqService] Timeout a Groq API-hoz (30s)');
      }
      return this._getFallbackResponse(prompt, messages);
    }
  }

  async analyzeDiagnosticTest(testResult, questions) {
    const prompt = `Te egy tapasztalt pedagógus és oktatási szakértő vagy. Elemezd egy diák diagnosztikai tesztjének eredményét, és készíts belőle egy tanulási útvonalat (checkpointokat) az "Egyéni Gyakorlás" modulhoz.

Tantárgy: ${testResult.subject}
Összpontszám: ${testResult.scorePercentage.toFixed(1)}%
Kérdések száma: ${testResult.totalQuestions}

Kérdésenként:
${questions.map((q, i) => {
  const answer = testResult.answers[i];
  return `- ${q.category}: ${q.questionText.substring(0, 80)}... [Helyes: ${answer?.isCorrect ? 'Igen' : 'Nem'}]`;
}).join('\n')}

Adj JSON választ a következő szerkezetben, ahol a 'weaknesses' alapján javasolsz gyakorló checkpointokat:
{
  "overallPerformance": "excellent|good|average|needs_improvement",
  "personalizedFeedback": "Rövid, motiváló, személyre szabott visszajelzés a diáknak.",
  "strengths": [
    {"category":"kategória","description":"Miben volt jó?"}
  ],
  "recommendedCheckpoints": [
    {"topic":"Fejlesztendő altéma neve","difficulty": 1, "reason": "Miért kell ezt gyakorolni"}
  ]
}`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.3, max_tokens: 800 });
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (error) {
      console.warn('[GroqService] analyzeDiagnosticTest parse hiba:', error.message);
    }

    return this._getDefaultAnalysis(testResult);
  }

  async generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber = 1) {
    // Szigorú instrukciók, hogy az AI ne adja meg a megoldást
    const prompt = `Te egy türelmes, támogató Szókratészi mentor és tanár vagy. A diák hibázott egy feladatban, és a te feladatod rávezetni a jó megoldásra anélkül, hogy elárulnád azt.

A diák egy ${subject} - ${topic} témában dolgozik.
KÉRDÉS: ${questionText}
A DIÁK ROSSZ VÁLASZA: ${studentAnswer}
A HELYES VÁLASZ (Ezt NE írd le a diáknak!): ${correctAnswer}
PRÓBÁLKOZÁSOK SZÁMA: ${attemptNumber}

Utasítások:
1. Ne mondd meg direktben a helyes választ!
2. Tedd fel a megfelelő rávezető kérdést, vagy adj egy apró mankót/analógiát.
3. Legyél bátorító és barátságos.
4. Ha ez már a 3. vagy többedik próbálkozása, adj erősebb, konkrétabb tippet (de még mindig ne magát a választ).
5. Válaszod legyen nagyon rövid (maximum 2-3 mondat).`;

    try {
      return await this.generateResponse(prompt, [], { temperature: 0.6, max_tokens: 150 });
    } catch (error) {
      console.error('[GroqService] Szókratészi tipp hiba:', error.message);
      return this._getFallbackHint(attemptNumber);
    }
  }

  async generatePracticeQuestionSet(subject, topic, difficulty = 3, count = 3) {
    const prompt = `Te egy általános iskolai feladatgenerátor AI vagy. Generálj pontosan ${count} darab gyakorló kérdést ${subject} tantárgyból, a "${topic}" témakörhöz.
Nehézség: ${difficulty} (1-5 skálán, ahol az 1 nagyon alapozó, az 5 pedig összetett gondolkodást igényel).
A kérdések változatosak legyenek: legalább egy feleletválasztós (mcq) és legalább egy rövid szöveges (shorttext).

Válaszolj KIZÁRÓLAG érvényes JSON formátumban:
{
  "questions": [
    {
      "questionText": "A kérdés szövege, érthetően megfogalmazva",
      "type": "mcq|shorttext",
      "difficulty": ${difficulty},
      "options": ["A","B","C","D"], // Csak 'mcq' esetén, 'shorttext' esetén hagyd üresen []
      "correctAnswer": "A helyes válasz",
      "explanation": "Rövid magyarázat a tanárnak, hogy miért ez a jó válasz"
    }
  ]
}`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.7, max_tokens: 1200 });
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.questions)) {
          return parsed.questions.map(q => ({
            questionText: q.questionText || 'Hiányzó kérdés',
            type: q.type === 'mcq' || q.type === 'shorttext' ? q.type : 'shorttext',
            difficulty: q.difficulty || difficulty,
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            explanation: q.explanation || ''
          }));
        }
      }
    } catch (error) {
      console.warn('[GroqService] generatePracticeQuestionSet parse hiba:', error.message);
    }

    // Fallback adatok, ha valami elszáll
    return Array.from({ length: count }, (_, index) => ({
      questionText: `Magyarázd el a saját szavaiddal a következőt: ${topic}`,
      type: 'shorttext',
      difficulty,
      options: [],
      correctAnswer: 'A diák logikus válasza',
      explanation: 'Ellenőrizd az AI-val.'
    }));
  }

  async checkShortTextAnswer(subject, questionText, studentAnswer, correctAnswer) {
    const prompt = `Te egy objektív pedagógus vagy. Döntsd el, hogy a diák válasza tartalmilag helyes-e a megadott kérdésre és a várt helyes válaszra tekintettel. Vedd figyelembe a szinonimákat és az elgépeléseket.

Tantárgy: ${subject}
Kérdés: ${questionText}
Elvárt helyes válasz: ${correctAnswer}
Diák tényleges válasza: ${studentAnswer}

Válaszolj KIZÁRÓLAG érvényes JSON formátumban:
{
  "correct": true/false,
  "reason": "Rövid indoklás, hogy miért jó vagy rossz"
}`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.1, max_tokens: 150 });
      const match = raw.match(/\{[\s\S]*?\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch (error) {
      console.warn('[GroqService] checkShortTextAnswer parse hiba:', error.message);
    }

    // Nagyon lebutított fallback ellenőrzés
    const norm = (s) => String(s).toLowerCase().trim().replace(/[.,!?]/g, '');
    return { 
      correct: norm(studentAnswer) === norm(correctAnswer) || norm(studentAnswer).includes(norm(correctAnswer)), 
      reason: 'Automatikus string egyezés.' 
    };
  }

  _getFallbackResponse() {
    return 'Sajnálom, az AI szolgáltatás jelenleg túlterhelt vagy nem elérhető. Kérlek, próbáld újra egy picit később!';
  }

  _getFallbackHint(attemptNumber) {
    const hints = [
      'Nézd meg jobban a feladat kulcsszavait!',
      'Gondold át, miről is tanultunk ebben a témában! Próbáld másképp megközelíteni.',
      'Szedd darabokra a kérdést! Mi a legfontosabb információ benne?'
    ];
    return hints[Math.min(attemptNumber - 1, hints.length - 1)];
  }

  _getDefaultAnalysis(testResult) {
    const overall = testResult.scorePercentage >= 90 ? 'excellent'
      : testResult.scorePercentage >= 70 ? 'good'
      : testResult.scorePercentage >= 50 ? 'average'
      : 'needs_improvement';

    return {
      overallPerformance: overall,
      personalizedFeedback: `Az eredményed ${testResult.scorePercentage.toFixed(0)}%. Kezdjük el a gyakorlást!`,
      strengths: [],
      recommendedCheckpoints: [
        { topic: 'Alapok ismétlése', difficulty: 2, reason: 'Szükséges az alapozás' }
      ]
    };
  }
}

module.exports = new GroqService();