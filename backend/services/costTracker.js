/**
 * Valós cost tracker – az AI API hívások visszaadják a token-használatot
 * (response.data.usage), amit _callModelWithFallback kinyeri és ide átad.
 *
 * Ha valós token adat érkezett (realTokens), azt használja.
 * Ha nem (pl. streaming, ai.js fallback), karakter/4 becsléssel dolgozik.
 *
 * Modellek és árképzés ($ / 1M token) – 2026-05, forrás: DeepSeek + DashScope docs:
 *   deepseek-chat     (DeepSeek V3-0324, fast chain fallback)   input: $0.14  output: $0.28  cacheHit: $0.0028
 *   deepseek-reasoner (DeepSeek R1, reasoning chain fallback)   input: $0.55  output: $2.19  cacheHit: $0.0028
 *   qwen-plus         (Qwen3.5-Plus, reasoning chain primary)   input: $0.40  output: $1.20
 *   qwen-turbo        (Qwen3.5-Turbo, fast chain primary)       input: $0.05  output: $0.20
 *
 * Fast chain:      qwen-turbo → deepseek-chat
 * Reasoning chain: qwen-plus  → deepseek-reasoner
 */

const fs   = require('fs');
const path = require('path');

const PRICES = {
  'deepseek-chat':     { input: 0.14  / 1_000_000, output: 0.28  / 1_000_000, cacheHit: 0.0028 / 1_000_000 },
  'deepseek-reasoner': { input: 0.55  / 1_000_000, output: 2.19  / 1_000_000, cacheHit: 0.0028 / 1_000_000 },
  'qwen-plus':         { input: 0.40  / 1_000_000, output: 1.20  / 1_000_000, cacheHit: 0 },
  'qwen-turbo':        { input: 0.05  / 1_000_000, output: 0.20  / 1_000_000, cacheHit: 0 },
};


function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function estimateInputTokens(messages) {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
}

// ─── Havi számláló (JSON fájl alapú) ─────────────────────────────────────────

const COUNTER_FILE = path.join(__dirname, '../data/monthlyCost.json');

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function emptyModelEntry() {
  return { calls: 0, costUSD: 0, inputTokens: 0, outputTokens: 0, cacheHitTokens: 0 };
}

function emptyCounter() {
  return {
    month: currentMonth(),
    callCount: 0,
    totalCostUSD: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheHitTokens: 0,
    byModel: {
      'deepseek-chat':     emptyModelEntry(),
      'deepseek-reasoner': emptyModelEntry(),
      'qwen-plus':         emptyModelEntry(),
      'qwen-turbo':        emptyModelEntry(),
    },
    byChain: {
      reasoning: emptyModelEntry(),
      fast:      emptyModelEntry(),
    },
    byCaller: {},
    byUser: {},
  };
}

function migrateEntry(saved, empty) {
  return {
    calls:         saved.calls         ?? empty.calls,
    costUSD:       saved.costUSD       ?? empty.costUSD,
    inputTokens:   saved.inputTokens   ?? 0,
    outputTokens:  saved.outputTokens  ?? 0,
    cacheHitTokens: saved.cacheHitTokens ?? 0,
  };
}

function loadCounter() {
  try {
    if (fs.existsSync(COUNTER_FILE)) {
      const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
      if (data.month === currentMonth()) {
        const empty = emptyCounter();
        return {
          ...empty,
          ...data,
          totalInputTokens:    data.totalInputTokens    ?? 0,
          totalOutputTokens:   data.totalOutputTokens   ?? 0,
          totalCacheHitTokens: data.totalCacheHitTokens ?? 0,
          byCaller: data.byCaller ?? {},
          byUser:   data.byUser   ?? {},
          byModel: Object.fromEntries(
            Object.keys(empty.byModel).map(k => [
              k,
              migrateEntry(data.byModel?.[k] ?? {}, empty.byModel[k]),
            ])
          ),
          byChain: Object.fromEntries(
            Object.keys(empty.byChain).map(k => [
              k,
              migrateEntry(data.byChain?.[k] ?? {}, empty.byChain[k]),
            ])
          ),
        };
      }
    }
  } catch {}
  return emptyCounter();
}

