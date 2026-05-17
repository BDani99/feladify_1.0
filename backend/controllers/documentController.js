const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');
const { Readable } = require('stream');
const Folder = require('../models/Folder');
const File = require('../models/File');

let bucket;
const getBucket = () => {
  if (!bucket) {
    if (!mongoose.connection.db) {
      throw new Error('Adatbázis kapcsolat nem aktív.');
    }
    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'documents'
    });
  }
  return bucket;
};

// Segédfunkció a morzsák lekérdezéséhez
const getBreadcrumbs = async (folderId, userId) => {
  const crumbs = [];
  let currentId = folderId;
  while (currentId) {
    const folder = await Folder.findOne({ _id: currentId, user: userId });
    if (!folder) break;
    crumbs.unshift({ id: folder._id, name: folder.name });
    currentId = folder.parent;
  }
  return crumbs;
};

// Rekurzív törlés segédfunkció
const deleteFolderRecursive = async (folderId, userId) => {
  const subfolders = await Folder.find({ parent: folderId, user: userId });
  for (const sub of subfolders) {
    await deleteFolderRecursive(sub._id, userId);
  }

  const files = await File.find({ folder: folderId, user: userId });
  const gridFSBucket = getBucket();
  for (const file of files) {
    try {
      await gridFSBucket.delete(new mongoose.Types.ObjectId(file.gridFSId));
    } catch (err) {
      console.error(`Nem sikerült törölni a GridFS fájlt (${file.gridFSId}):`, err);
    }
    await File.deleteOne({ _id: file._id });
  }

  await Folder.deleteOne({ _id: folderId, user: userId });
};

// 1. Dokumentumok lekérdezése az aktuális mappában + morzsák
exports.getDocuments = async (req, res) => {
  try {
    const userId = req.userId;
    const folderId = req.query.folderId && req.query.folderId !== 'null' ? req.query.folderId : null;

    const folders = await Folder.find({ parent: folderId, user: userId }).sort({ name: 1 });
    const files = await File.find({ folder: folderId, user: userId }).sort({ name: 1 });
    const breadcrumbs = await getBreadcrumbs(folderId, userId);

    const decodeUTF8String = (str) => {
      try {
        return decodeURIComponent(escape(str));
      } catch (e) {
        return str;
      }
    };

    // Safely decode any double-encoded names in Mongoose documents for the response
    const foldersDecoded = folders.map(f => {
      const doc = f.toObject();
      doc.name = decodeUTF8String(doc.name);
      return doc;
    });

    const filesDecoded = files.map(f => {
      const doc = f.toObject();
      doc.name = decodeUTF8String(doc.name);
      return doc;
    });

    const breadcrumbsDecoded = breadcrumbs.map(b => {
      return {
        ...b,
        name: decodeUTF8String(b.name)
      };
    });

    res.json({
      folders: foldersDecoded,
      files: filesDecoded,
      breadcrumbs: breadcrumbsDecoded
    });
  } catch (error) {
    console.error('[getDocuments Error]', error);
    res.status(500).json({ message: 'Hiba a dokumentumok lekérésekor.' });
  }
};

// 2. Új mappa létrehozása
exports.createFolder = async (req, res) => {
  try {
    const userId = req.userId;
    const { name, parentId } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'A mappa neve kötelező.' });
    }

    const folder = new Folder({
      name: name.trim(),
      parent: parentId || null,
      user: userId
    });

    await folder.save();
    res.status(201).json(folder);
  } catch (error) {
    console.error('[createFolder Error]', error);
    res.status(500).json({ message: 'Hiba a mappa létrehozásakor.' });
  }
};

// 3. Fájl feltöltése
exports.uploadFile = async (req, res) => {
  try {
    const userId = req.userId;
    const folderId = req.body.folderId && req.body.folderId !== 'null' ? req.body.folderId : null;

    if (!req.file) {
      return res.status(400).json({ message: 'Nem érkezett fájl a feltöltéshez.' });
    }

    const decodedName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const gridFSBucket = getBucket();
    const uploadStream = gridFSBucket.openUploadStream(decodedName, {
      contentType: req.file.mimetype
    });

    const bufferStream = Readable.from(req.file.buffer);
    bufferStream.pipe(uploadStream)
      .on('error', (err) => {
        console.error('[GridFS Upload Stream Error]', err);
        return res.status(500).json({ message: 'Hiba történt a fájl írása közben.' });
      })
      .on('finish', async () => {
        try {
          const fileDoc = new File({
            name: decodedName,
            folder: folderId,
            user: userId,
            gridFSId: uploadStream.id,
            size: req.file.size,
            mimeType: req.file.mimetype
          });

          await fileDoc.save();
          res.status(201).json(fileDoc);
        } catch (saveError) {
          console.error('[File Save Error]', saveError);
          res.status(500).json({ message: 'Hiba a fájl metaadatainak mentésekor.' });
        }
      });
  } catch (error) {
    console.error('[uploadFile Error]', error);
    res.status(500).json({ message: 'Hiba a fájl feltöltésekor.' });
  }
};

