const express = require('express');
const router = express.Router();
const multer = require('multer');
const authenticateUser = require('../middleware/authenticateUser');
const documentController = require('../controllers/documentController');

// Multer konfigurálása memóriatárhellyel és 50 MB-os fájlméret limittel
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  }
});

// Publikus (hitelesítés nélküli) fájlletöltés token alapján
router.get('/shared/:shareToken', documentController.streamSharedFile);

// Minden kérést hitelesítünk az authenticateUser middleware-rel
router.use(authenticateUser);

// Megosztási link létrehozása és törlése
router.post('/files/:id/share', documentController.shareFile);
router.delete('/files/:id/share', documentController.unshareFile);

// Mappa és fájl lekérdezések
router.get('/', documentController.getDocuments);

// Mappa műveletek
router.post('/folders', documentController.createFolder);
router.put('/folders/:id', documentController.updateFolder);
router.delete('/folders/:id', documentController.deleteFolder);

// Fájl műveletek
router.post('/files', upload.single('file'), documentController.uploadFile);
router.get('/files/:id', documentController.streamFile);
router.put('/files/:id', documentController.updateFile);
router.put('/files/:id/move', documentController.moveFile);
router.delete('/files/:id', documentController.deleteFile);

// Csoportos másolás (Copy & Paste)
router.post('/copy', documentController.copyItems);

module.exports = router;