function saveCounter(counter) {
  try {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(counter, null, 2));
  } catch (err) {
    console.error('[CostTracker] Hiba a számláló mentésekor:', err.message);
  }
}

let monthly = loadCounter();

// ─── Fő trackCall függvény ────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string}              params.caller        – hívó függvény neve
 * @param {'reasoning'|'fast'}  params.chainType     – melyik lánc futott
 * @param {string}              params.modelName     – konkrét API model név (pl. 'qwen-turbo', 'deepseek-chat')
 * @param {Array}               [params.messages]    – input token becsléhez (ha nincs realTokens)
 * @param {string}              [params.output]      – output token becsléshez (ha nincs realTokens)
 * @param {object}              [params.realTokens]  – valós token adat az API response-ból
 * @param {number}              params.realTokens.input
 * @param {number}              params.realTokens.output
 * @param {number}              [params.realTokens.cacheHit]
 * @param {string}              [params.userId]      – felhasználó azonosítója
 */
function trackCall({ caller, chainType, modelName, messages, output, realTokens, userId }) {
  if (monthly.month !== currentMonth()) {
    monthly = emptyCounter();
  }

  // Token számok: valós API adat, vagy karakterarányos becslés
  const inTok      = realTokens ? realTokens.input    : estimateInputTokens(messages || []);
  const outTok     = realTokens ? realTokens.output   : estimateTokens(output);
  const cacheHit   = realTokens ? (realTokens.cacheHit ?? 0) : 0;
  const cacheMiss  = inTok - cacheHit;

  const model   = modelName || 'deepseek-chat';
  const pricing = PRICES[model] || PRICES['deepseek-chat'];

  // Cache hit tokenek olcsóbbak
  const callCost = cacheMiss * pricing.input
                 + cacheHit  * pricing.cacheHit
                 + outTok    * pricing.output;

  // ── Összesítő ──
  monthly.callCount             += 1;
  monthly.totalCostUSD          += callCost;
  monthly.totalInputTokens      += inTok;
  monthly.totalOutputTokens     += outTok;
  monthly.totalCacheHitTokens   += cacheHit;

  // ── Modell ──
  if (!monthly.byModel[model]) monthly.byModel[model] = emptyModelEntry();
  monthly.byModel[model].calls          += 1;
  monthly.byModel[model].costUSD        += callCost;
  monthly.byModel[model].inputTokens    += inTok;
  monthly.byModel[model].outputTokens   += outTok;
  monthly.byModel[model].cacheHitTokens += cacheHit;

  // ── Chain ──
  const ct = chainType in monthly.byChain ? chainType : 'fast';
  monthly.byChain[ct].calls          += 1;
  monthly.byChain[ct].costUSD        += callCost;
  monthly.byChain[ct].inputTokens    += inTok;
  monthly.byChain[ct].outputTokens   += outTok;
  monthly.byChain[ct].cacheHitTokens += cacheHit;

  // ── Caller ──
  const callerKey = caller || 'unknown';
  if (!monthly.byCaller[callerKey]) monthly.byCaller[callerKey] = emptyModelEntry();
  monthly.byCaller[callerKey].calls          += 1;
  monthly.byCaller[callerKey].costUSD        += callCost;
  monthly.byCaller[callerKey].inputTokens    += inTok;
  monthly.byCaller[callerKey].outputTokens   += outTok;
  monthly.byCaller[callerKey].cacheHitTokens += cacheHit;

  // ── User ──
  if (userId) {
    const uid = String(userId);
    if (!monthly.byUser[uid]) monthly.byUser[uid] = emptyModelEntry();
    monthly.byUser[uid].calls          += 1;
    monthly.byUser[uid].costUSD        += callCost;
    monthly.byUser[uid].inputTokens    += inTok;
    monthly.byUser[uid].outputTokens   += outTok;
    monthly.byUser[uid].cacheHitTokens += cacheHit;
  }

  saveCounter(monthly);
}

module.exports = { trackCall };