// 4. Fájl letöltése / előnézete
exports.streamFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileId = req.params.id;

    const file = await File.findOne({ _id: fileId, user: userId });
    if (!file) {
      return res.status(404).json({ message: 'A kért fájl nem található vagy nincs hozzá jogosultsága.' });
    }

    const gridFSBucket = getBucket();
    
    // Fejlécek beállítása
    res.set('Content-Type', file.mimeType);
    
    const download = req.query.download === 'true';
    if (download) {
      res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    } else {
      res.set('Content-Disposition', `inline; filename="${encodeURIComponent(file.name)}"`);
    }

    const downloadStream = gridFSBucket.openDownloadStream(file.gridFSId);
    downloadStream.on('error', (err) => {
      console.error('[GridFS Download Stream Error]', err);
      if (!res.headersSent) {
        res.status(404).json({ message: 'A fájl nem található a fizikai tárolóban.' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('[streamFile Error]', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Hiba a fájl lekérésekor.' });
    }
  }
};

// 5. Fájl törlése
exports.deleteFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileId = req.params.id;

    const file = await File.findOne({ _id: fileId, user: userId });
    if (!file) {
      return res.status(404).json({ message: 'A fájl nem található vagy nincs hozzá jogosultsága.' });
    }

    const gridFSBucket = getBucket();
    try {
      await gridFSBucket.delete(new mongoose.Types.ObjectId(file.gridFSId));
    } catch (err) {
      console.error(`Nem sikerült a GridFS fájl törlése (${file.gridFSId}):`, err);
    }

    await File.deleteOne({ _id: file._id });
    res.json({ success: true, message: 'A fájl sikeresen törölve.' });
  } catch (error) {
    console.error('[deleteFile Error]', error);
    res.status(500).json({ message: 'Hiba a fájl törlésekor.' });
  }
};

// 6. Mappa törlése rekurzívan
exports.deleteFolder = async (req, res) => {
  try {
    const userId = req.userId;
    const folderId = req.params.id;

    const folder = await Folder.findOne({ _id: folderId, user: userId });
    if (!folder) {
      return res.status(404).json({ message: 'A mappa nem található vagy nincs hozzá jogosultsága.' });
    }

    await deleteFolderRecursive(folderId, userId);
    res.json({ success: true, message: 'A mappa és minden tartalma sikeresen törölve.' });
  } catch (error) {
    console.error('[deleteFolder Error]', error);
    res.status(500).json({ message: 'Hiba a mappa törlésekor.' });
  }
};

// 7. Mappa frissítése (átnevezés, szín és mozgatás)
exports.updateFolder = async (req, res) => {
  try {
    const userId = req.userId;
    const folderId = req.params.id;
    const { name, color, parentId } = req.body;

    const folder = await Folder.findOne({ _id: folderId, user: userId });
    if (!folder) {
      return res.status(404).json({ message: 'A mappa nem található vagy nincs hozzá jogosultsága.' });
    }

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        return res.status(400).json({ message: 'A mappa neve nem lehet üres.' });
      }
      folder.name = name.trim();
    }

    if (color !== undefined) {
      folder.color = color;
    }

    if (parentId !== undefined) {
      if (parentId === folderId) {
        return res.status(400).json({ message: 'Egy mappa nem helyezhető el saját magában.' });
      }

      // Check if target is a subfolder of folderId
      if (parentId !== null) {
        let currentParentId = parentId;
        while (currentParentId) {
          if (currentParentId.toString() === folderId) {
            return res.status(400).json({ message: 'Egy mappa nem helyezhető el a saját almappájában.' });
          }
          const pFolder = await Folder.findOne({ _id: currentParentId, user: userId });
          if (!pFolder) break;
          currentParentId = pFolder.parent;
        }
      }

      folder.parent = parentId;
    }

    await folder.save();
    res.json(folder);
  } catch (error) {
    console.error('[updateFolder Error]', error);
    res.status(500).json({ message: 'Hiba a mappa frissítésekor.' });
  }
};

// 8. Fájl frissítése (átnevezés)
exports.updateFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileId = req.params.id;
    const { name } = req.body;

    const file = await File.findOne({ _id: fileId, user: userId });
    if (!file) {
      return res.status(404).json({ message: 'A fájl nem található vagy nincs hozzá jogosultsága.' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'A fájl neve nem lehet üres.' });
    }

    file.name = name.trim();
    await file.save();
    res.json(file);
  } catch (error) {
    console.error('[updateFile Error]', error);
    res.status(500).json({ message: 'Hiba a fájl frissítésekor.' });
  }
};

// 9. Fájl mozgatása (drag and drop)
exports.moveFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileId = req.params.id;
    const { folderId } = req.body;

    const file = await File.findOne({ _id: fileId, user: userId });
    if (!file) {
      return res.status(404).json({ message: 'A fájl nem található vagy nincs hozzá jogosultsága.' });
    }

    if (folderId) {
      const folder = await Folder.findOne({ _id: folderId, user: userId });
      if (!folder) {
        return res.status(404).json({ message: 'A cél mappa nem található.' });
      }
    }

    file.folder = folderId || null;
    await file.save();
    res.json(file);
  } catch (error) {
    console.error('[moveFile Error]', error);
    res.status(500).json({ message: 'Hiba a fájl mozgatásakor.' });
  }
};

