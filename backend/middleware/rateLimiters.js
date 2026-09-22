const rateLimit = require('express-rate-limit');

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
// költség- és erőforrás-kimerítéses visszaélés korlátozására.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Túl sok AI kérés rövid idő alatt. Kérjük, várjon egy percet.' },
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
