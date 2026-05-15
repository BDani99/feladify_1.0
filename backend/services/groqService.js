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
    const prompt = `Te egy tapasztalt pedagógus és oktatási szakértő vagy. Elemezd egy diák diagnosztikai tesztjének eredményét, és készíts belőle egy személyre szabott tanulási útvonalat (checkpointokat) az "Egyéni Gyakorlás" modulhoz.

Tantárgy: ${testResult.subject}
Összpontszám: ${testResult.scorePercentage.toFixed(1)}%
Kérdések száma: ${testResult.totalQuestions}

Kérdésenként:
${questions.map((q, i) => {
  const answer = testResult.answers[i];
  return `- ${q.category}: ${q.questionText.substring(0, 80)}... [Helyes: ${answer?.isCorrect ? 'Igen' : 'Nem'}]`;
}).join('\n')}

FONTOS SZABÁLYOK A CHECKPOINTOKHOZ:
1. Adj meg LEGALÁBB 5, legfeljebb 8 checkpointot.
2. Minden checkpoint topic legyen SPECIFIKUS, cselekvő nevű (pl. "Lineáris egyenletek megoldása" – NEM "Egyenletek"; "Mondatelemzés és szófajok felismerése" – NEM "Nyelvtan").
3. A checkpointok nehézsége legyen FOKOZATOSAN NÖVEKVŐ (az első 1-2-es, az utolsó 4-5-ös nehézségen).
4. Az első 1-2 checkpoint alapozó legyen (a gyenge területek megalapozása), a later-iek alkalmazás szintű.
5. Minden checkpointhoz adj "learningObjective" mezőt: mit fog tudni a diák a fejezet elvégzése után (egy mondatban).
6. A diák GYENGE területein kezdd a sort, de adj erős területekre is fejlesztő checkpointot.

SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!
{
  "overallPerformance": "excellent|good|average|needs_improvement",
  "personalizedFeedback": "Rövid, motiváló, személyre szabott visszajelzés a diáknak.",
  "strengths": [
    {"category":"kategória","description":"Miben volt jó?"}
  ],
  "recommendedCheckpoints": [
    {"topic":"Specifikus, cselekvő témacím","difficulty": 1, "reason": "Miért kell ezt gyakorolni", "learningObjective": "Mit fog tudni utána"}
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

  async generatePracticeQuestionSet(subject, topic, difficulty = 3, count = 10, grade = 'általános iskola', weakQuestions = []) {
    const difficultyDescriptions = {
      1: '1-2. osztályos szint: egyszerű tények felismerése, alapvető fogalmak azonosítása',
      2: '3-4. osztályos szint: alapfogalmak alkalmazása egyszerű szituációkban',
      3: '5-6. osztályos szint: összefüggések megértése, fogalmak összekapcsolása',
      4: '7-8. osztályos szint: több lépéses problémamegoldás, elemzés',
      5: 'Emelt szint: kritikai gondolkodás, absztrakt összefüggések, komplex feladatok'
    };

    const weakSection = weakQuestions && weakQuestions.length > 0
      ? `\nADAPTÍV FELADATOK: A diák az előző fejezetben nehéznek találta az alábbi kérdés(eke)t. Adj meg legalább ${Math.min(weakQuestions.length, 3)} hasonló, de ELTÉRŐ megfogalmazású kérdést ugyanerre a témára, hogy megerősítsd a tudást:\n${weakQuestions.map((wq, i) => `  ${i+1}. [${wq.questionType}] "${wq.questionText}"`).join('\n')}\n`
      : '';

    const prompt = `Te egy kreatív és tapasztalt pedagógus AI vagy. Készíts pontosan ${count} darab KIVÁLÓ MINŐSÉGŰ, érdekes és gondolkodtató gyakorló kérdést ${subject} tantárgyból, a "${topic}" témakörhöz egy ${grade} osztályos tanulónak.
Nehézség: ${difficulty}/5 – ${difficultyDescriptions[difficulty] || difficultyDescriptions[3]}
${weakSection}
FONTOS: NE generálj hanganyagot, videót vagy külső médiát igénylő kérdést! Minden kérdés önállóan, kizárólag szöveg alapján legyen megválaszolható!

