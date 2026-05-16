const axios = require('axios');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));


class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiBase = 'https://api.groq.com/openai/v1';
    this.reasoningModel = 'qwen/qwen3-32b';
    this.reasoningFallback = 'openai/gpt-oss-20b';
    this.fastModel = 'llama-3.3-70b-versatile';
    this.fastFallback = 'openai/gpt-oss-120b';


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
      let jsonStr = mdMatch ? mdMatch[1] : null;
      
      if (!jsonStr) {
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) jsonStr = match[0];
      }

      if (jsonStr) {
        try {
          return JSON.parse(jsonStr.trim());
        } catch (e) {
          // Egyszerű javítás, ha a JSON vége levágódott (pl. max_tokens miatt)
          let repaired = jsonStr.trim();
          if (!repaired.endsWith('}') && !repaired.endsWith(']')) {
            console.warn('[GroqService] Levágott JSON észlelve, javítás megkísérlése...');
            // Próbáljuk meg bezárni a tömböt és az objektumot
            if (repaired.includes('"questions"') && !repaired.includes(']')) {
              // Ha a kérdések listája közben szakadt meg, próbáljuk meg lezárni az utolsó elemet
              if (repaired.endsWith(',')) repaired = repaired.slice(0, -1);
              repaired += ']}';
            } else if (!repaired.endsWith('}')) {
              repaired += '}';
            }
            try {
              return JSON.parse(repaired);
            } catch (e2) {
              throw e; // Ha még mindig nem jó, dobjuk az eredeti hibát
            }
          }
          throw e;
        }
      }
    } catch (e) {
      throw new Error('Hiba a JSON feldolgozásakor: ' + e.message);
    }
    throw new Error('Nem található érvényes JSON struktúra a válaszban.');
  }


  async _callModel(model, messages, options) {
    try {
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
          timeout: 45000 // Increased timeout
        }
      );
      return this._stripThinking(response.data.choices[0].message.content);
    } catch (error) {
      const status = error.response?.status;
      const errorData = error.response?.data?.error;
      const headers = error.response?.headers;

      if (status === 429) {
        const groqMsg = errorData?.message || '';
        const limitType = groqMsg.toLowerCase().includes('tokens') ? 'TPM (Token)' : 'RPM (Request)';
        
        console.warn(`[GroqService] ✗ Rate limit (429) hiba [${limitType}]:`);
        if (groqMsg) console.warn(`[GroqService]   Üzenet: ${groqMsg}`);
        
        // Log rate limit headers if available
        if (headers) {
          const resetTime = headers['x-ratelimit-reset-requests'] || headers['x-ratelimit-reset-tokens'];
          if (resetTime) console.warn(`[GroqService]   Reset idő: ${resetTime}`);
        }
        console.warn(`[GroqService]   Azonnali fallback indítása...`);
      }

      throw error;
    }

  }

  async _callModelWithFallback(primaryModel, fallbackModel, messages, options) {
    try {
      return await this._callModel(primaryModel, messages, options);
    } catch (primaryError) {
      if (primaryModel === fallbackModel) throw primaryError;
      const status = primaryError.response?.status || 'timeout';
      console.warn(`[GroqService] ✗ ${primaryModel} sikertelen (HTTP ${status}), próbálkozás a fallback modellel: ${fallbackModel}`);
      try {
        return await this._callModel(fallbackModel, messages, options);
      } catch (fallbackError) {
        console.error(`[GroqService] ✗ Fallback modell (${fallbackModel}) is sikertelen.`);
        throw fallbackError;
      }
    }
  }

  async generateResponse(prompt, messages = [], options = {}, useReasoning = false) {
    if (!this.apiKey) {
      console.warn('[GroqService] FIGYELMEZTETÉS: API kulcs nincs beállítva!');
      return this._getFallbackResponse();
    }

    const allMessages = [{ role: 'system', content: prompt }, ...messages];
    const primaryModel = useReasoning ? this.reasoningModel : this.fastModel;
    const fallbackModel = useReasoning ? this.reasoningFallback : this.fastFallback;

    try {
      console.log(`[GroqService] API hívás → ${primaryModel} (fallback: ${fallbackModel})`);
      const content = await this._callModelWithFallback(primaryModel, fallbackModel, allMessages, options);
      console.log(`[GroqService] ✓ Válasz kész (${content.length} kar.)`);
      return content;
    } catch (e) {
      return this._getFallbackResponse();
    }
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
7. Minden checkpointhoz adj "gamifiedTitle" mezőt: rövid, lelkesítő, gamifikált cím MAX 5 szóban (pl. "Küldetés: Törtek mestere", "Boss Level: Egyenletek", "Akadémia: Szókincs Sprint", "Kihívás: Geometria kód"). Legyen tettre sarkáló és motiváló!

SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmilyen egyéb bevezető vagy magyarázó szöveget ne írj!
{
  "overallPerformance": "excellent|good|average|needs_improvement",
  "personalizedFeedback": "Rövid, motiváló, személyre szabott visszajelzés a diáknak.",
  "strengths": [
    {"category":"kategória","description":"Miben volt jó?"}
  ],
  "recommendedCheckpoints": [
    {"topic":"Specifikus, cselekvő témacím","gamifiedTitle":"Küldetés: Témacím","difficulty": 1, "reason": "Miért kell ezt gyakorolni", "learningObjective": "Mit fog tudni utána"}
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
    const level = Math.min(attemptNumber, 3);

    const prompts = {
      1: `Te vagy Szókratész. A diák hibás választ adott. SZIGORÚAN TILOS megmondani a megoldást vagy a képletet! Kérdezz vissza az alapokra, vagy mondj egy életszerű, modern analógiát (gaming, sport, közösségi média). Max 2-3 mondat, tegeződve, semmi preamble.`,
      2: `A diák másodszor is hibázott. Adj meg egy konkrét részletszabályt vagy képletet, ami elvezet a megoldáshoz, majd kérdezd meg, hogyan alkalmazná a feladatban. Max 2-3 mondat, tegeződve.`,
      3: `A diák harmadszor is elakadt. Vezesd le a feladat ELSŐ FELÉT (az első 1-2 logikai lépést) teljes részletességgel, és csak az utolsó logikai lépést hagyd meg neki befejezésre. Max 4 mondat, tegeződve.`
    };

    const user = `Tantárgy: ${subject} | Témakör: ${topic}\nKérdés: ${questionText}\nHelyes válasz: ${correctAnswer}\nDiák válasza: "${studentAnswer}"`;

    try {
      const result = await this._callModelWithFallback(
        this.reasoningModel,
        this.reasoningFallback,
        [{ role: 'system', content: prompts[level] }, { role: 'user', content: user }],
        { temperature: 0.65, max_tokens: 300 }
      );
      return result?.trim() || this._getFallbackHint(attemptNumber);
    } catch (error) {
      console.error('[GroqService] Szókratészi tipp hiba:', error.message);
      return this._getFallbackHint(attemptNumber);
    }
  }

  _extractJSONArray(raw) {
    const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const text = mdMatch ? mdMatch[1] : raw;
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
    const objMatch = text.match(/\{[\s\S]*\}/);
    if (objMatch) {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj.questions)) return obj.questions;
    }
    throw new Error('Nem található JSON tömb a válaszban.');
  }

  _isHumanitiesSubject(subject) {
    const humanities = ['irodalom', 'magyar', 'történelem', 'földrajz', 'erkölcstan', 'hittan', 'művészet', 'ének', 'etika', 'társadalom'];
    return humanities.some(h => subject.toLowerCase().includes(h));
  }

  async _generateOutline(subject, topic, diffDesc, typeSpecs) {
    const total = typeSpecs.reduce((s, t) => s + t.count, 0);
    const typeLabels = {
      mcq: 'Feleletválasztós', true_false: 'Igaz/Hamis',
      short_answer: 'Nyílt végű', fill_blank: 'Hiányos szöveg',
      matching: 'Párosítás', ordering: 'Sorbarendezés'
    };
    const bloomTypes = typeSpecs.map(s => `${s.count} db ${typeLabels[s.type] || s.type}`).join(', ');
    const isHumanities = this._isHumanitiesSubject(subject);

    const aspectsInstruction = isHumanities
      ? `1. Bontsd fel a(z) "${topic}" témát 10 KÜLÖNBÖZŐ vizsgálati szempontra (pl. szereplők, helyszínek, motívumok, szimbólumok, cselekményfordulatok, stílus, korabeli háttér, szerkezet, műfaj, üzenet).
2. Véletlenszerűen válassz ki 3-at.
3. Minden kérdéshez rendelj egy szempontot + konkrét kérdési fókuszt + Bloom-szintet (Emlékezés/Értés/Alkalmazás/Elemzés/Értékelés).`
      : `1. Bontsd fel a főtémát 10 ritkán érintett szempontra.
2. Véletlenszerűen válassz ki 3-at.
3. Minden kérdéshez rendelj egy szempontot + valódi, életszerű szituációt + Bloom-szintet (Emlékezés/Értés/Alkalmazás/Elemzés/Értékelés).`;

    const contextRule = isHumanities
      ? `KRITIKUS SZABÁLY: A kérdések KIZÁRÓLAG a(z) "${topic}" konkrét tartalmáról szólhatnak – a mű szereplőiről, cselekményéről, témáiról, stílusáról, korának kontextusáról. Tilos az anyag tartalmától független, általános vagy modern szituáció használata!`
      : `SZIGORÚ SZABÁLY: Tilos az elcsépelt tankönyvi példák (pl. alma/torta a törteknél, vonat-sebesség stb.). Modern, releváns kontextust használj (gaming, sport, technológia stb.).`;

    const exampleLine = isHumanities
      ? `1. Kérdés (Emlékezés). Szempont: Főszereplők. Fókusz: Baradlay Ödön jellemének bemutatása a regény elején.
2. Kérdés (Elemzés). Szempont: Szimbolika. Fókusz: A kőszív mint szimbólum értelmezése.`
      : `1. Kérdés (Alkalmazás). Altéma: Hálózati sávszélesség. Szituáció: Egy e-sport csapat szerverének terheltségét kell kiszámolni.
2. Kérdés (Értés). Altéma: ...`;

    const prompt = `Te egy tapasztalt pedagógus-stratéga vagy. Készíts TÖMÖR, SIMA SZÖVEGES vázlatot (NEM JSON-t!) ${total} dolgozat-kérdéshez.
Tantárgy: ${subject} | Témakör: "${topic}" | Nehézség: ${diffDesc}
Kért feladattípusok: ${bloomTypes}

FELADATOD:
${aspectsInstruction}

${contextRule}

KIMENET – sima szöveg, például:
${exampleLine}`;

    return await this._callModelWithFallback(
      this.reasoningModel,
      this.reasoningFallback,
      [{ role: 'system', content: prompt }],
      { temperature: 0.85, top_p: 0.9, max_tokens: 1500 }
    );
  }

  _getFewShotExamples(subject = '') {
    const isHumanities = this._isHumanitiesSubject(subject);
    if (isHumanities) {
      return `PÉLDA KÉRDÉSEK – ilyen minőséget és formátumot várunk el (JSON tömb elemek):
{"questionText":"Melyik szereplő mondja a regényben: 'Nem ismerek el más törvényt, mint a becsületet'?","questionType":"mcq","options":["Baradlay Richárd","Baradlay Ödön","Plankenhorst Alfonsine","Baradlay Jenő"],"pairs":[],"items":[],"correctAnswer":"Baradlay Richárd","explanation":"Richárd a hazájához hű, elvhű katona."}
{"questionText":"Párosítsd a szereplőket a regénybeli szerepükkel:","questionType":"matching","options":["Az osztrák udvar kémje, aki a Baradlay fiúk ellen dolgozik","A legidősebb Baradlay fiú, aki eleinte az ellenség oldalán harcol","A legfiatalabb Baradlay fiú, a szabadságharc hőse"],"pairs":[{"left":"Plankenhorst Alfonsine","right":"Az osztrák udvar kémje, aki a Baradlay fiúk ellen dolgozik"},{"left":"Baradlay Ödön","right":"A legidősebb Baradlay fiú, aki eleinte az ellenség oldalán harcol"},{"left":"Baradlay Jenő","right":"A legfiatalabb Baradlay fiú, a szabadságharc hőse"}],"items":[],"correctAnswer":{"Plankenhorst Alfonsine":"Az osztrák udvar kémje, aki a Baradlay fiúk ellen dolgozik","Baradlay Ödön":"A legidősebb Baradlay fiú, aki eleinte az ellenség oldalán harcol","Baradlay Jenő":"A legfiatalabb Baradlay fiú, a szabadságharc hőse"},"explanation":""}
{"questionText":"A kőszívű ember fiai című regény a(z) ___ szabadságharc eseményeire épül.","questionType":"fill_blank","options":[],"pairs":[],"items":[],"correctAnswer":"1848–49-es","explanation":"Jókai Mór az 1848–49-es forradalmat és szabadságharcot dolgozza fel a műben."}`;
    }
    return `PÉLDA KÉRDÉSEK – ilyen minőséget és formátumot várunk el (JSON tömb elemek):
{"questionText":"Egy streamer nézőszáma januárban 1200 fő volt, februárban 35%-kal nőtt. Hány néző volt februárban?","questionType":"mcq","options":["1620 néző","1560 néző","1440 néző","1800 néző"],"pairs":[],"items":[],"correctAnswer":"1620 néző","explanation":"1200 × 1,35 = 1620"}
{"questionText":"Párosítsd a fogalmakat a definícióikkal:","questionType":"matching","options":["Egy érték tárolására alkalmas memóriacím","Egy függvény saját magát hívja meg","Azonos nevű metódusok különböző paraméterekkel"],"pairs":[{"left":"Változó","right":"Egy érték tárolására alkalmas memóriacím"},{"left":"Rekurzió","right":"Egy függvény saját magát hívja meg"},{"left":"Túlterhelés","right":"Azonos nevű metódusok különböző paraméterekkel"}],"items":[],"correctAnswer":{"Változó":"Egy érték tárolására alkalmas memóriacím","Rekurzió":"Egy függvény saját magát hívja meg","Túlterhelés":"Azonos nevű metódusok különböző paraméterekkel"},"explanation":""}
{"questionText":"Az adatátvitel sebességét ___ határozza meg a hálózatban.","questionType":"fill_blank","options":[],"pairs":[],"items":[],"correctAnswer":"sávszélesség","explanation":"A sávszélesség határozza meg az adatátvitel sebességét."}`;
  }

  async _generateQuestionsChunked(outline, subject, topic, diffDesc, typeSpecs, fewShotExamples) {
    const typeDescriptions = {
      mcq:          '"mcq": feleletválasztós, 4 valós szöveges lehetőség (NEM betűjelölők!). options: ["Első válasz","Második válasz","Harmadik válasz","Negyedik válasz"], correctAnswer: "Első válasz"',
      true_false:   '"true_false": igaz/hamis. KÖTELEZŐ: a questionText KIJELENTŐ MONDAT legyen (pl. "A fotoszintézis során a növények CO2-t vesznek fel.") – TILOS kérdőmondat, összehasonlítás, "melyik" kezdetű szöveg! options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"',
      short_answer: '"short_answer": rövid szöveges válasz. options: [], correctAnswer: "szöveges válasz"',
      fill_blank:   '"fill_blank": szövegkiegészítős, az üres helyet ___ jelöli (több ___ is lehet). options: [], correctAnswer: "hiányzó szó" (több üres helynél: "szó1|szó2")',
      matching:     '"matching": párosítás. BAL OLDAL = rövid fogalom/esemény/személy (1-4 szó), JOBB OLDAL = RÉSZLETES magyarázat/következmény/jellemzés (min. 6 szó, SOHA NEM EGYSZERŰ ÁTNEVEZÉS!). A jobb oldal NEM tartalmazhatja a bal oldal szavait! pairs: [{"left":"fogalom","right":"Részletes magyarázat ami nem tartalmazza a fogalom szavait"},...], options: [jobb oldali értékek keverve]',
      ordering:     '"ordering": sorbarendezés. items: KEVEREDETT sorrendben, correctAnswer: helyes sorrend tömbként.',
    };

    const typeQueue = typeSpecs.flatMap(s => Array(s.count).fill(s.type));
    const allQuestions = [];
    const chunkSize = 2;

    while (typeQueue.length > 0) {
      const chunk = typeQueue.splice(0, chunkSize);
      const chunkSpecs = chunk.reduce((acc, type) => {
        const existing = acc.find(a => a.type === type);
        if (existing) existing.count++;
        else acc.push({ type, count: 1 });
        return acc;
      }, []);

      const previousContext = allQuestions.length > 0
        ? `\nEddig generált kérdések (KERÜLD a szóhasználatban és megközelítésben való ismétlést!):\n${JSON.stringify(allQuestions.map(q => ({ text: q.questionText, type: q.questionType })), null, 2)}\n`
        : '';

      const chunkTypeLines = chunkSpecs.map(s =>
        `- PONTOSAN ${s.count} db ${s.type} típusú kérdés. Formátum: ${typeDescriptions[s.type] || '"short_answer"'}`
      ).join('\n');

      const topicAnchor = `KRITIKUS KÖVETELMÉNY: Minden kérdés KIZÁRÓLAG a(z) "${subject}" tantárgy "${topic}" témájáról szólhat! A vázlat szempontjait kövesd, de soha ne távolodj el a tényleges tananyag tartalmától!`;

      const prompt = `${fewShotExamples}

Te egy precíz JSON generáló AI vagy. A Qwen által készített vázlat alapján generálj pontosan ${chunk.length} ÚJ kérdést.

${topicAnchor}

VÁZLAT (Qwen szempontjai – kövesd a fókuszokat!):
${outline}
${previousContext}
MOSTANI FELADAT – generálj PONTOSAN ${chunk.length} kérdést:
${chunkTypeLines}

SZABÁLYOK:
1. MCQ options SOHA ne tartalmazzon puszta betűket ("A","B","C","D") – valódi szöveges válaszok kellenek!
2. matching options KIZÁRÓLAG a jobb oldali (right) értékeket tartalmazza keverve – SOHA a bal oldalit!
3. fill_blank kérdésben KÖTELEZŐ az ___ jelölő!
4. ordering items tömbje KEVEREDETT sorrendben legyen!
5. Minden kérdés a(z) "${topic}" témáról szóljon – semmi egyéb!

VÁLASZOLJ KIZÁRÓLAG ÉRVÉNYES JSON TÖMB FORMÁTUMBAN (semmi egyéb szöveg!):
[{"questionText":"...","questionType":"...","options":[],"pairs":[],"items":[],"correctAnswer":"...","explanation":"..."}]`;

      try {
        if (allQuestions.length > 0) {
          await sleep(3000); // Várakozás a chunk-ok között (RPM/TPM kímélés)
        }
        console.log(`[GroqService]   → chunk: [${chunk.join(', ')}]`);
        const raw = await this._callModelWithFallback(
          this.fastModel,
          this.fastFallback,
          [{ role: 'system', content: prompt }],
          { temperature: 0.7, max_tokens: 2000 }
        );


        const parsed = this._extractJSONArray(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allQuestions.push(...parsed);
          console.log(`[GroqService]   ✓ chunk kész (+${parsed.length} kérdés)`);
        }
      } catch (e) {
        console.warn(`[GroqService]   ✗ chunk sikertelen (${chunk.join(',')}):`, e.message);
        chunk.forEach(type => {
          const fallbackTexts = {
            true_false: `Igaz vagy hamis? A(z) "${topic}" témakör tananyagának részét képezi a kurzusnak.`,
            mcq: `Melyik állítás igaz a(z) "${topic}" témával kapcsolatban?`,
            fill_blank: `A(z) "${topic}" témában az egyik kulcsfogalom: ___.`,
            matching: `Párosítsd a(z) "${topic}" témához kapcsolódó fogalmakat a definícióikkal:`,
            ordering: `Rendezd sorba a(z) "${topic}" témához kapcsolódó fogalmakat:`,
            short_answer: `Foglald össze röviden, mit tudsz a(z) "${topic}" témáról!`
          };
          const fallbackOrderingItems = [`${topic} első eleme`, `${topic} második eleme`, `${topic} harmadik eleme`];
          allQuestions.push({
            questionText: fallbackTexts[type] || `Mit tudsz a(z) "${topic}" témáról?`,
            questionType: type,
            options: type === 'mcq'
              ? ['Igaz állítás a témáról', 'Helytelen állítás a témáról', 'Részben igaz állítás', 'Teljesen más témáról szól']
              : (type === 'true_false' ? ['Igaz', 'Hamis'] : []),
            pairs: type === 'matching'
              ? [{ left: 'Fogalom 1', right: 'Definíció 1' }, { left: 'Fogalom 2', right: 'Definíció 2' }]
              : [],
            items: type === 'ordering' ? this._shuffle([...fallbackOrderingItems]) : [],
            correctAnswer: type === 'true_false' ? 'Igaz'
              : type === 'mcq' ? 'Igaz állítás a témáról'
              : type === 'ordering' ? fallbackOrderingItems
              : type === 'matching' ? { 'Fogalom 1': 'Definíció 1', 'Fogalom 2': 'Definíció 2' }
              : 'Logikus, témába vágó válasz elfogadható.',
            explanation: ''
          });
        });
      }
    }

    return allQuestions;
  }

  // Dolgozat-specifikus generálás: kétfázisú pipeline (Qwen vázlat → Llama chunking)
  async generateExamQuestionSet(subject, topic, diffDesc, typeSpecs) {
    // === 1. FÁZIS: Qwen 3 32B – kreatív szöveges vázlat ===
    let outline = '';
    try {
      console.log('[GroqService] 1. fázis: vázlat generálása (Qwen)...');
      outline = await this._generateOutline(subject, topic, diffDesc, typeSpecs);
      console.log('[GroqService] ✓ Vázlat kész:', outline.substring(0, 150).replace(/\n/g, ' '));
    } catch (e) {
      console.warn('[GroqService] Vázlat generálás sikertelen, általános vázlattal folytatom:', e.message);
      outline = `Általános vázlat: modern, életszerű szituációk a "${topic}" témában, különféle altémákkal.`;
    }

    // === 2. FÁZIS: Llama 3.3 70B – JSON kérdések chunking alapon ===
    try {
      console.log('[GroqService] 2. fázis: kérdések generálása Llama chunkingban...');
      const fewShot = this._getFewShotExamples(subject);
      const rawQuestions = await this._generateQuestionsChunked(outline, subject, topic, diffDesc, typeSpecs, fewShot);

      if (rawQuestions.length > 0) {
        const mapped = rawQuestions.map((q, idx) => ({
          questionId:    q.questionId || `q${idx + 1}`,
          questionText:  q.questionText || 'Hiányzó kérdés',
          questionType:  ['mcq', 'true_false', 'short_answer', 'fill_blank', 'matching', 'ordering'].includes(q.questionType) ? q.questionType : 'short_answer',
          options:       Array.isArray(q.options) ? q.options : [],
          pairs:         Array.isArray(q.pairs) ? q.pairs : [],
          items:         Array.isArray(q.items) ? q.items : [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
          explanation:   q.explanation || ''
        }));
        console.log(`[GroqService] ✓ Kétfázisú generálás kész: ${mapped.length} kérdés`);
        return this._sanitizeQuestions(mapped, 3);
      }
    } catch (e) {
      console.warn('[GroqService] Kétfázisú generálás sikertelen, egyfázisú fallback:', e.message);
    }

    // === FALLBACK: egyfázisú Qwen generálás (eredeti módszer) ===
    console.log('[GroqService] Fallback: egyfázisú generálás...');
    const total = typeSpecs.reduce((s, t) => s + t.count, 0);
    const typeDescriptions = {
      mcq:          '"mcq": feleletválasztós, 4 valós szöveges lehetőség (NEM betűjelölők!). options: ["Első válasz szövege","Második válasz szövege","Harmadik válasz szövege","Negyedik válasz szövege"], correctAnswer: "Első válasz szövege"',
      true_false:   '"true_false": igaz/hamis. KÖTELEZŐ: a questionText KIJELENTŐ MONDAT legyen (pl. "A fotoszintézis során a növények CO2-t vesznek fel.") – TILOS kérdőmondat, összehasonlítás! options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"',
      short_answer: '"short_answer": rövid szöveges válasz. options: [], correctAnswer: "szöveges válasz"',
      fill_blank:   '"fill_blank": szövegkiegészítős, az üres helyet ___ jelöli (több ___ is lehet). options: [], correctAnswer: "hiányzó szó" (több üres helynél: "szó1|szó2")',
      matching:     '"matching": párosítás. BAL OLDAL = rövid fogalom (1-3 szó), JOBB OLDAL = részletes definíció (teljes mondat, min. 5 szó). pairs: [{"left":"fogalom","right":"Részletes definíció..."},...], options: ["jobb oldali def. keverve",...], correctAnswer: {"fogalom":"Részletes definíció..."}',
      ordering:     '"ordering": sorba rendezés. items: KEVEREDETT sorrend, correctAnswer: helyes sorrend tömbként. items: ["C elem","A elem","B elem"], correctAnswer: ["A elem","B elem","C elem"]',
    };
    const typeLines = typeSpecs.map(s => {
      const desc = typeDescriptions[s.type] || `"${s.type}": rövid szöveges válasz`;
      return `- PONTOSAN ${s.count} darab ${s.type} típusú kérdés. Formátum: ${desc}`;
    }).join('\n');
    const fallbackPrompt = `Te egy kreatív és tapasztalt pedagógus AI vagy. Készíts pontosan ${total} darab KIVÁLÓ MINŐSÉGŰ vizsgakérdést ${subject} tantárgyból, a "${topic}" témakörhöz.
Nehézség: ${diffDesc}
KÖTELEZŐ TÍPUSOK ÉS DARABSZÁMOK (tartsd be szigorúan!):
${typeLines}
FONTOS SZABÁLYOK:
1. Az MCQ options tömbben SOHA ne szerepeljenek puszta betűk – mindig valódi szöveges válaszok!
2. A matching options tömb KIZÁRÓLAG a jobb oldali definíciókat tartalmazza (keverve)!
3. A fill_blank kérdésben KÖTELEZŐ az ___ jelölő!
4. Az ordering items tömbje KEVEREDETT sorrendben legyen!
5. SZIGORÚ SZABÁLY: A válaszod KIZÁRÓLAG egy érvényes JSON blokk legyen (\`\`\`json ... \`\`\`), semmi egyéb!
{"questions":[{"questionId":"q1","questionText":"...","questionType":"mcq","options":[],"pairs":[],"items":[],"correctAnswer":"...","explanation":"..."}]}`;

    let raw = '';
    try {
      raw = await this.generateResponse(fallbackPrompt, [], { temperature: 0.65, max_tokens: 6000 }, true);
      const parsed = this._extractJSON(raw);
      if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        const mapped = parsed.questions.map((q, idx) => ({
          questionId:    q.questionId || `q${idx + 1}`,
          questionText:  q.questionText || 'Hiányzó kérdés',
          questionType:  ['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(q.questionType) ? q.questionType : 'short_answer',
          options:       Array.isArray(q.options) ? q.options : [],
          pairs:         Array.isArray(q.pairs) ? q.pairs : [],
          items:         Array.isArray(q.items) ? q.items : [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
          explanation:   q.explanation || ''
        }));
        return this._sanitizeQuestions(mapped, 3);
      }
    } catch (error) {
      console.warn('[GroqService] Fallback generálás is sikertelen:', error.message);
      if (raw) console.warn('[GroqService] Nyers válasz:', raw.substring(0, 800));
    }

    // Végső fallback: típus-tudatos statikus kérdések
    const staticFallback = [];
    const fallbackTexts = {
      true_false: `Igaz-e, hogy a(z) "${topic}" témakör fontos részét képezi a tananyagnak?`,
      mcq: `Melyik fogalom kapcsolódik közvetlenül a(z) "${topic}" témához?`,
      fill_blank: `A(z) "${topic}" témában az egyik legfontosabb fogalom: ___.`,
      matching: `Párosítsd a(z) "${topic}" témához tartozó fogalmakat a leírásukkal:`,
      ordering: `Rendezd időrendi/logikai sorrendbe a(z) "${topic}" témához kapcsolódó elemeket:`,
      short_answer: `Foglald össze röviden a(z) "${topic}" témakör lényegét!`
    };
    typeSpecs.forEach(({ type, count }) => {
      for (let i = 0; i < count; i++) {
        staticFallback.push({
          questionId:    `q${staticFallback.length + 1}`,
          questionText:  fallbackTexts[type] || `Mit tudsz a(z) "${topic}" témáról?`,
          questionType:  type,
          options:       type === 'mcq' ? ['Az első fogalom','A második fogalom','A harmadik fogalom','A negyedik fogalom'] : (type === 'true_false' ? ['Igaz','Hamis'] : []),
          pairs:         [],
          items:         [],
          correctAnswer: type === 'true_false' ? 'Igaz' : (type === 'mcq' ? 'Az első fogalom' : 'Logikus, témába vágó válasz elfogadható.'),
          explanation:   'Automatikusan generált tartalék kérdés.'
        });
      }
    });
    return staticFallback;
  }

  async generatePracticeQuestionSet(subject, topic, difficulty = 3, count = 10, grade = 'általános iskola', weakQuestions = [], excludeQuestions = []) {
    const difficultyDescriptions = {
      1: '1-2. osztályos szint: egyszerű tények felismerése, alapvető fogalmak azonosítása',
      2: '3-4. osztályos szint: alapfogalmak alkalmazása egyszerű szituációkban',
      3: '5-6. osztályos szint: összefüggések megértése, fogalmak összekapcsolása',
      4: '7-8. osztályos szint: több lépéses problémamegoldás, elemzés',
      5: 'Emelt szint: kritikai gondolkodás, absztrakt összefüggések, komplex feladatok'
    };

    const weakSection = weakQuestions && weakQuestions.length > 0
      ? `\nADAPTÍV FELADATOK: A diák az előző fejezetben nehéznek találta az alábbi kérdés(eke)t. Adj meg legalább ${Math.min(weakQuestions.length, 3)} hasonló témájú, de TELJESEN ELTÉRŐ szituációba ágyazott kérdést, hogy megerősítsd a tudást:\n${weakQuestions.map((wq, i) => `  ${i+1}. [${wq.questionType}] "${wq.questionText}"`).join('\n')}\n`
      : '';

    const excludeSection = excludeQuestions && excludeQuestions.length > 0
      ? `\nKIZÁRANDÓ KÉRDÉSEK (Ezeket tilos megismételni!): \n${excludeQuestions.map((eq, i) => `  ${i+1}. "${eq.questionText}"`).join('\n')}\n`
      : '';

    const seenContexts = [
      ...(weakQuestions || []),
      ...(excludeQuestions || [])
    ].slice(-6).map(q => q.questionText?.substring(0, 55)).filter(Boolean);
    const negativePrompt = seenContexts.length > 0
      ? `\nSZIGORÚ SZABÁLY: Ezeket a szituációkat/kontextusokat a diák már látta – TILOS hasonlókat generálni:\n${seenContexts.map((c, i) => `  ${i+1}. "${c}..."`).join('\n')}\nTeljesen új, eltérő környezetbe ágyazott feladatokat készíts, amelyek ugyanazt a logikát tesztelik!\n`
      : '';

    const prompt = `Te egy kreatív és tapasztalt pedagógus AI vagy. Készíts pontosan ${count} darab KIVÁLÓ MINŐSÉGŰ, érdekes és gondolkodtató gyakorló kérdést ${subject} tantárgyból, a "${topic}" témakörhöz egy ${grade} osztályos tanulónak.
Nehézség: ${difficulty}/5 – ${difficultyDescriptions[difficulty] || difficultyDescriptions[3]}
${weakSection}${excludeSection}${negativePrompt}
FONTOS: NE generálj hanganyagot, videót vagy külső médiát igénylő kérdést! Minden kérdés önállóan, kizárólag szöveg alapján legyen megválaszolható!

Kerüld a túl száraz, bemagolható definíciókat! Használj valós életből vett, kreatív példákat és szituációkat, amik felkeltik a diák érdeklődését és a tényleges megértést tesztelik.

KÖTELEZŐ: legalább 6 különböző feladattípust használj, ezeket a típusokat:
- "mcq": feleletválasztós, 4 valós szöveges lehetőség (NEM betűjelölők!). options: ["Első válasz szövege","Második válasz szövege","Harmadik válasz szövege","Negyedik válasz szövege"], correctAnswer: "Első válasz szövege"
- "true_false": igaz/hamis. KÖTELEZŐ: a questionText KIJELENTŐ MONDAT legyen (pl. "A naprendszer 8 bolygóból áll.") – TILOS kérdőmondat, összehasonlítás ("melyik", "hogyan", "mi a különbség")! options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"
- "short_answer": rövid szöveges válasz. FONTOS: ha a kérdés egy mondatot/szöveget kell értékelni (pl. "Mi a helyes fogalmazás?", "Javítsd ki a mondatot!"), a teljes értékelendő szöveget/mondatot BEL KELL FOGLALNI a questionText-be! options: [], correctAnswer: "szöveges válasz"
- "fill_blank": szövegkiegészítős, az üres helyet ___ jelöli (egy kérdésben akár 2-3 ___ is lehet). options: [], correctAnswer: "hiányzó szó" (több üres helynél |-vel elválasztva: "szó1|szó2")
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
      raw = await this.generateResponse(prompt, [], { temperature: 0.7, max_tokens: 5000 });

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

  async _generateDiagnosticOutline(subject, grade, count) {
    const prompt = `Te egy kreatív pedagógus-stratéga vagy.
Tantárgy: ${subject} | Évfolyam: ${grade} | Kérdések száma: ${count}

FELADATOD:
1. Bontsd fel a tantárgyat 10 SPECIFIKUS mikro-képességre (pl. "Szövegértés: ok-okozati összefüggések felismerése", "Algebra: lineáris egyenletek megoldása").
2. Véletlenszerűen válassz ki 3-at.
3. Minden kérdéshez rendelj: mikro-képesség + valódi, modern szituáció (Persona/Scenario: gaming, sport, social media, tech) + Bloom-szint (Emlékezés/Értés/Alkalmazás/Elemzés/Értékelés).

SZIGORÚ SZABÁLY: Tilos az elcsépelt tankönyvi példák használata (alma/torta, vonat-sebesség, elvont halmazok). Modern, a mai generáció számára releváns kontextust használj.

KIMENET – sima szöveg (NEM JSON!), pl.:
1. Kérdés (Alkalmazás). Mikro-képesség: Százalékszámítás. Szituáció: Egy streamer nézőinek száma 35%-kal nőtt januárban.
2. Kérdés (Értés). Mikro-képesség: ...`;

    return await this._callModelWithFallback(
      this.reasoningModel,
      this.reasoningFallback,
      [{ role: 'system', content: prompt }],
      { temperature: 0.85, top_p: 0.9, max_tokens: 1200 }
    );

  }

  async _generateDiagnosticQuestionsChunked(outline, subject, grade, count, currentLevel) {
    const gradeNum = parseInt(grade) || 4;
    const baseDifficulty = Math.max(1, Math.min(5, Math.ceil(gradeNum / 2)));
    const levelBonus = Math.floor((Math.max(1, Math.min(10, currentLevel)) - 1) / 3);
    const effectiveDifficulty = Math.max(1, Math.min(5, baseDifficulty + levelBonus));

    const typePool = ['mcq', 'true_false', 'short_answer', 'fill_blank', 'matching', 'ordering'];
    const chunkSize = 3;
    const totalChunks = Math.ceil(count / chunkSize);
    const allQuestions = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunkCount = i === totalChunks - 1 ? count - allQuestions.length : chunkSize;
      if (chunkCount <= 0) break;

      const usedTypes = allQuestions.map(q => q.questionType);
      const preferredTypes = typePool.filter(t => !usedTypes.includes(t));
      const typeHint = preferredTypes.slice(0, chunkCount).join(', ') || 'mcq, short_answer';

      const prevContext = allQuestions.length > 0
        ? `\nEddig generált kérdések (KERÜLD a szóhasználat és megközelítés ismétlését):\n${JSON.stringify(allQuestions.map(q => ({ text: q.questionText.substring(0, 60), type: q.questionType })))}\n`
        : '';

      const prompt = `Te egy precíz diagnosztikai kérdés-generáló AI vagy.

VÁZLAT (Qwen tervei):
${outline}
${prevContext}
Generálj PONTOSAN ${chunkCount} kérdést a vázlat alapján!
Preferált típusok: ${typeHint}
Nehézség: ~${effectiveDifficulty}/5
Kötelező: minden kérdésnek legyen "category" mezője (a mikro-képesség neve).

SZABÁLYOK:
- MCQ: 4 valódi szöveges option (nem betűjelölő), correctAnswer = az egyik option szövege
- true_false: KÖTELEZŐ KIJELENTŐ MONDAT (nem kérdés, nem összehasonlítás!), options: ["Igaz","Hamis"]
- fill_blank: a szövegben kötelező a ___ jelölő (akár több is), correctAnswer több üres helynél "szó1|szó2"
- matching: options CSAK a jobb oldali értékek (keverve), pairs: [{"left":"...","right":"..."}]
- ordering: items KEVEREDETT sorrendben, correctAnswer helyes sorrendként

VÁLASZOLJ KIZÁRÓLAG JSON TÖMB FORMÁTUMBAN (semmi egyéb szöveg!):
[{"questionText":"...","questionType":"mcq|true_false|short_answer|fill_blank|matching|ordering","category":"...","difficulty":${effectiveDifficulty},"options":[],"pairs":[],"items":[],"correctAnswer":"...","explanation":"..."}]`;

      try {
        if (allQuestions.length > 0) {
          await sleep(3000); // Szünet a diagnosztika chunk-ok között (TPM kímélés)
        }

        console.log(`[GroqService]   → diagnosztika chunk ${i + 1}/${totalChunks} (${chunkCount} kérdés)`);
        const raw = await this._callModelWithFallback(
          this.fastModel,
          this.fastFallback,
          [{ role: 'system', content: prompt }],
          { temperature: 0.7, max_tokens: 2500 }
        );

        const parsed = this._extractJSONArray(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allQuestions.push(...parsed.slice(0, chunkCount));
          console.log(`[GroqService]   ✓ diagnosztika chunk kész (+${parsed.length} kérdés)`);
        } else {
          throw new Error('Üres vagy érvénytelen válasz a chunk-ban.');
        }
      } catch (e) {
        console.warn(`[GroqService]   ✗ diagnosztika chunk ${i + 1} sikertelen:`, e.message);
        // Fallback kérdések hozzáadása, hogy a folyamat ne szakadjon meg és a darabszám stimmeljen
        for (let j = 0; j < chunkCount; j++) {
          const type = typePool[j % typePool.length];
          allQuestions.push({
            questionText: `Diagnosztikai kérdés (${subject}): Mi a véleményed a(z) ${subject} fontosságáról?`,
            questionType: type === 'mcq' ? 'mcq' : 'short_answer',
            category: 'Általános',
            difficulty: effectiveDifficulty,
            options: type === 'mcq' ? ['Nagyon fontos', 'Fontos', 'Kevéssé fontos', 'Nem fontos'] : [],
            pairs: [],
            items: [],
            correctAnswer: type === 'mcq' ? 'Nagyon fontos' : 'Pozitív válasz elvárt.',
            explanation: 'Tartalék kérdés technikai hiba esetén.'
          });
        }
      }
    }

    return allQuestions;
  }

  async generateDiagnosticTest(subject, grade, count = 20, currentLevel = 1) {
    const gradeNum = parseInt(grade) || 4;
    const baseDifficulty = Math.max(1, Math.min(5, Math.ceil(gradeNum / 2)));
    const levelBonus = Math.floor((Math.max(1, Math.min(10, currentLevel)) - 1) / 3);
    const effectiveDifficulty = Math.max(1, Math.min(5, baseDifficulty + levelBonus));

    // === FÁZIS 1: Qwen vázlat ===
    let outline = '';
    try {
      console.log('[GroqService] Diagnosztika 1. fázis: vázlat generálása (Qwen)...');
      outline = await this._generateDiagnosticOutline(subject, grade, count);
      console.log('[GroqService] ✓ Diagnosztika vázlat kész:', outline.substring(0, 100).replace(/\n/g, ' '));
    } catch (e) {
      console.warn('[GroqService] Diagnosztika vázlat sikertelen, egyfázisú fallbackre váltok:', e.message);
      outline = '';
    }

    // === FÁZIS 2: Llama chunking (csak ha van vázlat) ===
    if (outline) {
      try {
        console.log('[GroqService] Diagnosztika 2. fázis: kérdések generálása (Llama chunking)...');
        const questions = await this._generateDiagnosticQuestionsChunked(outline, subject, grade, count, currentLevel);
        if (questions.length >= Math.floor(count * 0.7)) {
          const subjectCategories = {
            'Matematika': ['Algebra', 'Geometria', 'Statisztika', 'Függvények', 'Számelmélet', 'Mértékegységek'],
            'Magyar': ['Nyelvtan', 'Irodalom', 'Fogalmazás', 'Helyesírás', 'Szövegértés', 'Nyelvhelyesség'],
            'Angol': ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Comprehension', 'Communication'],
            'Környezetismeret': ['Földrajz', 'Biológia', 'Fizika', 'Kémia', 'Társadalomismeret', 'Környezetvédelem']
          };
          const categories = subjectCategories[subject] || ['Általános'];
          const mapped = questions.map((q, idx) => ({
            questionId:    q.questionId || `d${idx + 1}`,
            questionText:  q.questionText || 'Hiányzó kérdés',
            questionType:  ['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(q.questionType) ? q.questionType : 'mcq',
            category:      q.category || categories[idx % categories.length],
            difficulty:    q.difficulty || effectiveDifficulty,
            options:       Array.isArray(q.options) ? q.options : [],
            pairs:         Array.isArray(q.pairs) ? q.pairs : [],
            items:         Array.isArray(q.items) ? q.items : [],
            correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
            explanation:   q.explanation || ''
          }));
          console.log(`[GroqService] ✓ Diagnosztika kétfázisú generálás kész: ${mapped.length} kérdés`);
          return this._sanitizeQuestions(mapped, baseDifficulty);
        }
      } catch (e) {
        console.warn('[GroqService] Diagnosztika chunking sikertelen, egyfázisú fallback:', e.message);
      }
    }

    // === FALLBACK: egyfázisú Qwen generálás ===
    console.log('[GroqService] Diagnosztika fallback: egyfázisú generálás...');
    const subjectCategories = {
      'Matematika': ['Algebra', 'Geometria', 'Statisztika', 'Függvények', 'Számelmélet', 'Mértékegységek'],
      'Magyar': ['Nyelvtan', 'Irodalom', 'Fogalmazás', 'Helyesírás', 'Szövegértés', 'Nyelvhelyesség'],
      'Angol': ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Comprehension', 'Communication'],
      'Környezetismeret': ['Földrajz', 'Biológia', 'Fizika', 'Kémia', 'Társadalomismeret', 'Környezetvédelem']
    };
    const categories = subjectCategories[subject] || ['Általános'];

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
- "true_false": igaz/hamis. KÖTELEZŐ: a questionText KIJELENTŐ MONDAT legyen (pl. "A Hold a Föld természetes holdja.") – TILOS kérdőmondat, összehasonlítás ("melyik", "hogyan", "mi a különbség" stb.)! options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"
- "short_answer": rövid szöveges válasz. FONTOS: ha a kérdés egy szöveget/mondatot értékel, azt a szöveget be kell illeszteni a questionText-be! options: [], correctAnswer: "szöveges válasz"
- "fill_blank": szövegkiegészítős (az üres helyet ___ jelöli, akár 2-3 ___ is lehet). options: [], correctAnswer: "hiányzó szó" (több üres helynél |-vel elválasztva: "szó1|szó2")
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
    const level = Math.min(attemptNumber, 3);

    // Few-shot: utolsó 2 helyes kérdés-válasz pár kontextusként
    const successes = previousAnswers
      .filter(a => a.isCorrect)
      .slice(-2)
      .map(a => {
        const q = allQuestions.find(q => q.questionId === a.questionId);
        return q
          ? `"${q.questionText.substring(0, 60)}" → Helyes: "${String(a.studentAnswer).substring(0, 40)}"`
          : null;
      })
      .filter(Boolean);
    const fewShotCtx = successes.length > 0
      ? `\nEmlékeztetőül: ezeket már helyesen tudtad: ${successes.join('; ')}.`
      : '';

    const prompts = {
      1: `Te vagy Szókratész. TILOS megmondani a megoldást. Kérdezz az alapokra, vagy adj életszerű analógiát! Max 3 mondat, tegeződve.${fewShotCtx}`,
      2: `A diák másodszor hibázott. Adj konkrét részletszabályt, kérdezd meg, hogyan alkalmazná. Max 3 mondat, tegeződve.${fewShotCtx}`,
      3: `Harmadik hiba. Vezesd le a feladat első felét, az utolsó lépést hagyd neki. Max 4 mondat, tegeződve.${fewShotCtx}`
    };

    const correct = previousAnswers.filter(a => a.isCorrect).length;
    const total = allQuestions.length;

    const historyMessages = chatHistory
      .filter(m => m.content && m.content.trim())
      .slice(-4)
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    const user = `Haladás: ${correct}/${total} helyes\nKérdés: ${currentQuestion.questionText}\nHelyes válasz (NE áruld el!): ${JSON.stringify(correctAnswer)}\nDiák válasza: "${JSON.stringify(studentAnswer)}"`;

    const messages = [
      { role: 'system', content: prompts[level] },
      ...historyMessages,
      { role: 'user', content: user }
    ];

    try {
      const result = await this._callModelWithFallback(
        this.reasoningModel,
        this.reasoningFallback,
        messages,
        { temperature: 0.65, max_tokens: 350 }
      );
      return result?.trim() || this._getFallbackHint(attemptNumber);
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
  "correct": true,
  "reason": "Rövid indoklás, hogy miért jó vagy rossz",
  "confidence": 0.9
}

A "confidence" értéke 0.0 és 1.0 között legyen: mennyire vagy biztos a döntésedben. Ha a válasz egyértelműen jó vagy rossz, legyen magas (0.85-1.0). Ha a szemantikai egyezés kétes, legyen alacsony (0.4-0.7).`;

    try {
      const raw = await this.generateResponse(prompt, [], { temperature: 0.1, max_tokens: 300 });
      const parsed = this._extractJSON(raw);
      return {
        correct: Boolean(parsed.correct),
        reason: parsed.reason || '',
        confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.8
      };
    } catch (error) {
      console.warn('[GroqService] checkShortTextAnswer parse hiba:', error.message);
    }

    // Fallback: kulcsszó-kereső algoritmus
    const norm = (s) => String(s).toLowerCase().trim().replace(/[.,!?]/g, '');
    const isMatch = norm(studentAnswer) === norm(correctAnswer) || norm(studentAnswer).includes(norm(correctAnswer));
    return {
      correct: isMatch,
      reason: 'Automatikus kulcsszó egyezés (AI nem elérhető).',
      confidence: 0.6
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

      // ordering: correctAnswer mindig legyen tömb
      if (questionType === 'ordering') {
        if (!Array.isArray(correctAnswer)) {
          if (typeof correctAnswer === 'string' && correctAnswer.includes('→')) {
            correctAnswer = correctAnswer.split('→').map(s => s.trim()).filter(Boolean);
          } else if (Array.isArray(items) && items.length > 0) {
            correctAnswer = [...items];
          } else {
            correctAnswer = [];
          }
          console.warn(`[GroqService] Ordering q${idx+1}: correctAnswer tömbbé alakítva`);
        }
        if (Array.isArray(items) && Array.isArray(correctAnswer) && correctAnswer.length > 0) {
          const sameOrder = items.length === correctAnswer.length &&
            items.every((it, i) => String(it) === String(correctAnswer[i]));
          if (sameOrder) {
            items = this._shuffle(items);
            console.warn(`[GroqService] Ordering q${idx+1}: items megkeverve (helyes sorrend volt)`);
          }
          const itemsInText = items.filter(it => String(it).length > 2 && questionText.includes(String(it)));
          if (itemsInText.length >= Math.floor(items.length * 0.5)) {
            const directionHint = questionText.match(/(növekvő|csökkenő|időrendi|folyamat|lépés|sorrend)/i)?.[0];
            questionText = directionHint
              ? `Rendezd ${directionHint.toLowerCase()} sorrendbe az elemeket:`
              : 'Rendezd sorba az elemeket a helyes sorrendnek megfelelően:';
            console.warn(`[GroqService] Ordering q${idx+1}: kérdésszöveg generikusra cserélve`);
          }
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
