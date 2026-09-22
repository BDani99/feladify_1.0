const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Bejelentkezett felhasználóknál a JWT-ből kinyert userId szerint korlátozunk
// (nem csak IP szerint) — sok diák osztozhat egy iskolai hálózat mögött egy
// publikus IP-n, egy tisztán IP-alapú limit ott jogos használatot is
// blokkolna, egy célzott visszaélőt viszont fiókváltás nélkül nem fogna meg
// jobban, mint a userId-alapú kulcs. Token nélkül (pl. login előtt) IP szerint.
function userOrIpKey(req) {
  const authHeader = req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.userId) return `user:${decoded.userId}`;
    } catch {
      // Érvénytelen token — az authenticate middleware úgyis elutasítja,
      // itt csak visszaesünk IP-alapú kulcsra.
    }
  }
  return `ip:${ipKeyGenerator(req)}`;
}

// Általános védelem minden végponton a nyers erőforrás-kimerítés (DoS) ellen.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// Szigorúbb limit a bejelentkezési/regisztrációs végpontokon a brute-force ellen.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Túl sok próbálkozás. Kérjük, próbálja újra később.' },
});

// AI-hívást indító, drága végpontokra (kérdésgenerálás, chat, javítás) a
// költség- és erőforrás-kimerítéses visszaélés korlátozására — percenkénti
// burst-védelem felhasználónként (vagy IP-nként, ha nincs bejelentkezve).
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { message: 'Túl sok AI kérés rövid idő alatt. Kérjük, várjon egy percet.' },
});

// Napi felső korlát felhasználónként az AI-végpontokon — a percenkénti limit
// alatt maradva is korlátozza egy fiók által egy nap alatt generálható
// összköltséget, ha valaki tartósan, de a burst-limitet kikerülve küldene
// kéréseket.
const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: { message: 'Elérted a napi AI kérés limitet. Kérjük, próbáld újra holnap.' },
});

module.exports = { generalLimiter, authLimiter, aiLimiter, aiDailyLimiter };