Kerüld a túl száraz, bemagolható definíciókat! Használj valós életből vett, kreatív példákat és szituációkat, amik felkeltik a diák érdeklődését és a tényleges megértést tesztelik.

KÖTELEZŐ: legalább 6 különböző feladattípust használj, ezeket a típusokat:
- "mcq": feleletválasztós, 4 valós szöveges lehetőség (NEM betűjelölők!). options: ["Első válasz szövege","Második válasz szövege","Harmadik válasz szövege","Negyedik válasz szövege"], correctAnswer: "Első válasz szövege"
- "true_false": igaz/hamis. options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"
- "short_answer": rövid szöveges válasz. FONTOS: ha a kérdés egy mondatot/szöveget kell értékelni (pl. "Mi a helyes fogalmazás?", "Javítsd ki a mondatot!"), a teljes értékelendő szöveget/mondatot BEL KELL FOGLALNI a questionText-be! options: [], correctAnswer: "szöveges válasz"
- "fill_blank": szövegkiegészítős, az üres helyet ___ jelöli. options: [], correctAnswer: "hiányzó szó"
- "matching": párosítás. BAL OLDAL = rövid fogalom/szó (1-3 szó), JOBB OLDAL = annak RÉSZLETES definíciója/magyarázata (teljes mondat, minimum 5 szó). TILOS: a kérdés szövegében felsorolni a bal oldali fogalmakat! A kérdés legyen általános bevezető (pl. "Párosítsd a fogalmakat a definícióikkal:"). Az options tömb KIZÁRÓLAG a jobb oldali definíciókat tartalmazza (keverve), SOHA nem a bal oldali fogalmakat! pairs: [{"left":"fogalom","right":"A fogalom részletes, teljes mondatos magyarázata"},...], options: ["jobb oldali definíciók keverve",...], correctAnswer: {"fogalom":"A fogalom részletes, teljes mondatos magyarázata",...}
- "ordering": sorba rendezés. TILOS az items elemeit felsorolni a kérdés szövegében – az elemek KIZÁRÓLAG az items tömbben szerepeljenek! A kérdésben CSAK az elvárt sorrendet jelezd (pl. "Rendezd növekvő sorrendbe az elemeket:" vagy "Tedd időrendi sorrendbe:"). Az items tömb KEVEREDETT sorrendben legyen (NEM helyes sorrendben!), a correctAnswer helyes sorrendben. items: ["elem C","elem A","elem B"], correctAnswer: ["elem A","elem B","elem C"]

