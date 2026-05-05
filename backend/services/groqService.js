const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiBase = 'https://api.groq.com/openai/v1';
    this.model = 'llama-3.1-70b-versatile'; // vagy 'llama-3.1-8b-instant' gyorsabb verzió
    
    if (!this.apiKey) {
      console.warn('[GroqService] GROQ_API_KEY nincs beállítva! AI funkciók nem fognak működni.');
    }
  }

  /**
   * AI válasz generálása - általános célú
   * @param {string} prompt - A rendszer prompt
   * @param {Array} messages - Üzenet előzmények
   * @param {Object} options - További opciók (hőmérséklet, max tokenek)
   */
  async generateResponse(prompt, messages = [], options = {}) {
    if (!this.apiKey) {
      return this._getFallbackResponse(prompt, messages);
    }

    try {
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
          timeout: 30000
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('[GroqService] API hiba:', error.response?.data || error.message);
      return this._getFallbackResponse(prompt, messages);
    }
  }

  /**
   * Diagnosztikai teszt AI elemzése
   * @param {Object} testResult - A teszt eredménye
   * @param {Array} questions - A kérdések (részletes adatokkal)
   */
  async analyzeDiagnosticTest(testResult, questions) {
    const prompt = `Te egy tapasztalt pedagógus és oktatási szakértő vagy. Elemezd egy diák diagnosztikai tesztjének eredményét, és adj részletes, személyre szabott visszajelzést.

A teszt a következő tantárgyból készült: ${testResult.subject}
A diák összteljesítménye: ${testResult.scorePercentage.toFixed(1)}%

Kérdésenkénti eredmények:
${questions.map((q, i) => {
  const answer = testResult.answers[i];
  return `- ${q.category}: ${q.questionText.substring(0, 50)}... [Helyes: ${answer?.isCorrect ? 'Igen' : 'Nem'}]`;
}).join('\n')}

Kérlek, elemezd a következő szempontok szerint:
1. Milyen témakörökben erős a diák?
2. Milyen témakörökben gyenge, és milyen típusú hibákat vét?
3. Milyen prioritási sorrendben érdemes gyakorolni?
4. Adj személyre szabott, motiváló visszajelzést a diáknak.
5. Becsüld meg, mennyi gyakorlási idő szükséges az egyes gyenge területeken.

Formázd JSON-ban a választ a következő struktúrában:
{
  "overallPerformance": "excellent|good|average|needs_improvement",
  "personalizedFeedback": "személyes visszajelzés szövege",
  "strengths": [
    {"category": "kategória", "description": "leírás", "confidence": 0.8}
  ],
  "weaknesses": [
    {"category": "kategória", "description": "leírás", "priority": 1, "recommendedPractice": 5}
  ],
  "learningPath": {
    "recommendedOrder": ["kategória1", "kategória2"],
    "estimatedTime": 20,
    "focusAreas": ["kategória1"]
  }
}`;

    try {
      const analysis = await this.generateResponse(prompt, [], { temperature: 0.3 });
      
      // Próbáljuk meg JSON-ként parseolni
      try {
        const jsonMatch = analysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.warn('[GroqService] Nem sikerült JSON-t parseolni, fallback elemzést használunk');
      }
      
      return this._getDefaultAnalysis(testResult);
    } catch (error) {
      console.error('[GroqService] Diagnosztikai elemzés hiba:', error.message);
      return this._getDefaultAnalysis(testResult);
    }
  }

  /**
   * Szókratészi AI Tutor - rávezető kérdések generálása
   * @param {string} subject - Tantárgy
   * @param {string} topic - Témakör
   * @param {string} questionText - A kérdés szövege
   * @param {string} studentAnswer - A diák válasza
   * @param {string} correctAnswer - A helyes válasz
   * @param {number} attemptNumber - Hányadik próbálkozás
   * @param {string} tone - AI személyiség (adventurous|scholar|teacher)
   */
  async generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber = 1, tone = 'teacher') {
    const tonePrompts = {
      adventurous: 'Te egy kalandos, játékos tanár vagy, aki történetekkel és metaforákkal magyaráz. Használj izgalmas, felfedező hangnemet!',
      scholar: 'Te egy komoly, tényalapú tudós tanár vagy. Precíz, logikus magyarázatokat adsz!',
      teacher: 'Te egy türelmes, támogató tanár vagy, aki bátorítja a diákot, de nem adja meg egyből a választ!'
    };

    const prompt = `${tonePrompts[tone] || tonePrompts.teacher}

A diák egy ${subject} - ${topic} témakörben dolgozik fel egy kérdést.

KÉRDÉS: ${questionText}
DIÁK VÁLASZA: ${studentAnswer}
HELYES VÁLASZ: ${correctAnswer}

A diák már ${attemptNumber}. próbálkozásra van. 

Feladatod: Generálj egy rávezető, segítő kérdést vagy tippet, ami segít a diáknak rájönni a helyes válaszra, de NE add meg közvetlenül a megoldást!

A válaszod:
- Legyen bátorító és pozitív
- Tartalmazzon egy konkrét, a témához kapcsolódó rávezető kérdést vagy tippet
- Legyen korlátozva 2-3 mondatra
- Ha ez már a 3. vagy több próbálkozás, adhatsz egy kicsit konkrétabb tippet`;

    try {
      return await this.generateResponse(prompt, [], { temperature: 0.8, max_tokens: 256 });
    } catch (error) {
      console.error('[GroqService] Szókratészi tipp hiba:', error.message);
      return this._getFallbackHint(attemptNumber);
    }
  }

  /**
   * Személyre szabott tanulási útvonal generálása
   * @param {string} subject - Tantárgy
   * @param {Object} diagnosticResult - Diagnosztikai eredmény
   */
  async generateLearningPath(subject, diagnosticResult) {
    const prompt = `Te egy oktatási tervező szakértő vagy. Készíts személyre szabott tanulási útvonalat egy diák számára ${subject} tantárgyból.

A diák diagnosztikai tesztjének eredménye:
- Összteljesítmény: ${diagnosticResult.scorePercentage.toFixed(1)}%
- Gyenge területek: ${diagnosticResult.aiAnalysis?.weaknesses?.map(w => w.category).join(', ') || 'nincs adat'}
- Erős területek: ${diagnosticResult.aiAnalysis?.strengths?.map(s => s.category).join(', ') || 'nincs adat'}

Kérlek, tervezz egy tanulási útvonalat, ami:
1. A gyenge területekre fókuszál (több gyakorló node)
2. Az erős területeket csak ismétlésként tartalmazza
3. Tartalmaz egy "Mini-Boss" kihívást a szakasz végén
4. Egy végső "Mesterfok" node-ot, ami a 90%-os kompetenciát célozza

Formázd JSON-ban:
{
  "nodes": [
    {
      "topic": "témakör",
      "type": "practice|review|boss|final",
      "isExtraPractice": true/false,
      "estimatedQuestions": 5
    }
  ]
}`;

    try {
      const path = await this.generateResponse(prompt, [], { temperature: 0.5 });
      
      try {
        const jsonMatch = path.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.warn('[GroqService] Tanulási útvonal JSON parse hiba');
      }
      
      return this._getDefaultLearningPath(subject, diagnosticResult);
    } catch (error) {
      console.error('[GroqService] Tanulási útvonal hiba:', error.message);
      return this._getDefaultLearningPath(subject, diagnosticResult);
    }
  }

  /**
   * Gyakorló kérdés generálása egy adott témakörből
   * @param {string} subject - Tantárgy
   * @param {string} topic - Témakör
   */
  async generatePracticeQuestion(subject, topic) {
    const prompt = `Te egy általános iskolai feladatgenerátor vagy. Generálj EGY gyakorló kérdést ${subject} tantárgyból, "${topic}" témakörből, kb. 4. osztályos szintre.

Fontos szabályok:
- A kérdés legyen egyszerű, egyértelmű és rövid
- Feleletválasztós kérdésnél pontosan 4 lehetőség legyen (A, B, C, D)
- A helyes válasz legyen egyértelműen helyes
- Igaz/hamis kérdésnél a helyes válasz "Igaz" vagy "Hamis" legyen

Válaszolj CSAK a következő JSON formátumban, semmi más szöveg:
{
  "questionText": "A kérdés szövege",
  "type": "mcq",
  "options": ["A lehetőség", "B lehetőség", "C lehetőség", "D lehetőség"],
  "correctAnswer": "A helyes lehetőség szövege pontosan",
  "explanation": "Rövid magyarázat a helyes válaszhoz"
}

A "type" lehet: "mcq" (feleletválasztós), "truefalse" (igaz/hamis), vagy "shorttext" (rövid szöveges).
Igaz/hamis esetén az options: ["Igaz", "Hamis"].
Rövid szöveges esetén az options: [].`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.7, max_tokens: 512 });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.questionText && parsed.type && parsed.correctAnswer) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[GroqService] generatePracticeQuestion parse hiba:', e.message);
    }
    return this._getFallbackQuestion(subject, topic);
  }

  /**
   * Válasz ellenőrzése – rövid szöveges válaszoknál AI-segítséggel
   * @param {string} subject
   * @param {string} questionText
   * @param {string} studentAnswer
   * @param {string} correctAnswer
   * @param {string} questionType
   */
  async checkShortTextAnswer(subject, questionText, studentAnswer, correctAnswer) {
    const prompt = `Te egy pedagógus vagy. Ellenőrizd, hogy a diák válasza helyes-e.

Tantárgy: ${subject}
Kérdés: ${questionText}
Helyes válasz: ${correctAnswer}
Diák válasza: ${studentAnswer}

Válaszolj CSAK JSON-nal:
{"correct": true/false, "reason": "Rövid indoklás (max 1 mondat)"}`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.2, max_tokens: 100 });
      const jsonMatch = raw.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[GroqService] checkShortTextAnswer parse hiba');
    }
    // Fallback: case-insensitive string match
    const norm = (s) => s.toLowerCase().trim().replace(/[.,!?]/g, '');
    return { correct: norm(studentAnswer) === norm(correctAnswer), reason: '' };
  }

  _getFallbackQuestion(subject, topic) {
    return {
      questionText: `Mi a következő fogalom magyarázata: ${topic}?`,
      type: 'shorttext',
      options: [],
      correctAnswer: topic,
      explanation: `A ${topic} a ${subject} tantárgy fontos témája.`
    };
  }

  // Fallback válaszok, ha az API nem elérhető
  _getFallbackResponse(prompt, messages) {
    console.log('[GroqService] Fallback választ használunk');
    return 'Sajnálom, az AI szolgáltatás jelenleg nem elérhető. Kérlek, próbáld újra később!';
  }

  _getFallbackHint(attemptNumber) {
    const hints = [
      'Gondold át újra a kérdést! Mi a kulcsszó?',
      'Próbálj meg egy másik megközelítést! Mi lenne, ha...?',
      'Emlékezz vissza az alapfogalmakra! Mi a definíció?'
    ];
    return hints[Math.min(attemptNumber - 1, hints.length - 1)];
  }

  _getDefaultAnalysis(testResult) {
    return {
      overallPerformance: testResult.scorePercentage >= 70 ? 'good' : testResult.scorePercentage >= 50 ? 'average' : 'needs_improvement',
      personalizedFeedback: `A teljesítményed ${testResult.scorePercentage.toFixed(0)}% lett. ${testResult.scorePercentage >= 70 ? 'Ügyes vagy!' : 'Van hová fejlődni, de ez egy jó kiindulási pont!'}`,
      strengths: [],
      weaknesses: [],
      learningPath: {
        recommendedOrder: [],
        estimatedTime: 10,
        focusAreas: []
      }
    };
  }

  _getDefaultLearningPath(subject, diagnosticResult) {
    return {
      nodes: [
        { topic: `${subject} - Alapok`, type: 'practice', isExtraPractice: true, estimatedQuestions: 5 },
        { topic: `${subject} - Gyakorlás`, type: 'practice', isExtraPractice: true, estimatedQuestions: 5 },
        { topic: `${subject} - Kihívás`, type: 'boss', isExtraPractice: false, estimatedQuestions: 10 },
        { topic: `${subject} - Mesterfok`, type: 'final', isExtraPractice: false, estimatedQuestions: 15 }
      ]
    };
  }
}

module.exports = new GroqService();