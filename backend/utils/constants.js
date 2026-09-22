// Központi, megosztott allowlist-ek — bármely végpont, ami tantárgyat vagy
// nehézségi szintet fogad el a klienstől, ezeket használja validációra
// ahelyett, hogy szabad szöveget engedne át (adatintegritás + AI prompt-injekció
// elleni védelem, mivel ezek az értékek gyakran AI promptokba kerülnek).
const ALLOWED_SUBJECTS = ['Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Matematika', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz'];

const ALLOWED_DIFFICULTIES = ['Könnyű', 'Közepes', 'Nehéz', 'Könnyített', 'Normál', 'Kihívás'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = { ALLOWED_SUBJECTS, ALLOWED_DIFFICULTIES, EMAIL_REGEX };
