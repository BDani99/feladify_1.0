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
      const payload = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1024,
        top_p: options.top_p || 1,
        stream: false
      };
      if (options.jsonMode) {
        payload.response_format = { type: 'json_object' };
      }
      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        payload,
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

  async *generateResponseStream(prompt, messages = [], options = {}, useReasoning = false) {
    if (!this.apiKey) {
      console.warn('[GroqService] FIGYELMEZTETÉS: API kulcs nincs beállítva!');
      yield "Hiba: Az API kulcs nincs beállítva.";
      return;
    }

    const allMessages = [{ role: 'system', content: prompt }, ...messages];
    const primaryModel = useReasoning ? this.reasoningModel : this.fastModel;

    try {
      const payload = {
        model: primaryModel,
        messages: allMessages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2048,
        top_p: options.top_p || 1,
        stream: true
      };

      console.log(`[GroqService] Stream API hívás → ${primaryModel}`);
      const response = await axios.post(
        `${this.apiBase}/chat/completions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'stream',
          timeout: 45000
        }
      );

      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned || cleaned === 'data: [DONE]') continue;
          if (cleaned.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(cleaned.slice(6));
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                yield delta;
              }
            } catch (e) {
              // ignore malformed lines
            }
          }
        }
      }
    } catch (error) {
      console.error('[GroqService] Stream error:', error.message);
      yield "Hiba történt a generálás során.";
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
      fill_blank:   '"fill_blank": szövegkiegészítős, PONTOSAN EGY ___ jelölővel. options: [], correctAnswer: egyetlen hiányzó szó/kifejezés, | jel nélkül',
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
3. fill_blank kérdésben KÖTELEZŐ pontosan egy ___ jelölő, és a correctAnswer egyetlen válasz legyen, | jel nélkül!
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
          const fallbackOrderingItems = [`${topic} alapfogalma`, `${topic} alkalmazása`, `${topic} ellenőrzése`];
          const fallbackPairs = [
            { left: 'Alapfogalom', right: `A(z) ${topic} témakör egyik kiinduló, megtanulandó eleme.` },
            { left: 'Alkalmazás', right: `A tanult ismeret használata konkrét feladat vagy példa megoldásában.` },
            { left: 'Ellenőrzés', right: `A megoldás átgondolása és összevetése a tanult szabályokkal.` }
          ];
          allQuestions.push({
            questionText: fallbackTexts[type] || `Mit tudsz a(z) "${topic}" témáról?`,
            questionType: type,
            options: type === 'mcq'
              ? ['Igaz állítás a témáról', 'Helytelen állítás a témáról', 'Részben igaz állítás', 'Teljesen más témáról szól']
              : (type === 'true_false' ? ['Igaz', 'Hamis'] : []),
            pairs: type === 'matching' ? fallbackPairs : [],
            items: type === 'ordering' ? this._shuffle([...fallbackOrderingItems]) : [],
            correctAnswer: type === 'true_false' ? 'Igaz'
              : type === 'mcq' ? 'Igaz állítás a témáról'
              : type === 'ordering' ? fallbackOrderingItems
              : type === 'matching' ? Object.fromEntries(fallbackPairs.map(p => [p.left, p.right]))
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
        const finalized = this._finalizeQuestionSet(mapped, typeSpecs, topic);
        console.log(`[GroqService] ✓ Kétfázisú generálás kész: ${finalized.length} validált kérdés`);
        return finalized;
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
      fill_blank:   '"fill_blank": szövegkiegészítős, PONTOSAN EGY ___ jelölővel. options: [], correctAnswer: egyetlen hiányzó szó/kifejezés, | jel nélkül',
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
3. A fill_blank kérdésben KÖTELEZŐ pontosan egy ___ jelölő, és a correctAnswer egyetlen válasz legyen, | jel nélkül!
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
        return this._finalizeQuestionSet(mapped, typeSpecs, topic);
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
    return this._finalizeQuestionSet(staticFallback, typeSpecs, topic);
  }

  _groupPromptHeader(subject, topic, difficulty, grade, weakQuestions, excludeQuestions) {
    const difficultyDescriptions = {
      1: '1-2. osztály: egyszerű tények',
      2: '3-4. osztály: alapfogalmak alkalmazása',
      3: '5-6. osztály: összefüggések megértése',
      4: '7-8. osztály: több lépéses problémamegoldás',
      5: 'Emelt szint: kritikai gondolkodás'
    };
    const weakSection = weakQuestions && weakQuestions.length > 0
      ? `\nA diák ezeket korábban nehéznek találta – építs rá, de TELJESEN ELTÉRŐ szituációval:\n${weakQuestions.slice(0, 3).map((wq, i) => `  ${i+1}. "${wq.questionText?.substring(0, 80)}"`).join('\n')}`
      : '';
    const excludeSection = excludeQuestions && excludeQuestions.length > 0
      ? `\nMÁR LÁTOTT kontextusok (TILOS hasonlót generálni):\n${excludeQuestions.slice(-6).map((eq, i) => `  ${i+1}. "${eq.questionText?.substring(0, 60)}..."`).join('\n')}`
      : '';
    return `Tantárgy: ${subject} | Téma: "${topic}" | Évf./Szint: ${grade} | Nehézség: ${difficulty}/5 (${difficultyDescriptions[difficulty] || difficultyDescriptions[3]})${weakSection}${excludeSection}

KÖZÖS SZABÁLYOK:
- Minden kérdés a(z) "${topic}" témáról szóljon, kizárólag szöveg alapján megoldható (NEM hang/videó).
- Kerüld a száraz definíciókat – használj életszerű, modern szituációkat (gaming, sport, tech, közösségi média), kivéve humán tárgyaknál a mű/korszak konkrét tartalmát.
- Minden kérdés EGYEDI legyen – ne ismételj fogalmakat.`;
  }

  _groupSpec(groupName) {
    const specs = {
      basic: {
        types: ['mcq', 'true_false'],
        instructions: `KÉRT TÍPUSOK ÉS DARABSZÁM:
- mcq (feleletválasztós): 4 valódi szöveges option, EGYIK helyes, correctAnswer = az adott option szövege MASOLATA
- true_false (igaz/hamis): a questionText KIJELENTŐ MONDAT legyen (nem kérdés), options: ["Igaz","Hamis"], correctAnswer: "Igaz" vagy "Hamis"

PÉLDÁK (másold a formátumot!):
✓ JÓ mcq: {"questionType":"mcq","questionText":"Egy streamer nézőszáma 1200-ról 35%-kal nőtt. Hányan néznek?","options":["1620 néző","1560 néző","1440 néző","1800 néző"],"correctAnswer":"1620 néző","explanation":"1200×1,35=1620"}
✗ ROSSZ mcq: options:["A","B","C","D"]  ← betűjelölők TILOSAK!

✓ JÓ true_false: {"questionType":"true_false","questionText":"A naprendszer 8 bolygóból áll.","options":["Igaz","Hamis"],"correctAnswer":"Igaz","explanation":"..."}
✗ ROSSZ true_false: {"questionText":"Hány bolygója van a naprendszernek?"}  ← KÉRDŐ MONDAT TILOS!`
      },
      text: {
        types: ['short_answer', 'fill_blank'],
        instructions: `KÉRT TÍPUSOK ÉS DARABSZÁM:
- short_answer: rövid szöveges válasz. options: [], correctAnswer: a várt válasz szövege.
- fill_blank: KÖTELEZŐ ___ jelölő a kérdésszövegben (1-3 db). options: []. correctAnswer: hiányzó szó (több helynél "szó1|szó2").

PÉLDÁK (másold a formátumot!):
✓ JÓ short_answer: {"questionType":"short_answer","questionText":"Mit jelent röviden a 'sávszélesség' fogalma az informatikában?","correctAnswer":"Az adatátvitel maximális sebessége egy hálózati kapcsolaton.","explanation":"..."}

✓ JÓ fill_blank: {"questionType":"fill_blank","questionText":"Az adatátvitel sebességét a ___ határozza meg a hálózatban.","correctAnswer":"sávszélesség","explanation":"..."}
✗ ROSSZ fill_blank: {"questionText":"Mi határozza meg az adatátvitel sebességét?"}  ← NINCS ___ jelölő!`
      },
      complex: {
        types: ['matching', 'ordering'],
        instructions: `KÉRT TÍPUSOK ÉS DARABSZÁM:
- matching (párosítás): pairs tömb (min 3 elem). left = rövid fogalom (1-3 szó), right = RÉSZLETES definíció (min 5 szó, NE tartalmazza a left szavait!). options = a right értékek KEVERVE. correctAnswer = {left: right} objektum.
- ordering (sorba rendezés): items tömb (min 3 elem) KEVEREDETT sorrendben, correctAnswer = a helyes sorrend tömbként.

KRITIKUS – ezeket SZIGORÚAN tartsd be:
1. matching questionText: ÁLTALÁNOS BEVEZETŐ (pl. "Párosítsd az alábbi fogalmakat a definícióikkal:"). TILOS felsorolni a bal oldali fogalmakat a szövegben!
2. matching options: KIZÁRÓLAG a right értékek keverve. SOHA ne tartalmazza a left értékeket!
3. ordering questionText: csak az irányt jelezd (pl. "Rendezd időrendi sorrendbe:"). TILOS felsorolni az items elemeit a szövegben!
4. ordering items: KEVEREDETT sorrendben legyen (ne ugyanaz, mint a correctAnswer!).

PÉLDÁK:
✓ JÓ matching:
{"questionType":"matching","questionText":"Párosítsd az informatikai fogalmakat a megfelelő definícióikkal:","pairs":[{"left":"Változó","right":"Egy érték tárolására alkalmas, megnevezett memóriahely a programban."},{"left":"Rekurzió","right":"Olyan eljárás, amelyben a függvény saját magát hívja meg részfeladat megoldására."},{"left":"Túlterhelés","right":"Több azonos nevű metódus létezése különböző paraméter-listával."}],"options":["Olyan eljárás, amelyben a függvény saját magát hívja meg részfeladat megoldására.","Több azonos nevű metódus létezése különböző paraméter-listával.","Egy érték tárolására alkalmas, megnevezett memóriahely a programban."],"correctAnswer":{"Változó":"Egy érték tárolására alkalmas, megnevezett memóriahely a programban.","Rekurzió":"Olyan eljárás, amelyben a függvény saját magát hívja meg részfeladat megoldására.","Túlterhelés":"Több azonos nevű metódus létezése különböző paraméter-listával."},"explanation":""}
✗ ROSSZ matching:
{"questionText":"Párosítsd: Változó, Rekurzió, Túlterhelés a definícióikkal."}  ← bal oldali fogalmak a szövegben TILOS!
options:["Változó","Rekurzió","..."]  ← bal oldali értékek az options-ban TILOS!

✓ JÓ ordering:
{"questionType":"ordering","questionText":"Rendezd időrendi sorrendbe a magyar történelmi eseményeket:","items":["1956-os forradalom","Honfoglalás","Trianoni békeszerződés","1848-49-es szabadságharc"],"correctAnswer":["Honfoglalás","1848-49-es szabadságharc","Trianoni békeszerződés","1956-os forradalom"],"explanation":""}
✗ ROSSZ ordering:
{"items":["Honfoglalás","1848-49","Trianon","1956"],"correctAnswer":["Honfoglalás","1848-49","Trianon","1956"]}  ← items már helyes sorrendben, kell KEVERNI!
{"questionText":"Rendezd időrendbe: Honfoglalás, 1848-49, Trianon, 1956."}  ← items felsorolása a szövegben TILOS!`
      }
    };
    return specs[groupName];
  }

  async _generateQuestionGroup(groupName, count, headerCtx, retry = false) {
    const spec = this._groupSpec(groupName);
    if (!spec || count <= 0) return [];

    const typeDistribution = spec.types
      .map((t, i) => `${spec.types[i]}: ${Math.ceil(count / spec.types.length) - (i === spec.types.length - 1 ? (spec.types.length * Math.ceil(count / spec.types.length) - count) : 0)} db`)
      .join(', ');

    const retryNote = retry ? '\n\n⚠ EZ EGY ÚJRAGENERÁLÁS – az előző válasz hibás volt. Olvasd újra a szabályokat és tartsd be SZIGORÚAN!' : '';

    const prompt = `Te egy precíz JSON-generáló pedagógus AI vagy. Generálj PONTOSAN ${count} kérdést.

${headerCtx}

${spec.instructions}

ELOSZTÁS: ${typeDistribution}${retryNote}

KIMENET – kizárólag érvényes JSON objektum (NEM tömb, NEM markdown), pontosan ebben a szerkezetben:
{"questions":[{"questionId":"q1","questionText":"...","questionType":"...","options":[],"pairs":[],"items":[],"correctAnswer":...,"explanation":"..."}]}

A pairs és items mező MINDEN kérdésnél szerepeljen (üres tömb, ha nem releváns).`;

    try {
      const raw = await this._callModelWithFallback(
        this.fastModel,
        this.fastFallback,
        [{ role: 'system', content: prompt }],
        { temperature: 0.7, max_tokens: 2500, jsonMode: true }
      );
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.questions)) {
        throw new Error('Nincs questions tömb a válaszban');
      }
      return parsed.questions;
    } catch (e) {
      console.warn(`[GroqService] ${groupName} csoport sikertelen:`, e.message);
      return [];
    }
  }

  async generatePracticeQuestionSet(subject, topic, difficulty = 3, count = 10, grade = 'általános iskola', weakQuestions = [], excludeQuestions = []) {
    const t0 = Date.now();
    const headerCtx = this._groupPromptHeader(subject, topic, difficulty, grade, weakQuestions, excludeQuestions);

    // 10 kérdés: 4 basic (mcq+true_false) + 3 text (short_answer+fill_blank) + 3 complex (matching+ordering)
    // Arányosan skálázzuk, ha count != 10.
    const basicCount   = Math.round(count * 0.4);
    const textCount    = Math.round(count * 0.3);
    const complexCount = count - basicCount - textCount;

    console.log(`[GroqService] Gyakorlás generálás indul: basic=${basicCount}, text=${textCount}, complex=${complexCount}`);

    const [basicQs, textQs, complexQs] = await Promise.all([
      this._generateQuestionGroup('basic', basicCount, headerCtx),
      this._generateQuestionGroup('text', textCount, headerCtx),
      this._generateQuestionGroup('complex', complexCount, headerCtx)
    ]);

    // Validáció + retry hibás csoportoknál
    const groups = [
      { name: 'basic',   target: basicCount,   raw: basicQs },
      { name: 'text',    target: textCount,    raw: textQs },
      { name: 'complex', target: complexCount, raw: complexQs }
    ];

    const validQuestions = [];
    const retryGroups = [];

    for (const g of groups) {
      const valid = [];
      const invalid = [];
      for (const q of g.raw) {
        const norm = {
          questionText: q.questionText || '',
          questionType: q.questionType,
          options: Array.isArray(q.options) ? q.options : [],
          pairs: Array.isArray(q.pairs) ? q.pairs : [],
          items: Array.isArray(q.items) ? q.items : [],
          correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
          explanation: q.explanation || ''
        };
        const v = this._validateQuestion(norm);
        if (v.valid) valid.push(norm);
        else {
          invalid.push({ q: norm, reasons: v.reasons });
          console.warn(`[GroqService] ${g.name} érvénytelen kérdés: ${v.reasons.join(', ')}`);
        }
      }
      validQuestions.push(...valid);
      const missing = g.target - valid.length;
      if (missing > 0) {
        retryGroups.push({ name: g.name, count: missing });
      }
    }

    // 1 retry kör csak a hiányzó csoportokra
    if (retryGroups.length > 0) {
      console.log(`[GroqService] Retry kör: ${retryGroups.map(r => `${r.name}(${r.count})`).join(', ')}`);
      const retryResults = await Promise.all(
        retryGroups.map(r => this._generateQuestionGroup(r.name, r.count, headerCtx, true))
      );
      retryResults.forEach((rawQs, idx) => {
        const groupName = retryGroups[idx].name;
        for (const q of rawQs) {
          const norm = {
            questionText: q.questionText || '',
            questionType: q.questionType,
            options: Array.isArray(q.options) ? q.options : [],
            pairs: Array.isArray(q.pairs) ? q.pairs : [],
            items: Array.isArray(q.items) ? q.items : [],
            correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
            explanation: q.explanation || ''
          };
          const v = this._validateQuestion(norm);
          if (v.valid) validQuestions.push(norm);
          else console.warn(`[GroqService] ${groupName} retry után is hibás: ${v.reasons.join(', ')}`);
        }
      });
    }

    // Ha még mindig hiányzik kérdés: sanitize fallback (utolsó esély a hibás darabokra)
    if (validQuestions.length < count) {
      console.warn(`[GroqService] ${count - validQuestions.length} kérdés hiányzik validáció után – sanitize fallback...`);
      const allRaw = [...basicQs, ...textQs, ...complexQs];
      const sanitized = this._sanitizeQuestions(allRaw.map(q => ({
        questionText: q.questionText || 'Hiányzó kérdés',
        questionType: q.questionType,
        options: Array.isArray(q.options) ? q.options : [],
        pairs: Array.isArray(q.pairs) ? q.pairs : [],
        items: Array.isArray(q.items) ? q.items : [],
        correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : '',
        explanation: q.explanation || ''
      })), difficulty);
      // Hozzáadjuk azokat a sanitált kérdéseket, amelyek még nincsenek a validQuestions-ben (questionText alapján)
      const existingTexts = new Set(validQuestions.map(q => q.questionText));
      for (const sq of sanitized) {
        if (validQuestions.length >= count) break;
        if (!existingTexts.has(sq.questionText)) {
          validQuestions.push(sq);
          existingTexts.add(sq.questionText);
        }
      }
    }

    // Végső állapot
    const final = validQuestions.slice(0, count).map((q, idx) => ({
      questionId:    `q${idx + 1}`,
      questionText:  q.questionText,
      questionType:  q.questionType,
      difficulty:    difficulty,
      options:       q.options || [],
      pairs:         q.pairs || [],
      items:         q.items || [],
      correctAnswer: q.correctAnswer,
      explanation:   q.explanation || ''
    }));

    // Ha még mindig kevés (extrém eset): statikus pótlás
    while (final.length < count) {
      const idx = final.length;
      final.push({
        questionId:    `q${idx + 1}`,
        questionText:  `Magyarázd el a saját szavaiddal: ${topic}`,
        questionType:  'short_answer',
        difficulty,
        options:       [],
        pairs:         [],
        items:         [],
        correctAnswer: 'Logikus, témába vágó válasz elfogadható.',
        explanation:   'Nyílt végű kérdés.'
      });
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[GroqService] ✓ Gyakorlás generálás kész: ${final.length} kérdés / ${elapsed}s`);
    return final;
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

  _validateQuestion(q) {
    const reasons = [];
    if (!q || typeof q !== 'object') return { valid: false, reasons: ['nem objektum'] };
    const { questionType, questionText, options, pairs, items, correctAnswer } = q;

    if (!questionText || typeof questionText !== 'string' || questionText.trim().length < 8) {
      reasons.push('üres vagy túl rövid kérdésszöveg');
    }

    if (!['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(questionType)) {
      reasons.push('ismeretlen kérdéstípus');
      return { valid: false, reasons };
    }

    if (questionType === 'mcq') {
      if (!Array.isArray(options) || options.length !== 4) reasons.push('mcq: nem 4 option');
      else if (options.some(o => typeof o !== 'string' || /^[A-D]$/i.test(String(o).trim()))) reasons.push('mcq: betűjelölő option');
      else if (!options.map(String).includes(String(correctAnswer))) reasons.push('mcq: correctAnswer nincs az options között');
    }

    if (questionType === 'true_false') {
      if (!Array.isArray(options) || options.length !== 2) reasons.push('true_false: options nem ["Igaz","Hamis"]');
      if (!['Igaz','Hamis'].includes(String(correctAnswer))) reasons.push('true_false: correctAnswer nem Igaz/Hamis');
      if (typeof questionText === 'string' && /^(melyik|hogyan|mi a különbség|mit|miért|hány)\b/i.test(questionText.trim())) {
        reasons.push('true_false: kérdő mondat (kell kijelentő)');
      }
    }

    if (questionType === 'fill_blank') {
      const blankCount = typeof questionText === 'string' ? (questionText.match(/___/g) || []).length : 0;
      if (blankCount !== 1) reasons.push('fill_blank: pontosan egy ___ jelölő kell');
      if (correctAnswer === undefined || correctAnswer === null || String(correctAnswer).trim() === '') reasons.push('fill_blank: üres correctAnswer');
      if (String(correctAnswer).includes('|')) reasons.push('fill_blank: több válasz | jellel elválasztva');
    }

    if (questionType === 'matching') {
      if (!Array.isArray(pairs) || pairs.length < 3) reasons.push('matching: kevés pairs (min 3)');
      else {
        const lefts = pairs.map(p => String(p?.left || ''));
        const rights = pairs.map(p => String(p?.right || ''));
        if (lefts.some(l => l.length === 0) || rights.some(r => r.length === 0)) reasons.push('matching: üres left/right');
        if (rights.some(r => r.split(/\s+/).length < 4)) reasons.push('matching: right túl rövid (min 4 szó)');
        const rightContainsLeft = pairs.some(p => {
          const leftWords = String(p.left || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
          const right = String(p.right || '').toLowerCase();
          return leftWords.some(word => right.includes(word));
        });
        if (rightContainsLeft) reasons.push('matching: a válasz tartalmazza a bal oldali fogalmat');
        if (!Array.isArray(options) || options.length !== pairs.length) reasons.push('matching: options hossza nem egyezik pairs-szel');
        else if (options.some(o => lefts.includes(String(o)))) reasons.push('matching: options bal oldali fogalmat tartalmaz');
        else if (!rights.every(r => options.map(String).includes(r))) reasons.push('matching: options nem a jobb oldali értékeket tartalmazza');
        // bal oldali fogalmak ne legyenek a kérdésszövegben
        if (typeof questionText === 'string') {
          const leftInText = lefts.filter(lv => lv.length > 2 && questionText.includes(lv));
          if (leftInText.length >= Math.ceil(lefts.length * 0.5)) reasons.push('matching: bal fogalmak a kérdésszövegben');
        }
        if (typeof correctAnswer !== 'object' || Array.isArray(correctAnswer) || correctAnswer === null) reasons.push('matching: correctAnswer nem objektum');
      }
    }

    if (questionType === 'ordering') {
      if (!Array.isArray(items) || items.length < 3) reasons.push('ordering: kevés items (min 3)');
      if (!Array.isArray(correctAnswer) || correctAnswer.length === 0) reasons.push('ordering: correctAnswer nem tömb vagy üres');
      else if (Array.isArray(items) && items.length === correctAnswer.length) {
        const itemSet = new Set(items.map(String));
        const answerSet = new Set(correctAnswer.map(String));
        if (itemSet.size !== answerSet.size || [...answerSet].some(v => !itemSet.has(v))) {
          reasons.push('ordering: items és correctAnswer nem ugyanazokat az elemeket tartalmazza');
        }
        const sameOrder = items.every((it, i) => String(it) === String(correctAnswer[i]));
        if (sameOrder) reasons.push('ordering: items helyes sorrendben (kellene keverni)');
        if (typeof questionText === 'string') {
          const itemsInText = items.filter(it => String(it).length > 2 && questionText.includes(String(it)));
          if (itemsInText.length >= Math.ceil(items.length * 0.5)) reasons.push('ordering: items a kérdésszövegben');
        }
      }
    }

    if (questionType === 'short_answer') {
      if (correctAnswer === undefined || correctAnswer === null || String(correctAnswer).trim() === '') reasons.push('short_answer: üres correctAnswer');
    }

    return { valid: reasons.length === 0, reasons };
  }

  _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  _normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  _uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(v => this._normalizeText(v))
      .filter(Boolean))];
  }

  _buildFallbackQuestion(type, topic, index = 0) {
    const suffix = index > 0 ? ` (${index + 1})` : '';
    const matchingPairs = [
      { left: 'Kulcsfogalom', right: `A(z) ${topic} témakör egyik központi, pontosan értendő eleme.` },
      { left: 'Példa', right: `Konkrét helyzet, amelyben a tanult szabály vagy ismeret felismerhető.` },
      { left: 'Következtetés', right: `Olyan megállapítás, amely a tanult összefüggésekből vezethető le.` }
    ];
    const orderingAnswer = [
      `${topic} alapjainak felismerése`,
      `${topic} szabályainak alkalmazása`,
      `${topic} eredményének ellenőrzése`
    ];
    const fallbackByType = {
      mcq: {
        questionText: `Melyik állítás kapcsolódik legpontosabban a(z) "${topic}" témához${suffix}?`,
        options: [
          `A(z) ${topic} témakör egyik lényeges állítása.`,
          'Egy másik tantárgyhoz tartozó, nem ide illő állítás.',
          'Csak részben kapcsolódó, pontatlan megfogalmazás.',
          'A témától független általános megjegyzés.'
        ],
        correctAnswer: `A(z) ${topic} témakör egyik lényeges állítása.`
      },
      true_false: {
        questionText: `A(z) "${topic}" témakörben a pontos fogalomhasználat segíti a helyes megoldást${suffix}.`,
        options: ['Igaz', 'Hamis'],
        correctAnswer: 'Igaz'
      },
      short_answer: {
        questionText: `Fogalmazd meg röviden a(z) "${topic}" témakör egyik lényeges tudnivalóját${suffix}!`,
        options: [],
        correctAnswer: `A válasz tartalmazzon egy pontos, a(z) ${topic} témához kapcsolódó állítást.`
      },
      fill_blank: {
        questionText: `A(z) "${topic}" témakörben a helyes megoldáshoz a ___ felismerése szükséges${suffix}.`,
        options: [],
        correctAnswer: 'kulcsfogalom'
      },
      matching: {
        questionText: `Párosítsd a(z) "${topic}" témához kapcsolódó fogalmakat a megfelelő leírásukkal${suffix}:`,
        options: this._shuffle(matchingPairs.map(p => p.right)),
        pairs: matchingPairs,
        correctAnswer: Object.fromEntries(matchingPairs.map(p => [p.left, p.right]))
      },
      ordering: {
        questionText: `Rendezd logikai sorrendbe a(z) "${topic}" témához kapcsolódó lépéseket${suffix}:`,
        options: [],
        items: [orderingAnswer[1], orderingAnswer[2], orderingAnswer[0]],
        correctAnswer: orderingAnswer
      }
    };

    const base = fallbackByType[type] || fallbackByType.short_answer;
    return {
      questionText: base.questionText,
      questionType: type,
      options: base.options || [],
      pairs: base.pairs || [],
      items: base.items || [],
      correctAnswer: base.correctAnswer,
      explanation: 'Automatikusan ellenőrzött tartalék kérdés.'
    };
  }

  _finalizeQuestionSet(questions, typeSpecs, topic) {
    const requested = new Map(typeSpecs.map(s => [s.type, Number(s.count) || 0]));
    const selected = [];
    const seenTexts = new Set();
    const sanitized = this._sanitizeQuestions(Array.isArray(questions) ? questions : [], 3);

    for (const [type, target] of requested.entries()) {
      let accepted = 0;
      for (const q of sanitized) {
        if (accepted >= target) break;
        if (q.questionType !== type) continue;

        const textKey = this._normalizeText(q.questionText).toLowerCase();
        if (!textKey || seenTexts.has(textKey)) continue;

        const validation = this._validateQuestion(q);
        if (!validation.valid) {
          console.warn(`[GroqService] Kidobott hibás ${type} kérdés: ${validation.reasons.join(', ')}`);
          continue;
        }

        selected.push(q);
        seenTexts.add(textKey);
        accepted++;
      }

      while (accepted < target) {
        const fallback = this._sanitizeQuestions([this._buildFallbackQuestion(type, topic, accepted)], 3)[0];
        selected.push(fallback);
        seenTexts.add(this._normalizeText(fallback.questionText).toLowerCase());
        accepted++;
      }
    }

    return selected.map((q, idx) => ({
      questionId: q.questionId || `q${idx + 1}`,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options || [],
      pairs: q.pairs || [],
      items: q.items || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || ''
    }));
  }

  _sanitizeQuestions(questions, fallbackDifficulty) {
    return questions.map((q, idx) => {
      let { questionType, questionText, options, pairs, items, correctAnswer } = q;
      questionText = this._normalizeText(questionText || 'Hiányzó kérdés');
      options = this._uniqueStrings(options);
      pairs = Array.isArray(pairs)
        ? pairs.map(p => ({
            left: this._normalizeText(p?.left),
            right: this._normalizeText(p?.right)
          })).filter(p => p.left && p.right)
        : [];
      items = this._uniqueStrings(items);

      if (!['mcq','true_false','short_answer','fill_blank','matching','ordering'].includes(questionType)) {
        questionType = 'short_answer';
      }

      if (questionType === 'mcq') {
        if (options.length > 4) options = options.slice(0, 4);
        if (options.length === 4 && !options.map(String).includes(String(correctAnswer))) {
          correctAnswer = options[0];
        }
      }

      if (questionType === 'true_false') {
        options = ['Igaz', 'Hamis'];
        correctAnswer = String(correctAnswer).toLowerCase() === 'hamis' ? 'Hamis' : 'Igaz';
      }

      // fill_blank: a diákoldali mező egy választ kezel, ezért pontosan egy üres helyet tartunk meg.
      if (questionType === 'fill_blank') {
        const answerParts = String(correctAnswer ?? '')
          .split('|')
          .map(part => this._normalizeText(part))
          .filter(Boolean);
        if (answerParts.length > 0) correctAnswer = answerParts[0];

        const parts = questionText.split('___');
        if (parts.length === 1) {
          questionText = `${questionText.replace(/[?.!]*$/, '')}: ___.`;
        } else if (parts.length > 2) {
          let rebuilt = `${parts[0]}___`;
          for (let i = 1; i < parts.length; i++) {
            const replacement = answerParts[i] || '';
            rebuilt += `${replacement}${parts[i]}`;
          }
          questionText = rebuilt.replace(/\s+/g, ' ').trim();
        }
      }

      // matching: az options MINDIG a jobb oldali értékek (pairs[].right) legyenek, keverve
      if (questionType === 'matching' && Array.isArray(pairs) && pairs.length > 0) {
        const leftValues = pairs.map(p => String(p.left));
        const rightValues = pairs.map(p => String(p.right));
        // Ha az options tartalmaz bal oldali értéket, VAGY üres, akkor javítjuk
        const hasLeftInOptions = !Array.isArray(options) || options.length !== rightValues.length ||
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
        const needsAnswerRepair = typeof correctAnswer !== 'object' || Array.isArray(correctAnswer) || correctAnswer === null ||
          pairs.some(p => String(correctAnswer[p.left] || '') !== String(p.right));
        if (needsAnswerRepair) {
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
        if ((!Array.isArray(items) || items.length === 0) && Array.isArray(correctAnswer) && correctAnswer.length > 0) {
          items = this._shuffle(correctAnswer);
        }
        if (Array.isArray(items) && Array.isArray(correctAnswer) && correctAnswer.length > 0) {
          const sameOrder = items.length === correctAnswer.length &&
            items.every((it, i) => String(it) === String(correctAnswer[i]));
          if (sameOrder) {
            items = this._shuffle(items);
            if (items.every((it, i) => String(it) === String(correctAnswer[i])) && items.length > 1) {
              items = [items[1], ...items.slice(2), items[0]];
            }
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