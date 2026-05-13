const axios = require('axios');

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiBase = 'https://api.groq.com/openai/v1';
    this.reasoningModel = 'qwen/qwen3-32b'; // Használja a <think> blokkot
    this.fastModel = 'llama-3.3-70b-versatile'; // Gyors, token-takarékos, JSON generálásra
    this.fallbackModel = 'llama-3.3-70b-versatile';

    if (!this.apiKey) {
      console.warn('[GroqService] FIGYELMEZTETÉS: GROQ_API_KEY nincs beállítva! Az AI funkciók nem fognak működni.');
    }
  }

  _stripThinking(text) {
    let clean = text.replace(/(?:\*)?<think>[\s\S]*?(?:<\/think>(?:\*)?|$)/gi, '').trim();
    if (clean.startsWith('*')) clean = clean.substring(1).trim();
    return clean;
  }

  _extractJSON(raw) {
    try {
      const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (mdMatch) return JSON.parse(mdMatch[1]);
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e) {
      throw new Error('Hiba a JSON feldolgozásakor: ' + e.message);
    }
    throw new Error('Nem található érvényes JSON struktúra a válaszban.');
  }

  async _callModel(model, messages, options) {
    const response = await axios.post(
      `${this.apiBase}/chat/completions`,
      {
        model,
        messages,
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
    return this._stripThinking(response.data.choices[0].message.content);
  }

  async generateResponse(prompt, messages = [], options = {}, useReasoning = false) {
    if (!this.apiKey) {
      console.warn('[GroqService] FIGYELMEZTETÉS: API kulcs nincs beállítva!');
      return this._getFallbackResponse();
    }

    const allMessages = [{ role: 'system', content: prompt }, ...messages];
    const targetModel = useReasoning ? this.reasoningModel : this.fastModel;

    // Try primary target model
    try {
      console.log(`[GroqService] API hívás → ${targetModel}`);
      const content = await this._callModel(targetModel, allMessages, options);
      console.log(`[GroqService] ✓ Válasz: ${targetModel} (${content.length} kar.)`);
      return content;
    } catch (primaryError) {
      const status = primaryError.response?.status;
      console.warn(`[GroqService] ✗ ${targetModel} sikertelen (HTTP ${status ?? 'timeout'}) → fallback: ${this.fallbackModel}`);
    }

    // Try fallback model
    if (targetModel !== this.fallbackModel) {
      try {
        const content = await this._callModel(this.fallbackModel, allMessages, options);
        console.log(`[GroqService] ✓ Válasz: ${this.fallbackModel} [FALLBACK] (${content.length} kar.)`);
        return content;
      } catch (fallbackError) {
        const status = fallbackError.response?.status;
        console.error(`[GroqService] ✗ ${this.fallbackModel} is sikertelen (HTTP ${status ?? 'timeout'}):`, fallbackError.response?.data || fallbackError.message);
        return this._getFallbackResponse();
      }
    }
    
    return this._getFallbackResponse();
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

SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!
Adj nyers JSON választ a következő szerkezetben. A javasolt checkpointokat a diák hibái és hiányosságai alapján határozd meg:
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
      return this._extractJSON(raw);
    } catch (error) {
      console.warn('[GroqService] analyzeDiagnosticTest parse hiba:', error.message);
    }

    return this._getDefaultAnalysis(testResult);
  }

  async generateSocraticHint(subject, topic, questionText, studentAnswer, correctAnswer, attemptNumber = 1) {
    const prompt = `Te egy türelmes, támogató Szókratészi mentor és tanár vagy. A diák hibázott egy feladatban, és a te feladatod rávezetni a jó megoldásra anélkül, hogy elárulnád azt.

A diák egy ${subject} - ${topic} témában dolgozik.
KÉRDÉS: ${questionText}
A DIÁK ROSSZ VÁLASZA: ${studentAnswer}
A HELYES VÁLASZ (Ezt NE írd le a diáknak!): ${correctAnswer}
PRÓBÁLKOZÁSOK SZÁMA: ${attemptNumber}

Utasítások:
1. Ne mondd meg direktben a helyes választ!
2. Közvetlenül a diákhoz szólj (tegeződve), mintha egy chaten beszélgetnétek. Semmilyen bevezetőt vagy zárást ne írj, csak a te tanári reakciódat/kérdésedet.
3. Tedd fel a megfelelő rávezető kérdést, vagy adj egy apró mankót/analógiát.
4. Legyél bátorító és barátságos.
5. Ha ez már a 3. vagy többedik próbálkozása, adj erősebb, konkrétabb tippet (de még mindig ne magát a választ).
6. Válaszod legyen nagyon rövid (maximum 2-3 mondat).`;

    try {
      // Itt engedjük a reasoning (gondolkodó) modellt
      return await this.generateResponse(prompt, [], { temperature: 0.6, max_tokens: 1024 }, true);
    } catch (error) {
      console.error('[GroqService] Szókratészi tipp hiba:', error.message);
      return this._getFallbackHint(attemptNumber);
    }
  }

  async generatePracticeQuestionSet(subject, topic, difficulty = 3, count = 10, grade = 'általános iskola') {
    const prompt = `Te egy kreatív és tapasztalt pedagógus AI vagy. Készíts pontosan ${count} darab KIVÁLÓ MINŐSÉGŰ, érdekes és gondolkodtató gyakorló kérdést ${subject} tantárgyból, a "${topic}" témakörhöz egy ${grade} osztályos tanulónak.
Nehézség: ${difficulty} (1-5 skálán, ahol az 1 nagyon alapozó, az 5 pedig összetett gondolkodást igényel).

Kerüld a túl száraz, bemagolható definíciókat! Használj valós életből vett, kreatív példákat és szituációkat, amik felkeltik a diák érdeklődését és a tényleges megértést tesztelik.

KÖTELEZŐ: legalább 6 különböző feladattípust használj, ezeket a típusokat:
- "mcq": feleletválasztós, 4 valós szöveges lehetőség (NEM betűjelölők!). options: ["Első válasz szövege","Második válasz szövege","Harmadik válasz szövege","Negyedik válasz szövege"], correctAnswer: "Első válasz szövege"
- "true_false": igaz/hamis. options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"
- "short_answer": rövid szöveges válasz. options: [], correctAnswer: "szöveges válasz"
- "fill_blank": szövegkiegészítős, az üres helyet ___ jelöli. options: [], correctAnswer: "hiányzó szó"
- "matching": párosítás. A bal és jobb oldali értékek MINDIG KÜLÖNBÖZZENEK egymástól! pairs: [{"left":"fogalom","right":"magyarázata"},...], options: ["jobb oldali értékek keverve",...], correctAnswer: {"fogalom":"magyarázata",...}
- "ordering": sorba rendezés (szavak, fogalmak, események vagy logikai lépések). items: ["elem C","elem A","elem B"] (keverve!), correctAnswer: ["elem A","elem B","elem C"] (helyes sorrendben)

FONTOS SZABÁLYOK:
1. Az MCQ options tömbben SOHA ne szerepeljenek puszta betűk ("A","B","C","D") – mindig valódi szöveges válaszok kellenek!
2. A párosítás (matching) bal és jobb oldali értékei kötelezően különbözők – ne szerepeljen ugyanaz mindkét oldalon! Érvényes kulcs-érték (key-value) párokat adj a correctAnswer mezőben is!
3. Minden kérdés EGYEDI legyen – ne ismételj meg fogalmakat vagy kérdéstípusokat feleslegesen!
4. Az "ordering" items tömbje legyen összekeverve (ne helyes sorrendben), a correctAnswer viszont helyes sorrendben!
5. SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!

Válaszolj az alábbi JSON formátumban:
{
  "questions": [
    {
      "questionId": "q1",
      "questionText": "A kérdés szövege",
      "questionType": "mcq",
      "difficulty": ${difficulty},
      "options": ["Valódi szöveges 1. válasz","Valódi szöveges 2. válasz","Valódi szöveges 3. válasz","Valódi szöveges 4. válasz"],
      "pairs": [],
      "items": [],
      "correctAnswer": "Valódi szöveges 1. válasz",
      "explanation": "Rövid magyarázat"
    }
  ]
}
Fontos: minden kérdésnél adj meg "questionId" mezőt "q1", "q2", stb. értékekkel. A pairs és items mindig szerepeljen (üres tömbként, ha nem releváns).`;

    let raw = '';
    try {
      raw = await this.generateResponse(prompt, [], { temperature: 0.7, max_tokens: 3000 });
      const parsed = this._extractJSON(raw);
      if (Array.isArray(parsed.questions)) {
        return parsed.questions.map((q, idx) => ({
          questionId:   q.questionId || `q${idx + 1}`,
          questionText: q.questionText || 'Hiányzó kérdés',
          questionType: ['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(q.questionType) ? q.questionType : 'short_answer',
          difficulty:   q.difficulty || difficulty,
          options:      Array.isArray(q.options) ? q.options : [],
          pairs:        Array.isArray(q.pairs) ? q.pairs : [],
          items:        Array.isArray(q.items) ? q.items : [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
          explanation:  q.explanation || ''
        }));
      }
    } catch (error) {
      console.warn('[GroqService] generatePracticeQuestionSet parse hiba:', error.message);
      if (raw) console.warn('[GroqService] Nyers AI válasz:', raw);
    }

    return Array.from({ length: count }, (_, idx) => ({
      questionId:    `q${idx + 1}`,
      questionText:  `Magyarázd el a saját szavaiddal: ${topic}`,
      questionType:  'short_answer',
      difficulty,
      options:       [],
      pairs:         [],
      items:         [],
      correctAnswer: 'Logikus, témába vágó válasz elfogadható.',
      explanation:   'Nyílt végű kérdés.'
    }));
  }

  async generateDiagnosticTest(subject, grade, count = 20) {
    const subjectCategories = {
      'Matematika': ['Algebra', 'Geometria', 'Statisztika', 'Függvények', 'Számelmélet', 'Mértékegységek'],
      'Magyar': ['Nyelvtan', 'Irodalom', 'Fogalmazás', 'Helyesírás', 'Szövegértés', 'Nyelvhelyesség'],
      'Angol': ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Listening', 'Speaking'],
      'Környezetismeret': ['Földrajz', 'Biológia', 'Fizika', 'Kémia', 'Társadalomismeret', 'Környezetvédelem']
    };
    const categories = subjectCategories[subject] || ['Általános'];

    const prompt = `Te egy általános iskolai szintfelmérő AI vagy. Generálj pontosan ${count} darab diagnosztikai kérdést ${subject} tantárgyból, ${grade} szintű tanulónak.
A kérdések osszák el magukat a következő témakörök között (körülbelül egyenlően): ${categories.join(', ')}.

Legalább 4 különböző feladattípust használj:
- "mcq": 4 valós szöveges lehetőség (NEM betűjelölők!), egy helyes. options: ["Első válasz szövege","Második válasz szövege","Harmadik válasz szövege","Negyedik válasz szövege"], correctAnswer: "Első válasz szövege"
- "true_false": igaz/hamis. options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"
- "short_answer": rövid szöveges válasz. options: [], correctAnswer: "szöveges válasz"
- "fill_blank": szövegkiegészítős (az üres helyet ___ jelöli). options: [], correctAnswer: "hiányzó szó"
- "matching": párosítás. A bal és jobb értékek MINDIG KÜLÖNBÖZZENEK! pairs: [{"left":"fogalom","right":"magyarázata"},...], options: ["jobb oldali értékek keverve"], correctAnswer: {"fogalom":"magyarázata",...}
- "ordering": sorba rendezés (szavak, fogalmak, események vagy logikai lépések). items: ["keveredett","elemek","listája"] (keverve!), correctAnswer: ["helyes","sorrendben","elemek"]

FONTOS SZABÁLYOK:
1. Az MCQ options tömbben SOHA ne szerepeljenek puszta betűk ("A","B","C","D") – mindig valódi szöveges válaszok kellenek!
2. A párosítás (matching) bal és jobb oldali értékei kötelezően különbözők – ne szerepeljen ugyanaz mindkét oldalon!
3. Minden kérdés EGYEDI legyen – ne ismételj meg fogalmakat!
4. Az "ordering" items tömbje legyen összekeverve, a correctAnswer viszont helyes sorrendben!
5. SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!

Válaszolj az alábbi JSON formátumban:
{
  "questions": [
    {
      "questionId": "d1",
      "questionText": "A kérdés szövege",
      "questionType": "mcq",
      "category": "Algebra",
      "difficulty": 2,
      "options": ["Valódi szöveges 1. válasz","Valódi szöveges 2. válasz","Valódi szöveges 3. válasz","Valódi szöveges 4. válasz"],
      "pairs": [],
      "items": [],
      "correctAnswer": "Valódi szöveges 1. válasz",
      "explanation": "Rövid magyarázat"
    }
  ]
}
Fontos: minden kérdésnél add meg a "category" mezőt (az adott témakör nevét), és a "questionId" legyen "d1", "d2", stb.`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.6, max_tokens: 4500 });
      const parsed = this._extractJSON(raw);
      if (Array.isArray(parsed.questions)) {
        return parsed.questions.map((q, idx) => ({
          questionId:    q.questionId || `d${idx + 1}`,
          questionText:  q.questionText || 'Hiányzó kérdés',
          questionType:  ['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(q.questionType) ? q.questionType : 'short_answer',
          category:      q.category || categories[idx % categories.length],
          difficulty:    q.difficulty || 3,
          options:       Array.isArray(q.options) ? q.options : [],
          pairs:         Array.isArray(q.pairs) ? q.pairs : [],
          items:         Array.isArray(q.items) ? q.items : [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
          explanation:   q.explanation || ''
        }));
      }
    } catch (error) {
      console.warn('[GroqService] generateDiagnosticTest parse hiba:', error.message);
    }

    return Array.from({ length: count }, (_, idx) => ({
      questionId:    `d${idx + 1}`,
      questionText:  `Magyarázd el a saját szavaiddal: ${subject} – ${categories[idx % categories.length]}`,
      questionType:  'short_answer',
      category:      categories[idx % categories.length],
      difficulty:    3,
      options: [], pairs: [], items: [],
      correctAnswer: 'Logikus, témába vágó válasz elfogadható.',
      explanation:   'Nyílt végű kérdés.'
    }));
  }

  async generateCheckpointHint(subject, topic, currentQuestion, studentAnswer, correctAnswer, attemptNumber, allQuestions, previousAnswers, chatHistory = []) {
    const progress = previousAnswers.length > 0
      ? `${previousAnswers.filter(a => a.isCorrect).length}/${previousAnswers.length} helyes eddigi`
      : 'Ez az első kérdés';

    const contextSummary = allQuestions.slice(0, 5).map((q, i) => {
      const ans = previousAnswers.find(a => a.questionId === q.questionId);
      return `${i + 1}. ${q.questionText.substring(0, 60)}... → ${ans ? (ans.isCorrect ? '✓ helyes' : '✗ hibás') : 'még nem válaszolt'}`;
    }).join('\n');

    const prompt = `Te egy türelmes, szókratészi tanár-mentor vagy. A diák éppen egy "${topic}" témájú ${subject} feladatsort old meg.

Jelenlegi haladás: ${progress}
Feladatsor kontextusa (első 5 feladat):
${contextSummary}

Jelenlegi kérdés: ${currentQuestion.questionText}
Kérdés típusa: ${currentQuestion.questionType}
A diák jelenlegi válasza: ${JSON.stringify(studentAnswer)}
Helyes válasz (NE áruld el!): ${JSON.stringify(correctAnswer)}
Próbálkozások száma: ${attemptNumber}

Utasítások:
1. NE mondd meg a helyes választ közvetlenül!
2. Közvetlenül a diáknak válaszolj tegeződve, mintha chaten beszélgetnétek. Semmilyen bevezető szöveget vagy köszönést ne használj!
3. Adj rávezető kérdést, analógiát, vagy egy kis segítséget – figyelembe véve a korábbi chat-előzményeket, nehogy ugyanazt ismételd!
4. Legyél bátorító és motiváló.
5. Ha ez a 3. vagy több próbálkozás, adj konkrétabb, de még mindig nem közvetlen tippet.
6. Max 3 mondat.
7. KÖTELEZŐ SZABÁLY: Bármi történik, mindenképp adj szöveges, segítő visszajelzést! SOHA ne adj vissza üres választ!`;

    const historyMessages = chatHistory
      .filter(m => m.content && m.content.trim())
      .slice(-4)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    try {
      // Itt engedjük a reasoning (gondolkodó) modellt
      return await this.generateResponse(prompt, historyMessages, { temperature: 0.65, max_tokens: 2048 }, true);
    } catch (error) {
      return this._getFallbackHint(attemptNumber);
    }
  }

  async checkShortTextAnswer(subject, questionText, studentAnswer, correctAnswer) {
    const prompt = `Te egy objektív pedagógus vagy. Döntsd el, hogy a diák válasza tartalmilag helyes-e a megadott kérdésre és a várt helyes válaszra tekintettel. Vedd figyelembe a szinonimákat és az elgépeléseket.

Tantárgy: ${subject}
Kérdés: ${questionText}
Elvárt helyes válasz: ${correctAnswer}
Diák tényleges válasza: ${studentAnswer}

SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!

Válaszolj az alábbi JSON formátumban:
{
  "correct": true/false,
  "reason": "Rövid indoklás, hogy miért jó vagy rossz"
}`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.1, max_tokens: 1024 });
      return this._extractJSON(raw);
    } catch (error) {
      console.warn('[GroqService] checkShortTextAnswer parse hiba:', error.message);
    }

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
