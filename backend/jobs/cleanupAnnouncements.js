const Announcement = require('../models/Announcement');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function cleanupAnnouncements() {
  try {
    const now = new Date();

    // Ha van határidő: 3 nappal a határidő után törlés
    const deadlineThreshold = new Date(now - 3 * MS_PER_DAY);
    // Ha nincs határidő: 5 nappal a közzététel után törlés
    const noDeadlineThreshold = new Date(now - 5 * MS_PER_DAY);

    const result = await Announcement.deleteMany({
      $or: [
        { deadline: { $ne: null, $lt: deadlineThreshold } },
        { deadline: null, createdAt: { $lt: noDeadlineThreshold } }
      ]
    });

    if (result.deletedCount > 0) {
      console.log(`[Cleanup] ${result.deletedCount} lejárt bejegyzés törölve.`);
    }
  } catch (err) {
    console.error('[Cleanup] Hiba a bejegyzések törlése közben:', err.message);
  }
}

function startCleanupJob() {
  // Azonnal fut egyszer, majd naponta
  cleanupAnnouncements();
  setInterval(cleanupAnnouncements, 24 * 60 * 60 * 1000);
}

module.exports = { startCleanupJob };