FONTOS SZABÁLYOK:
1. Az MCQ options tömbben SOHA ne szerepeljenek puszta betűk ("A","B","C","D") – mindig valódi szöveges válaszok kellenek!
2. A matching options tömb KIZÁRÓLAG a jobb oldali definíciókat tartalmazza (keverve) – SOHA nem a bal oldali fogalmakat! Ellenőrizd: options[i] ≠ pairs[j].left!
3. A fill_blank kérdésben KÖTELEZŐ az ___ jelölő szerepelni a szövegben (pl. "A Nap egy ___ típusú csillag."). Ha "melyik", "ki", "hány" kérdés, azt MCQ-ként add meg, ne fill_blank-ként!
4. Az ordering items tömbje KEVEREDETT sorrendben legyen, a kérdésszöveg NE sorolja fel az elemeket – csak az irányt jelezze!
5. A matching kérdésszöveg NE sorolja fel a bal oldali fogalmakat – általános bevezető szöveg kell!
6. Minden kérdés EGYEDI legyen – ne ismételj meg fogalmakat!
7. SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!

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
        const mapped = parsed.questions.map((q, idx) => ({
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
        return this._sanitizeQuestions(mapped, difficulty);
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

  async generateDiagnosticTest(subject, grade, count = 20, currentLevel = 1) {
    const subjectCategories = {
      'Matematika': ['Algebra', 'Geometria', 'Statisztika', 'Függvények', 'Számelmélet', 'Mértékegységek'],
      'Magyar': ['Nyelvtan', 'Irodalom', 'Fogalmazás', 'Helyesírás', 'Szövegértés', 'Nyelvhelyesség'],
      'Angol': ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Comprehension', 'Communication'],
      'Környezetismeret': ['Földrajz', 'Biológia', 'Fizika', 'Kémia', 'Társadalomismeret', 'Környezetvédelem']
    };
    const categories = subjectCategories[subject] || ['Általános'];

    const gradeNum = parseInt(grade) || 4;
    const baseDifficulty = Math.max(1, Math.min(5, Math.ceil(gradeNum / 2)));
    // Level 1-10 within grade: every 3 levels adds +1 difficulty
    const levelBonus = Math.floor((Math.max(1, Math.min(10, currentLevel)) - 1) / 3);
    const effectiveDifficulty = Math.max(1, Math.min(5, baseDifficulty + levelBonus));

    const difficultyDescriptions = {
      1: '1-2. osztályos szint: egyszerű tények, alapvető felismerés',
      2: '3-4. osztályos szint: alapfogalmak alkalmazása',
      3: '5-6. osztályos szint: összefüggések megértése',
      4: '7-8. osztályos szint: több lépéses problémamegoldás',
      5: 'Emelt szint: kritikai gondolkodás, összetett feladatok'
    };

    const prompt = `Te egy általános iskolai szintfelmérő AI vagy. Generálj pontosan ${count} darab diagnosztikai kérdést ${subject} tantárgyból, ${grade} szintű tanulónak (${count <= 10 ? 'gyors szintfelmérő' : 'teljes szintfelmérő'}, ${currentLevel}. szint).
A kérdések osszák el magukat a következő témakörök között (körülbelül egyenlően): ${categories.join(', ')}.
A kérdések nehézsége legyen ${effectiveDifficulty}/5 – ${difficultyDescriptions[effectiveDifficulty] || difficultyDescriptions[3]}.

FONTOS: NE generálj hanganyagot, videót vagy külső médiát igénylő kérdést! Minden kérdés önállóan, kizárólag szöveg alapján legyen megválaszolható! Tilos olyan utasítás, mint "Hallgass meg...", "Nézd meg a képen...", "Figyeld a hangot..." stb.

Legalább 4 különböző feladattípust használj:
- "mcq": 4 valós szöveges lehetőség (NEM betűjelölők!), egy helyes. options: ["Első válasz szövege","Második válasz szövege","Harmadik válasz szövege","Negyedik válasz szövege"], correctAnswer: "Első válasz szövege"
- "true_false": igaz/hamis. options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"
- "short_answer": rövid szöveges válasz. FONTOS: ha a kérdés egy szöveget/mondatot értékel, azt a szöveget be kell illeszteni a questionText-be! options: [], correctAnswer: "szöveges válasz"
- "fill_blank": szövegkiegészítős (az üres helyet ___ jelöli). options: [], correctAnswer: "hiányzó szó"
- "matching": párosítás. BAL OLDAL = rövid fogalom/szó (1-3 szó), JOBB OLDAL = annak RÉSZLETES definíciója/magyarázata (teljes mondat, minimum 5 szó). TILOS a kérdésszövegben felsorolni a bal oldali fogalmakat – általános bevezető kell (pl. "Párosítsd a fogalmakat a definícióikkal:"). Az options tömb kizárólag a JOBB OLDALI értékeket tartalmazza (keverve), SOHA nem a bal oldaliak másolatát!
- "ordering": sorba rendezés. TILOS az items elemeit felsorolni a kérdésszövegben – csak az irányt jelezd (pl. "Rendezd növekvő sorrendbe:" vagy "Tedd időrendi sorrendbe:"). Az items tömb KEVEREDETT sorrendben, correctAnswer helyes sorrendben!

FONTOS SZABÁLYOK:
1. Az MCQ options tömbben SOHA ne szerepeljenek puszta betűk ("A","B","C","D") – mindig valódi szöveges válaszok kellenek!
2. A matching options tömb KIZÁRÓLAG a jobb oldali definíciókat tartalmazza (keverve) – SOHA nem a bal oldali fogalmakat!
3. A fill_blank kérdésben KÖTELEZŐ az ___ jelölő szerepelni (pl. "A víz forráspontja ___ fok Celsius."). Ha "melyik"/"ki"/"hány" típusú, azt MCQ-ként add meg!
4. Az ordering items tömbje KEVEREDETT sorrendben legyen, a kérdésszöveg NE sorolja fel az elemeket!
5. A matching kérdésszöveg NE sorolja fel a bal oldali fogalmakat – általános bevezető kell!
6. Minden kérdés EGYEDI legyen – ne ismételj meg fogalmakat!
7. SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!

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
        const mapped = parsed.questions.map((q, idx) => ({
          questionId:    q.questionId || `d${idx + 1}`,
          questionText:  q.questionText || 'Hiányzó kérdés',
          questionType:  ['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(q.questionType) ? q.questionType : 'short_answer',
          category:      q.category || categories[idx % categories.length],
          difficulty:    q.difficulty || effectiveDifficulty,
          options:       Array.isArray(q.options) ? q.options : [],
          pairs:         Array.isArray(q.pairs) ? q.pairs : [],
          items:         Array.isArray(q.items) ? q.items : [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
          explanation:   q.explanation || ''
        }));
        return this._sanitizeQuestions(mapped, baseDifficulty);
      }
    } catch (error) {
      console.warn('[GroqService] generateDiagnosticTest parse hiba:', error.message);
    }

    return Array.from({ length: count }, (_, idx) => ({
      questionId:    `d${idx + 1}`,
      questionText:  `Magyarázd el a saját szavaiddal: ${subject} – ${categories[idx % categories.length]}`,
      questionType:  'short_answer',
      category:      categories[idx % categories.length],
      difficulty:    effectiveDifficulty,
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

  async generateQuestionAnalysis(subject, questionText, correctAnswer, studentAnswer, isCorrect) {
    const correctAnswerStr = typeof correctAnswer === 'object' ? JSON.stringify(correctAnswer) : String(correctAnswer);
    const studentAnswerStr = studentAnswer === null || studentAnswer === undefined
      ? '(nem válaszolt)'
      : typeof studentAnswer === 'object' ? JSON.stringify(studentAnswer) : String(studentAnswer);

    const prompt = `Te egy tapasztalt és türelmes pedagógus vagy. Elemezd az alábbi kérdést és a diák válaszát, majd adj rövid, érthetőközép-iskolai szintű magyarázatot.

Tantárgy: ${subject}
Kérdés: ${questionText}
Helyes válasz: ${correctAnswerStr}
A diák válasza: ${studentAnswerStr}
Eredmény: ${isCorrect ? 'HELYES' : 'HELYTELEN'}

SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb szöveget ne írj!

Adj JSON választ a következő szerkezetben:
{
  "explanation": "Miért ez a helyes válasz? Rövid, érthető magyarázat (2-3 mondat).",
  "whyWrong": ${isCorrect ? 'null' : '"Miért volt helytelen a diák válasza? (1-2 mondat, ha releváns)"'},
  "conceptTip": "Egy hasznos tanulási tipp vagy összefüggés, amit érdemes megjegyezni ezzel a témával kapcsolatban."
}`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.4, max_tokens: 600 });
      return this._extractJSON(raw);
    } catch (error) {
      console.warn('[GroqService] generateQuestionAnalysis parse hiba:', error.message);
      return {
        explanation: 'A helyes válasz: ' + correctAnswerStr,
        whyWrong: isCorrect ? null : 'A megadott válasz nem egyezik a helyes megoldással.',
        conceptTip: 'Érdemes átismételni ezt a témakört!'
      };
    }
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

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  _sanitizeQuestions(questions, fallbackDifficulty) {
    return questions.map((q, idx) => {
      let { questionType, questionText, options, pairs, items, correctAnswer } = q;

      // fill_blank: ha nincs ___ a kérdésben, alakítsuk short_answer-ré
      if (questionType === 'fill_blank' && !questionText.includes('___')) {
        questionType = 'short_answer';
      }

      // matching: az options MINDIG a jobb oldali értékek (pairs[].right) legyenek, keverve
      if (questionType === 'matching' && Array.isArray(pairs) && pairs.length > 0) {
        const leftValues = pairs.map(p => String(p.left));
        const rightValues = pairs.map(p => String(p.right));
        // Ha az options tartalmaz bal oldali értéket, VAGY üres, akkor javítjuk
        const hasLeftInOptions = !Array.isArray(options) || options.length === 0 ||
          options.some(opt => leftValues.includes(String(opt)));
        if (hasLeftInOptions) {
          options = this._shuffle(rightValues);
          console.warn(`[GroqService] Matching q${idx+1}: options javítva (bal=jobb hiba)`);
        }
        // Ha a kérdésszöveg felsorolja a bal oldali fogalmakat, cseréljük általánosabb szövegre
        const leftInText = leftValues.filter(lv => lv.length > 2 && questionText.includes(lv));
        if (leftInText.length >= Math.floor(leftValues.length * 0.5)) {
          questionText = 'Párosítsd a fogalmakat a megfelelő definícióikkal:';
          console.warn(`[GroqService] Matching q${idx+1}: kérdésszöveg generikusra cserélve (bal fogalmakat listázta)`);
        }
        // correctAnswer: minden kulcshoz biztosan van érték
        if (typeof correctAnswer !== 'object' || Array.isArray(correctAnswer)) {
          const ca = {};
          pairs.forEach(p => { ca[p.left] = p.right; });
          correctAnswer = ca;
        }
      }

      // ordering: ha az items véletlenül helyes sorrendben van (= correctAnswer), keverjük
      if (questionType === 'ordering' && Array.isArray(items) && Array.isArray(correctAnswer)) {
        const sameOrder = items.length === correctAnswer.length &&
          items.every((it, i) => String(it) === String(correctAnswer[i]));
        if (sameOrder) {
          items = this._shuffle(items);
          console.warn(`[GroqService] Ordering q${idx+1}: items megkeverve (helyes sorrend volt)`);
        }
        // Ha a kérdésszöveg felsorolja az items elemeit, cseréljük általánosabb szövegre
        const itemsInText = items.filter(it => String(it).length > 2 && questionText.includes(String(it)));
        if (itemsInText.length >= Math.floor(items.length * 0.5)) {
          const directionHint = questionText.match(/(növekvő|csökkenő|időrendi|folyamat|lépés|sorrend)/i)?.[0];
          questionText = directionHint
            ? `Rendezd ${directionHint.toLowerCase()} sorrendbe az elemeket:`
            : 'Rendezd sorba az elemeket a helyes sorrendnek megfelelően:';
          console.warn(`[GroqService] Ordering q${idx+1}: kérdésszöveg generikusra cserélve (elemeket listázta)`);
        }
      }

      return { ...q, questionText, questionType, options: options || [], pairs: pairs || [], items: items || [], correctAnswer };
    });
  }

  _getDefaultAnalysis(testResult) {
    const overall = testResult.scorePercentage >= 90 ? 'excellent'
      : testResult.scorePercentage >= 70 ? 'good'
      : testResult.scorePercentage >= 50 ? 'average'
      : 'needs_improvement';

    const subjectCheckpoints = {
      'Matematika': [
        { topic: 'Számolás és alapműveletek', difficulty: 1, reason: 'Alapkészségek megszilárdítása', learningObjective: 'Biztosan végzi az összeadást, kivonást, szorzást, osztást' },
        { topic: 'Törtek és tizedes törtek', difficulty: 2, reason: 'Közös hiba a teszten', learningObjective: 'Megérti a törtszámok fogalmát és számolni tud velük' },
        { topic: 'Algebrai kifejezések és egyenletek', difficulty: 3, reason: 'Összefüggések megértése', learningObjective: 'Egyszerű egyenleteket old meg' },
        { topic: 'Geometriai alakzatok és területszámítás', difficulty: 3, reason: 'Térben való gondolkodás fejlesztése', learningObjective: 'Kiszámítja síkidomok területét és kerületét' },
        { topic: 'Szöveges feladatok megoldása', difficulty: 4, reason: 'Alkalmazás valós helyzetekben', learningObjective: 'Több lépéses szöveges feladatokat old meg logikusan' }
      ],
      'Magyar': [
        { topic: 'Szófajok és mondatrészek felismerése', difficulty: 1, reason: 'Alaptudás ellenőrzése', learningObjective: 'Biztosan felismeri az alapvető szófajokat' },
        { topic: 'Helyesírás alapszabályai', difficulty: 2, reason: 'Írásban való pontosság', learningObjective: 'Alkalmazza a legfontosabb helyesírási szabályokat' },
        { topic: 'Mondatelemzés', difficulty: 3, reason: 'Mélyebb grammatikai tudás', learningObjective: 'Teljes mondatokat elemez' },
        { topic: 'Szövegértés és szövegelemzés', difficulty: 3, reason: 'Olvasott szöveg megértése', learningObjective: 'Szövegből következtetéseket von le' },
        { topic: 'Fogalmazás és stíluseszközök', difficulty: 4, reason: 'Alkotóképesség fejlesztése', learningObjective: 'Felépített, stílusos szöveget ír' }
      ],
      'Angol': [
        { topic: 'Alapvető szókincs és szójelentések', difficulty: 1, reason: 'Szókincs bővítése', learningObjective: 'Ismeri és helyesen használja az alapvető szavakat' },
        { topic: 'Jelen idők és igeidők használata', difficulty: 2, reason: 'Grammatikai alap', learningObjective: 'Helyesen alkalmazza a present simple és continuous igeidőket' },
        { topic: 'Szövegértés és olvasás', difficulty: 3, reason: 'Olvasott szöveg feldolgozása', learningObjective: 'Rövid szövegek tartalmát megérti' },
        { topic: 'Múlt és jövő idők', difficulty: 3, reason: 'Igeidő rendszer mélyítése', learningObjective: 'Múlt és jövő idejű mondatokat alkot helyesen' },
        { topic: 'Kommunikációs és levélírási feladatok', difficulty: 4, reason: 'Aktív nyelvhasználat', learningObjective: 'Rövid kommunikációs szövegeket ír' }
      ],
      'Környezetismeret': [
        { topic: 'Élőlények és életközösségek', difficulty: 1, reason: 'Természetismeret alapjai', learningObjective: 'Megnevezi és csoportosítja az alapvető élőlény-csoportokat' },
        { topic: 'Testek és anyagok tulajdonságai', difficulty: 2, reason: 'Fizikai alapfogalmak', learningObjective: 'Leírja és összehasonlítja anyagok fizikai tulajdonságait' },
        { topic: 'Magyarország földrajza és települései', difficulty: 2, reason: 'Helyismeret fejlesztése', learningObjective: 'Megnevezi a főbb természetföldrajzi egységeket' },
        { topic: 'Természeti jelenségek és folyamatok', difficulty: 3, reason: 'Összefüggések megértése', learningObjective: 'Magyarázza az időjárás és évszakok változásait' },
        { topic: 'Környezetvédelem és fenntarthatóság', difficulty: 4, reason: 'Kritikus gondolkodás', learningObjective: 'Javaslatokat tesz a környezettudatos életmódra' }
      ]
    };

    const checkpoints = subjectCheckpoints[testResult.subject] || [
      { topic: 'Alapfogalmak ismétlése', difficulty: 1, reason: 'Alap', learningObjective: 'Megérti az alapfogalmakat' },
      { topic: 'Fogalmak alkalmazása', difficulty: 2, reason: 'Alkalmazás', learningObjective: 'Alkalmazza a tanultakat' },
      { topic: 'Összefüggések felismerése', difficulty: 3, reason: 'Elemzés', learningObjective: 'Összefüggéseket lát meg' },
      { topic: 'Problémamegoldás', difficulty: 4, reason: 'Fejlesztő', learningObjective: 'Összetett feladatokat old meg' },
      { topic: 'Komplex feladatok', difficulty: 5, reason: 'Kihívás', learningObjective: 'Mélyen érti az anyagot' }
    ];

    return {
      overallPerformance: overall,
      personalizedFeedback: `Az eredményed ${testResult.scorePercentage.toFixed(0)}%. Kezdjük el a személyre szabott gyakorlást!`,
      strengths: [],
      recommendedCheckpoints: checkpoints
    };
  }
}

module.exports = new GroqService();