// 10. Elemek csoportos másolása (Copy & Paste)
exports.copyItems = async (req, res) => {
  try {
    const userId = req.userId;
    const { items, targetFolderId } = req.body;
    const destFolderId = targetFolderId && targetFolderId !== 'null' ? targetFolderId : null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Nincsenek másolandó elemek kijelölve.' });
    }

    const gridFSBucket = getBucket();

    // Rekurzív mappa másolás
    const copyFolderRecursive = async (srcFolderId, parentDestId) => {
      const srcFolder = await Folder.findOne({ _id: srcFolderId, user: userId });
      if (!srcFolder) return null;

      const destFolder = new Folder({
        name: srcFolder.name,
        color: srcFolder.color,
        parent: parentDestId,
        user: userId
      });
      await destFolder.save();

      const files = await File.find({ folder: srcFolderId, user: userId });
      for (const file of files) {
        await copyFileInstance(file, destFolder._id);
      }

      const subfolders = await Folder.find({ parent: srcFolderId, user: userId });
      for (const sub of subfolders) {
        await copyFolderRecursive(sub._id, destFolder._id);
      }

      return destFolder;
    };

    // Egyedi fájl másolás
    const copyFileInstance = (srcFile, destFolderId) => {
      return new Promise((resolve, reject) => {
        const downloadStream = gridFSBucket.openDownloadStream(srcFile.gridFSId);
        const uploadStream = gridFSBucket.openUploadStream(srcFile.name, {
          contentType: srcFile.mimeType
        });

        downloadStream.pipe(uploadStream)
          .on('error', (err) => {
            console.error('[Copy GridFS File Error]', err);
            reject(err);
          })
          .on('finish', async () => {
            try {
              const newFileDoc = new File({
                name: srcFile.name,
                folder: destFolderId,
                user: userId,
                gridFSId: uploadStream.id,
                size: srcFile.size,
                mimeType: srcFile.mimeType
              });
              await newFileDoc.save();
              resolve(newFileDoc);
            } catch (err) {
              reject(err);
            }
          });
      });
    };

    for (const item of items) {
      if (item.type === 'folder') {
        await copyFolderRecursive(item._id, destFolderId);
      } else {
        const srcFile = await File.findOne({ _id: item._id, user: userId });
        if (srcFile) {
          await copyFileInstance(srcFile, destFolderId);
        }
      }
    }

    res.json({ success: true, message: 'Az elemek sikeresen átmásolva.' });
  } catch (error) {
    console.error('[copyItems Error]', error);
    res.status(500).json({ message: 'Hiba a másolás során.' });
  }
};

// 12. Fájl megosztása (Token generálás)
exports.shareFile = async (req, res) => {
  try {
    const crypto = require('crypto');
    const userId = req.userId;
    const fileId = req.params.id;

    const file = await File.findOne({ _id: fileId, user: userId });
    if (!file) {
      return res.status(404).json({ message: 'A fájl nem található vagy nincs hozzá jogosultsága.' });
    }

    if (!file.shareToken) {
      file.shareToken = crypto.randomBytes(16).toString('hex');
      await file.save();
    }

    res.json({
      success: true,
      shareToken: file.shareToken,
      message: 'Megosztási link sikeresen létrehozva.'
    });
  } catch (error) {
    console.error('[shareFile Error]', error);
    res.status(500).json({ message: 'Hiba a megosztás létrehozásakor.' });
  }
};

// 13. Fájl megosztás visszavonása
exports.unshareFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileId = req.params.id;

    const file = await File.findOne({ _id: fileId, user: userId });
    if (!file) {
      return res.status(404).json({ message: 'A fájl nem található vagy nincs hozzá jogosultsága.' });
    }

    file.shareToken = null;
    await file.save();

    res.json({
      success: true,
      message: 'Megosztás sikeresen visszavonva.'
    });
  } catch (error) {
    console.error('[unshareFile Error]', error);
    res.status(500).json({ message: 'Hiba a megosztás visszavonásakor.' });
  }
};

// 14. Publikus fájl letöltés token alapján
exports.streamSharedFile = async (req, res) => {
  try {
    const { shareToken } = req.params;

    const file = await File.findOne({ shareToken });
    if (!file) {
      return res.status(404).json({ message: 'A kért fájl nem található vagy a megosztás érvénytelen.' });
    }

    const gridFSBucket = getBucket();
    
    res.set('Content-Type', file.mimeType);
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);

    const downloadStream = gridFSBucket.openDownloadStream(file.gridFSId);
    downloadStream.on('error', (err) => {
      console.error('[GridFS Public Download Stream Error]', err);
      if (!res.headersSent) {
        res.status(404).json({ message: 'A fájl nem található a fizikai tárolóban.' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('[streamSharedFile Error]', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Hiba a fájl letöltésekor.' });
    }
  }
};
