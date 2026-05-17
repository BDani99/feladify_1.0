import React, { useState, useEffect, useRef } from 'react';
import { 
  FaFolder, 
  FaFolderOpen, 
  FaUpload, 
  FaTrashAlt, 
  FaDownload, 
  FaEye, 
  FaTimes, 
  FaFile, 
  FaFileImage, 
  FaFilePdf, 
  FaFileWord, 
  FaFileExcel, 
  FaArrowLeft, 
  FaInfoCircle, 
  FaFolderPlus, 
  FaSpinner,
  FaEdit,
  FaPalette,
  FaLink,
  FaUnlink
} from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../api/config';
import '../styles/Documents.css';
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal';
import LoadingSpinner from '../components/LoadingSpinner';

const Documents = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentFolderId = searchParams.get('folderId') || null;

  const setCurrentFolderId = (folderId) => {
    if (folderId) {
      setSearchParams({ folderId });
    } else {
      setSearchParams({});
    }
  };

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & Popups
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Selection & Preview
  const [selectedItems, setSelectedItems] = useState([]);
  const selectedItem = selectedItems[selectedItems.length - 1] || null;

  const setSelectedItem = (val) => {
    if (val === null) {
      setSelectedItems([]);
    } else {
      setSelectedItems([val]);
    }
  };

  // Drag selection (rubber-band) coordinates
  const [dragSelection, setDragSelection] = useState(null); // { startX, startY, currentX, currentY }
  const [isDragSelecting, setIsDragSelecting] = useState(false);

  const [previewFile, setPreviewFile] = useState(null);
  const [textPreviewContent, setTextPreviewContent] = useState('');
  const [loadingTextPreview, setLoadingTextPreview] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);
  
  // Uploads
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const explorerRef = useRef(null);

  // Drag and drop helper states
  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [isDraggingOverContainer, setIsDraggingOverContainer] = useState(false);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState(null); // { x, y, item, type }
  
  // Rename Modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameItem, setRenameItem] = useState(null); // { _id, name, type }
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  const [clipboard, setClipboard] = useState(null); // { action: 'cut' | 'copy', items: [...] }
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({ isOpen: false, items: [], message: '' });

  // Fájlok és mappák lekérése
  const fetchDocuments = async (folderId) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const url = `${API_BASE_URL}/documents?folderId=${folderId || ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Sikertelen betöltés');
      }
      
      const data = await response.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);
      setBreadcrumbs(data.breadcrumbs || []);
    } catch (err) {
      console.error(err);
      toast.error('Hiba történt a dokumentumok betöltésekor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(currentFolderId);
  }, [currentFolderId]);

  // Csoportos beillesztés (Paste) kezelése
  const handlePaste = async () => {
    if (!clipboard || clipboard.items.length === 0) return;

    setLoading(true);
    const token = localStorage.getItem('AccessToken');
    const { action, items } = clipboard;

    try {
      if (action === 'cut') {
        const promises = items.map(async (item) => {
          // Ne mozgassuk saját magába a mappát
          if (item._id === currentFolderId) return;

          const url = item.type === 'folder'
            ? `${API_BASE_URL}/documents/folders/${item._id}`
            : `${API_BASE_URL}/documents/files/${item._id}/move`;

          const body = item.type === 'folder'
            ? { parentId: currentFolderId }
            : { folderId: currentFolderId };

          const response = await fetch(url, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(body)
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Sikertelen áthelyezés: ${item.name}`);
          }
        });

        await Promise.all(promises);
        toast.success(`${items.length} elem sikeresen áthelyezve ide.`);
        setClipboard(null); // Töröljük a vágólapot kivágás után
        setSelectedItems([]);
        fetchDocuments(currentFolderId);
      } else if (action === 'copy') {
        const response = await fetch(`${API_BASE_URL}/documents/copy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            items: items.map(i => ({ _id: i._id, type: i.type })),
            targetFolderId: currentFolderId
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || 'Sikertelen másolás.');
        }

        toast.success(`${items.length} elem sikeresen beillesztve (lemásolva) ide.`);
        setSelectedItems([]);
        fetchDocuments(currentFolderId);
      }
    } catch (err) {
      toast.error(err.message || 'Hiba történt a beillesztés során.');
      fetchDocuments(currentFolderId);
    } finally {
      setLoading(false);
    }
  };

  // Billentyűzet gyorsbillentyűk (Ctrl+C, Ctrl+X, Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ha éppen input/textarea van fókuszban, ne zavarjuk a gépelést
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.key.toLowerCase() === 'c') {
        if (selectedItems.length > 0) {
          e.preventDefault();
          setClipboard({ action: 'copy', items: [...selectedItems] });
          toast.info(`${selectedItems.length} elem a vágólapra másolva.`);
        }
      } else if (isCtrl && e.key.toLowerCase() === 'x') {
        if (selectedItems.length > 0) {
          e.preventDefault();
          setClipboard({ action: 'cut', items: [...selectedItems] });
          toast.info(`${selectedItems.length} elem kivágva.`);
        }
      } else if (isCtrl && e.key.toLowerCase() === 'v') {
        if (clipboard && clipboard.items.length > 0) {
          e.preventDefault();
          handlePaste();
        }
      } else if (e.key === 'Delete') {
        if (selectedItems.length > 0) {
          e.preventDefault();
          handleDeleteItem(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedItems, clipboard, currentFolderId]);

  // Kattintás a breadcrumbs-ra
  const handleBreadcrumbClick = (id) => {
    setSelectedItem(null);
    setCurrentFolderId(id);
  };

  // Jobb klikk kezelése
  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    
    const isAlreadySelected = selectedItems.some(i => i._id === item._id);
    if (!isAlreadySelected) {
      setSelectedItems([{ ...item, type }]);
    }
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      type
    });
  };

  // Kattintás a háttérre a context menu elrejtéséhez
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu);
    };
  }, []);

  // Átnevezés kezdeményezése
  const handleRenameTrigger = (item, type) => {
    setRenameItem({ ...item, type });
    setRenameValue(item.name);
    setShowRenameModal(true);
  };

  // Átnevezés elküldése
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameValue.trim() || !renameItem) return;

    setRenaming(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const url = renameItem.type === 'folder'
        ? `${API_BASE_URL}/documents/folders/${renameItem._id}`
        : `${API_BASE_URL}/documents/files/${renameItem._id}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: renameValue.trim() })
      });

      if (!response.ok) {
        throw new Error('Sikertelen átnevezés.');
      }

      toast.success(renameItem.type === 'folder' ? 'Mappa átnevezve.' : 'Fájl átnevezve.');
      setShowRenameModal(false);
      setSelectedItem(null);
      fetchDocuments(currentFolderId);
    } catch (err) {
      toast.error(err.message || 'Hiba az átnevezés során.');
    } finally {
      setRenaming(false);
    }
  };

  // Mappa színének megváltoztatása
  const handleFolderColorChange = async (folder, colorCode) => {
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/documents/folders/${folder._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ color: colorCode })
      });

      if (!response.ok) {
        throw new Error('Sikertelen színmódosítás.');
      }

      toast.success('Mappa színe frissítve.');
      setSelectedItem(null);
      fetchDocuments(currentFolderId);
    } catch (err) {
      toast.error(err.message || 'Hiba a színmódosítás során.');
    }
  };

  // Fájl megosztása (Token generálás)
  const handleShareFile = async (file) => {
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/documents/files/${file._id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Nem sikerült létrehozni a megosztást.');
      }

      const data = await response.json();
      
      // Frissítjük a fájlok listát a lokális state-ben
      setFiles(prev => prev.map(f => f._id === file._id ? { ...f, shareToken: data.shareToken } : f));
      
      // Frissítjük a kijelölést is
      setSelectedItems(prev => prev.map(f => f._id === file._id ? { ...f, shareToken: data.shareToken } : f));

      toast.success('Megosztási link létrehozva.');
    } catch (err) {
      toast.error(err.message || 'Hiba a megosztás során.');
    }
  };

  // Megosztás visszavonása
  const handleUnshareFile = async (file) => {
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/documents/files/${file._id}/share`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Nem sikerült visszavonni a megosztást.');
      }

      // Frissítjük a fájlok listát a lokális state-ben
      setFiles(prev => prev.map(f => f._id === file._id ? { ...f, shareToken: null } : f));
      
      // Frissítjük a kijelölést is
      setSelectedItems(prev => prev.map(f => f._id === file._id ? { ...f, shareToken: null } : f));

      toast.success('Megosztás visszavonva.');
    } catch (err) {
      toast.error(err.message || 'Hiba a visszavonás során.');
    }
  };

  // Biztonságos Blob betöltés képekhez és PDF-ekhez (auth tokennel)
  useEffect(() => {
    if (!previewFile) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
      setPreviewBlobUrl(null);
      return;
    }

    const isMedia = previewFile.mimeType.startsWith('image/') || previewFile.mimeType === 'application/pdf';
    
    if (isMedia) {
      const token = localStorage.getItem('AccessToken');
      fetch(`${API_BASE_URL}/documents/files/${previewFile._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (!res.ok) throw new Error('Nem sikerült a fájl beolvasása');
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
      })
      .catch(err => {
        console.error(err);
        toast.error('Hiba történt a fájl előnézetének betöltésekor.');
      });
    }

    return () => {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewFile]);

  // Drag and Drop kezelők
  const handleDragStart = (e, file) => {
    const isSelected = selectedItems.some(i => i._id === file._id);
    const itemsToDrag = isSelected 
      ? selectedItems 
      : [{ ...file, type: 'file' }];
    e.dataTransfer.setData('itemsToDrag', JSON.stringify(itemsToDrag));
    e.dataTransfer.setData('itemType', 'file');
    e.dataTransfer.setData('itemId', file._id);
  };

  const handleFolderDragStart = (e, folder) => {
    const isSelected = selectedItems.some(i => i._id === folder._id);
    const itemsToDrag = isSelected 
      ? selectedItems 
      : [{ ...folder, type: 'folder' }];
    e.dataTransfer.setData('itemsToDrag', JSON.stringify(itemsToDrag));
    e.dataTransfer.setData('itemType', 'folder');
    e.dataTransfer.setData('itemId', folder._id);
  };

  const handleFolderDrop = async (e, targetFolder) => {
    e.preventDefault();
    setDragOverFolderId(null);
    
    const itemsData = e.dataTransfer.getData('itemsToDrag');
    let items = [];
    if (itemsData) {
      try {
        items = JSON.parse(itemsData);
      } catch (err) {
        items = [];
      }
    }

    if (items.length === 0) {
      const itemType = e.dataTransfer.getData('itemType');
      const itemId = e.dataTransfer.getData('itemId');
      if (itemId) {
        if (itemType === 'folder') {
          const f = folders.find(fd => fd._id === itemId);
          if (f) items.push({ ...f, type: 'folder' });
        } else {
          const fl = files.find(f => f._id === itemId);
          if (fl) items.push({ ...fl, type: 'file' });
        }
      }
    }

    if (items.length === 0) return;

    const validItems = items.filter(item => item._id !== targetFolder._id);
    if (validItems.length === 0) {
      toast.warning('Az elemek nem helyezhetők el saját magukban.');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const promises = validItems.map(async (item) => {
        const url = item.type === 'folder'
          ? `${API_BASE_URL}/documents/folders/${item._id}`
          : `${API_BASE_URL}/documents/files/${item._id}/move`;

        const body = item.type === 'folder'
          ? { parentId: targetFolder._id }
          : { folderId: targetFolder._id };

        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.message || `Sikertelen áthelyezés: ${item.name}`);
        }
      });

      await Promise.all(promises);
      toast.success(`${validItems.length} elem áthelyezve a '${targetFolder.name}' mappába.`);
      setSelectedItems([]);
      fetchDocuments(currentFolderId);
    } catch (err) {
      toast.error(err.message || 'Hiba történt az áthelyezések során.');
      fetchDocuments(currentFolderId);
    } finally {
      setLoading(false);
    }
  };

  // Számítógépről való Drag & Drop kezelők (Feltöltés)
  const handleContainerDragOver = (e) => {
    e.preventDefault();
    // Csak akkor jelezzük a külső fájl feltöltést, ha ténylegesen külső fájlt húzunk be, nem app elemet
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOverContainer(true);
    }
  };

  const handleContainerDragLeave = () => {
    setIsDraggingOverContainer(false);
  };

  const handleContainerDrop = async (e) => {
    e.preventDefault();
    setIsDraggingOverContainer(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const filesList = Array.from(e.dataTransfer.files);
      
      // 250MB limit ellenőrzés minden fájlra
      const MAX_SIZE = 250 * 1024 * 1024;
      const oversized = filesList.filter(f => f.size > MAX_SIZE);
      if (oversized.length > 0) {
        toast.error(`A következő fájlok mérete meghaladja a 250 MB-os limitet: ${oversized.map(f => f.name).join(', ')}`);
        return;
      }

      setUploading(true);
      toast.info(`${filesList.length} fájl feltöltésének indítása...`);

      try {
        const token = localStorage.getItem('AccessToken');
        const promises = filesList.map(async (file) => {
          const formData = new FormData();
          formData.append('file', file);
          if (currentFolderId) {
            formData.append('folderId', currentFolderId);
          }

          const response = await fetch(`${API_BASE_URL}/documents/files`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || `Nem sikerült feltölteni a következőt: ${file.name}`);
          }
        });

        await Promise.all(promises);
        toast.success(`Minden fájl (${filesList.length} db) sikeresen feltöltve.`);
        fetchDocuments(currentFolderId);
      } catch (err) {
        toast.error(err.message || 'Sikertelen fájlfeltöltés.');
        fetchDocuments(currentFolderId);
      } finally {
        setUploading(false);
      }
    }
  };

  // Egérrel való kijelölés (Rubber-band / Box Selection) kezelése
  const handleMouseDown = (e) => {
    // Csak a bal egérgombra reagáljunk
    if (e.button !== 0) return;

    // Ne indítsuk el a kijelölést, ha akciógombra, mappára vagy fájlra kattintott a felhasználó
    if (
      e.target.closest('.folder-card') || 
      e.target.closest('.file-card') || 
      e.target.closest('.explorer-actions') || 
      e.target.closest('.breadcrumbs-bar') ||
      e.target.closest('.loading-container') ||
      e.target.closest('.empty-state-card') ||
      e.target.closest('.drag-upload-overlay')
    ) {
      return;
    }

    if (!explorerRef.current) return;
    const rect = explorerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left + explorerRef.current.scrollLeft;
    const startY = e.clientY - rect.top + explorerRef.current.scrollTop;

    setDragSelection({
      startX,
      startY,
      currentX: startX,
      currentY: startY
    });
    setIsDragSelecting(true);

    // Kijelölések ürítése, kivéve ha a Ctrl/Cmd billentyű le van nyomva
    if (!e.ctrlKey && !e.metaKey) {
      setSelectedItems([]);
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragSelecting || !dragSelection || !explorerRef.current) return;

    const rect = explorerRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left + explorerRef.current.scrollLeft;
    const currentY = e.clientY - rect.top + explorerRef.current.scrollTop;

    setDragSelection(prev => {
      if (!prev) return null;
      return {
        ...prev,
        currentX,
        currentY
      };
    });

    // Kijelölő téglalap koordinátái
    const boxLeft = Math.min(dragSelection.startX, currentX);
    const boxTop = Math.min(dragSelection.startY, currentY);
    const boxRight = Math.max(dragSelection.startX, currentX);
    const boxBottom = Math.max(dragSelection.startY, currentY);

    const newlySelected = [];

    // Mappa kártyák átfedésének vizsgálata
    const folderElements = explorerRef.current.querySelectorAll('.folder-card');
    folderElements.forEach(el => {
      const elLeft = el.offsetLeft;
      const elTop = el.offsetTop;
      const elRight = elLeft + el.offsetWidth;
      const elBottom = elTop + el.offsetHeight;

      const overlaps = !(elLeft > boxRight || elRight < boxLeft || elTop > boxBottom || elBottom < boxTop);
      if (overlaps) {
        const id = el.getAttribute('data-id');
        const folderObj = folders.find(f => f._id === id);
        if (folderObj) {
          newlySelected.push({ ...folderObj, type: 'folder' });
        }
      }
    });

    // Fájl kártyák átfedésének vizsgálata
    const fileElements = explorerRef.current.querySelectorAll('.file-card');
    fileElements.forEach(el => {
      const elLeft = el.offsetLeft;
      const elTop = el.offsetTop;
      const elRight = elLeft + el.offsetWidth;
      const elBottom = elTop + el.offsetHeight;

      const overlaps = !(elLeft > boxRight || elRight < boxLeft || elTop > boxBottom || elBottom < boxTop);
      if (overlaps) {
        const id = el.getAttribute('data-id');
        const fileObj = files.find(f => f._id === id);
        if (fileObj) {
          newlySelected.push({ ...fileObj, type: 'file' });
        }
      }
    });

    setSelectedItems(newlySelected);
  };

  const handleMouseUp = () => {
    setIsDragSelecting(false);
    setDragSelection(null);
  };

  // Globális egéresemények a zökkenőmentes kijelöléshez (akár a konténeren kívül is elengedve)
  useEffect(() => {
    if (!isDragSelecting) return;

    const handleGlobalMouseMove = (e) => {
      handleMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragSelecting, dragSelection, folders, files]);

  // Mappa létrehozása
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setCreatingFolder(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/documents/folders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: currentFolderId
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Hiba a mappa létrehozásakor');
      }

      toast.success('Mappa sikeresen létrehozva.');
      setNewFolderName('');
      setShowFolderModal(false);
      fetchDocuments(currentFolderId);
    } catch (err) {
      toast.error(err.message || 'Nem sikerült létrehozni a mappát.');
    } finally {
      setCreatingFolder(false);
    }
  };

  // Fájlfeltöltés indítása
  const handleUploadTrigger = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Fájlfeltöltés végrehajtása
  const handleFileUpload = async (e) => {
    const filesList = Array.from(e.target.files);
    if (filesList.length === 0) return;

    // 250MB limit ellenőrzés minden fájlra
    const MAX_SIZE = 250 * 1024 * 1024;
    const oversized = filesList.filter(f => f.size > MAX_SIZE);
    if (oversized.length > 0) {
      toast.error(`A következő fájlok mérete meghaladja a 250 MB-os limitet: ${oversized.map(f => f.name).join(', ')}`);
      e.target.value = null;
      return;
    }

    setUploading(true);
    toast.info(`${filesList.length} fájl feltöltésének indítása...`);

    try {
      const token = localStorage.getItem('AccessToken');
      const promises = filesList.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        if (currentFolderId) {
          formData.append('folderId', currentFolderId);
        }

        const response = await fetch(`${API_BASE_URL}/documents/files`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || `Nem sikerült feltölteni a következőt: ${file.name}`);
        }
      });

      await Promise.all(promises);
      toast.success(`Minden fájl (${filesList.length} db) sikeresen feltöltve.`);
      fetchDocuments(currentFolderId);
    } catch (err) {
      toast.error(err.message || 'Sikertelen fájlfeltöltés.');
      fetchDocuments(currentFolderId);
    } finally {
      setUploading(false);
      e.target.value = null; // reset input
    }
  };

  // Elem kiválasztása (egyszeri kattintás)
  const handleItemSelect = (item, type, e) => {
    if (e && (e.ctrlKey || e.metaKey)) {
      const exists = selectedItems.some(i => i._id === item._id);
      if (exists) {
        setSelectedItems(selectedItems.filter(i => i._id !== item._id));
      } else {
        setSelectedItems([...selectedItems, { ...item, type }]);
      }
    } else {
      setSelectedItems([{ ...item, type }]);
    }
  };

  // Mappa belépés (dupla kattintás)
  const handleFolderDoubleClick = (folder) => {
    setSelectedItem(null);
    setCurrentFolderId(folder._id);
  };

  // Fájl előnézet megnyitása (dupla kattintás vagy megnyitás gomb)
  const handleFilePreview = async (file) => {
    setPreviewFile(file);
    setTextPreviewContent('');
    
    // Szöveg alapú fájlok lekérése olvasáshoz
    const isText = file.mimeType.startsWith('text/') || 
                   file.mimeType === 'application/json' || 
                   file.mimeType === 'application/javascript';
                   
    if (isText) {
      setLoadingTextPreview(true);
      try {
        const token = localStorage.getItem('AccessToken');
        const response = await fetch(`${API_BASE_URL}/documents/files/${file._id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const text = await response.text();
          setTextPreviewContent(text);
        } else {
          setTextPreviewContent('Nem sikerült betölteni a fájl tartalmát.');
        }
      } catch (err) {
        setTextPreviewContent('Hiba a tartalom betöltésekor.');
      } finally {
        setLoadingTextPreview(false);
      }
    }
  };

  // Elem(ek) kijelölése törlésre (Modális ablak megnyitása)
  const handleDeleteItem = (item) => {
    const itemsToDelete = item ? [item] : selectedItems;
    if (itemsToDelete.length === 0 || !itemsToDelete[0]) return;

    const confirmMessage = itemsToDelete.length > 1
      ? `Biztosan törölni szeretnéd a kijelölt ${itemsToDelete.length} elemet és minden tartalmukat rekurzívan?`
      : itemsToDelete[0].type === 'folder'
        ? 'Biztosan törölni szeretnéd ezt a mappát és minden tartalmát rekurzívan?'
        : 'Biztosan törölni szeretnéd ezt a fájlt?';
        
    setConfirmDeleteModal({
      isOpen: true,
      items: itemsToDelete,
      message: confirmMessage
    });
  };

  // Elem(ek) tényleges törlése a szerverről
  const executeDeleteItems = async () => {
    const itemsToDelete = confirmDeleteModal.items;
    setConfirmDeleteModal({ isOpen: false, items: [], message: '' });
    if (itemsToDelete.length === 0) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const promises = itemsToDelete.map(async (currentItem) => {
        const url = currentItem.type === 'folder'
          ? `${API_BASE_URL}/documents/folders/${currentItem._id}`
          : `${API_BASE_URL}/documents/files/${currentItem._id}`;
          
        const response = await fetch(url, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`Sikertelen törlés: ${currentItem.name}`);
        }
      });

      await Promise.all(promises);
      toast.success(itemsToDelete.length > 1 ? `${itemsToDelete.length} elem sikeresen törölve.` : 'Elem sikeresen törölve.');
      setSelectedItems([]);
      fetchDocuments(currentFolderId);
    } catch (err) {
      toast.error(err.message || 'Hiba történt a törlés során.');
      fetchDocuments(currentFolderId);
    } finally {
      setLoading(false);
    }
  };

  // Fájl letöltése
  const handleDownloadFile = (file) => {
    if (!file) return;
    const token = localStorage.getItem('AccessToken');
    const url = `${API_BASE_URL}/documents/files/${file._id}?download=true`;
    
    // Létrehozunk egy rejtett linket, amire átadjuk a tokenes autorizációt letöltésként
    // Mivel a böngészőből natív letöltést szeretnénk de be kell állítanunk a Bearer tokent,
    // fetch-el lekérjük blobként és elindítjuk a letöltést:
    toast.info('Letöltés indítása...');
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(res => {
      if (!res.ok) throw new Error('Letöltési hiba');
      return res.blob();
    })
    .then(blob => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    })
    .catch(err => {
      toast.error('Nem sikerült a fájl letöltése.');
    });
  };

  // Fájlméret formázás
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Dátum formázás
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('hu-HU', options);
  };

  // Fájl típus ikon kiválasztása
  const getFileIcon = (mimeType) => {
    if (!mimeType) return <FaFile className="file-icon" />;
    if (mimeType.startsWith('image/')) return <FaFileImage className="file-icon image-icon" />;
    if (mimeType === 'application/pdf') return <FaFilePdf className="file-icon pdf-icon" />;
    if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml')) return <FaFileWord className="file-icon word-icon" />;
    if (mimeType.includes('excel') || mimeType.includes('officedocument.spreadsheetml')) return <FaFileExcel className="file-icon excel-icon" />;
    return <FaFile className="file-icon default-file-icon" />;
  };

  return (
    <div id="content">
      <div className="documents-page-container">
      {/* Címsor */}
      <div className="page-header-banner">
        <div className="phb-icon">
          <FaFolderOpen />
        </div>
        <div className="phb-text">
          <h1 className="phb-title">Dokumentumok</h1>
          <p className="phb-subtitle">Kezeld, rendszerezd és tekintsd meg feltöltött anyagaidat egy helyen.</p>
        </div>
      </div>

      <div className="documents-main-layout">
        {/* Bal oldali Fájlkezelő rész */}
        <div className="explorer-column">
          {/* Akció gombok és gyors elérések */}
          <div className="explorer-actions">
            <button className="btn-primary-custom" onClick={() => setShowFolderModal(true)}>
              <FaFolderPlus /> Új mappa
            </button>
            <button className="btn-secondary-custom" onClick={handleUploadTrigger} disabled={uploading}>
              {uploading ? <FaSpinner className="spin" /> : <FaUpload />} {uploading ? 'Feltöltés...' : 'Fájl feltöltése'}
            </button>
            <input 
              type="file" 
              multiple 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleFileUpload} 
            />
          </div>

          {/* Morzsaútvonal (Breadcrumbs) */}
          <div className="breadcrumbs-bar">
            <span 
              className={`breadcrumb-item ${currentFolderId === null ? 'active' : ''} ${dragOverFolderId === 'root' ? 'drag-over' : ''}`}
              onClick={() => handleBreadcrumbClick(null)}
              onDragOver={(e) => { e.preventDefault(); setDragOverFolderId('root'); }}
              onDragLeave={() => setDragOverFolderId(null)}
              onDrop={(e) => handleFolderDrop(e, { _id: null, name: 'Saját meghajtó' })}
            >
              Saját meghajtó
            </span>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <span className="breadcrumb-separator">/</span>
                <span 
                  className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active' : ''} ${dragOverFolderId === crumb.id ? 'drag-over' : ''}`}
                  onClick={() => handleBreadcrumbClick(crumb.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(crumb.id); }}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDrop={(e) => handleFolderDrop(e, { _id: crumb.id, name: crumb.name })}
                >
                  {crumb.name}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Explorer terület */}
          <div 
            ref={explorerRef}
            className="explorer-grid-container"
            onMouseDown={handleMouseDown}
            onDragOver={handleContainerDragOver}
            onDragLeave={handleContainerDragLeave}
            onDrop={handleContainerDrop}
            style={{ position: 'relative', userSelect: 'none' }}
          >
            {isDraggingOverContainer && (
              <div className="drag-upload-overlay animate-slide-in">
                <div className="overlay-content">
                  <FaUpload className="overlay-icon spin-pulse" />
                  <h3>Húzd ide a fájlokat</h3>
                  <p>Engedd el a gombot az azonnali felhő feltöltéshez.</p>
                </div>
              </div>
            )}

            {dragSelection && (
              <div 
                className="drag-selection-box"
                style={{
                  position: 'absolute',
                  left: Math.min(dragSelection.startX, dragSelection.currentX),
                  top: Math.min(dragSelection.startY, dragSelection.currentY),
                  width: Math.abs(dragSelection.startX - dragSelection.currentX),
                  height: Math.abs(dragSelection.startY - dragSelection.currentY),
                  border: '1.5px solid var(--color-primary)',
                  background: 'rgba(59, 130, 246, 0.15)',
                  borderRadius: '4px',
                  pointerEvents: 'none',
                  zIndex: 1000
                }}
              />
            )}

            {loading ? (
              <LoadingSpinner />
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="empty-state-card">
                <div className="empty-icon">
                  <FaFolderOpen />
                </div>
                <h3>Ez a mappa üres</h3>
                <p>Hozz létre egy új mappát vagy tölts fel dokumentumokat, képeket a fenti gombok segítségével.</p>
              </div>
            ) : (
              <>
                {/* Mappák rács */}
                {folders.length > 0 && (
                  <div className="explorer-section">
                    <h4 className="section-title">Mappák</h4>
                    <div className="folders-grid">
                      {folders.map(folder => (
                        <div 
                          key={folder._id} 
                          data-id={folder._id}
                          data-type="folder"
                          className={`folder-card ${selectedItems.some(i => i._id === folder._id) ? 'selected' : ''} ${dragOverFolderId === folder._id ? 'drag-over' : ''} ${clipboard?.action === 'cut' && clipboard.items.some(i => i._id === folder._id) ? 'cut-item' : ''}`}
                          onClick={(e) => handleItemSelect(folder, 'folder', e)}
                          onDoubleClick={() => handleFolderDoubleClick(folder)}
                          onContextMenu={(e) => handleContextMenu(e, folder, 'folder')}
                          draggable
                          onDragStart={(e) => handleFolderDragStart(e, folder)}
                          onDragEnter={(e) => { e.preventDefault(); setDragOverFolderId(folder._id); }}
                          onDragLeave={() => setDragOverFolderId(null)}
                          onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder._id); }}
                          onDrop={(e) => handleFolderDrop(e, folder)}
                        >
                          <FaFolder className="folder-icon" style={{ color: folder.color || '#f59e0b' }} />
                          <span className="folder-name" title={folder.name}>{folder.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fájlok rács */}
                {files.length > 0 && (
                  <div className="explorer-section">
                    <h4 className="section-title">Fájlok</h4>
                    <div className="files-grid">
                      {files.map(file => (
                        <div 
                          key={file._id} 
                          data-id={file._id}
                          data-type="file"
                          className={`file-card ${selectedItems.some(i => i._id === file._id) ? 'selected' : ''} ${clipboard?.action === 'cut' && clipboard.items.some(i => i._id === file._id) ? 'cut-item' : ''}`}
                          onClick={(e) => handleItemSelect(file, 'file', e)}
                          onDoubleClick={() => handleFilePreview(file)}
                          onContextMenu={(e) => handleContextMenu(e, file, 'file')}
                          draggable
                          onDragStart={(e) => handleDragStart(e, file)}
                        >
                          <div className="file-thumbnail">
                            {getFileIcon(file.mimeType)}
                          </div>
                          <div className="file-info-bar">
                            <span className="file-name" title={file.name}>{file.name}</span>
                            <span className="file-size-tag">{formatBytes(file.size)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Jobb oldali Részletek sáv */}
        <div className="details-column">
          <div className="details-panel-card">
            {selectedItems.length > 1 ? (
              <div className="details-content animate-slide-in">
                <div className="doc-details-header">
                  <h4 className="panel-title">Kijelölés</h4>
                  <button className="doc-close-btn-sub" onClick={() => setSelectedItems([])}>
                    <FaTimes />
                  </button>
                </div>
                
                <div className="details-visual-preview">
                  <FaFolderOpen className="details-large-icon" style={{ color: 'var(--color-primary)', fontSize: '4.5rem', opacity: 0.8 }} />
                </div>

                <h3 className="details-item-title">{selectedItems.length} kijelölt elem</h3>

                <div className="details-meta-list">
                  <div className="meta-row">
                    <span className="meta-label">Mappák:</span>
                    <span className="meta-value">
                      {selectedItems.filter(i => i.type === 'folder').length} db
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Fájlok:</span>
                    <span className="meta-value">
                      {selectedItems.filter(i => i.type === 'file').length} db
                    </span>
                  </div>
                  {selectedItems.filter(i => i.type === 'file').length > 0 && (
                    <div className="meta-row">
                      <span className="meta-label">Összméret:</span>
                      <span className="meta-value">
                        {formatBytes(selectedItems.reduce((acc, i) => acc + (i.size || 0), 0))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="details-actions-bar">
                  <button 
                    className="btn-action btn-delete" 
                    onClick={() => handleDeleteItem(null)}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <FaTrashAlt /> Kijelöltek törlése ({selectedItems.length})
                  </button>
                </div>
              </div>
            ) : selectedItem ? (
              <div className="details-content animate-slide-in">
                <div className="doc-details-header">
                  <h4 className="panel-title">Részletek</h4>
                  <button className="doc-close-btn-sub" onClick={() => setSelectedItem(null)}>
                    <FaTimes />
                  </button>
                </div>
                
                <div className="details-visual-preview">
                  {selectedItem.type === 'folder' ? (
                    <FaFolder className="details-large-icon folder-color" style={{ color: selectedItem.color || '#f59e0b' }} />
                  ) : (
                    getFileIcon(selectedItem.mimeType)
                  )}
                </div>

                <h3 className="details-item-title" title={selectedItem.name}>{selectedItem.name}</h3>

                <div className="details-meta-list">
                  <div className="meta-row">
                    <span className="meta-label">Típus:</span>
                    <span className="meta-value">
                      {selectedItem.type === 'folder' ? 'Mappa' : selectedItem.mimeType}
                    </span>
                  </div>
                  {selectedItem.type === 'file' && (
                    <div className="meta-row">
                      <span className="meta-label">Méret:</span>
                      <span className="meta-value">{formatBytes(selectedItem.size)}</span>
                    </div>
                  )}
                  <div className="meta-row">
                    <span className="meta-label">Létrehozva:</span>
                    <span className="meta-value">{formatDate(selectedItem.createdAt)}</span>
                  </div>
                </div>

                <div className="details-actions-bar">
                  {selectedItem.type === 'file' && (
                    <>
                      <button 
                        className="btn-action btn-view" 
                        onClick={() => handleFilePreview(selectedItem)}
                      >
                        <FaEye /> Megnyitás
                      </button>
                      <button 
                        className="btn-action btn-download" 
                        onClick={() => handleDownloadFile(selectedItem)}
                      >
                        <FaDownload /> Letöltés
                      </button>

                      {selectedItem.shareToken ? (
                        <div className="share-link-container animate-fade-in" style={{
                          gridColumn: 'span 2',
                          marginTop: '12px',
                          padding: '12px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          textAlign: 'left'
                        }}>
                          <label style={{
                            display: 'block',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-secondary)',
                            marginBottom: '6px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>Aktív megosztási link</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="text" 
                              readOnly 
                              value={`${window.location.origin}/api/documents/shared/${selectedItem.shareToken}`} 
                              onClick={(e) => e.target.select()}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                color: '#a7f3d0',
                                outline: 'none'
                              }}
                            />
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/api/documents/shared/${selectedItem.shareToken}`);
                                toast.success('Megosztási link vágólapra másolva!');
                              }}
                              style={{
                                padding: '6px 12px',
                                background: 'var(--color-primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                fontWeight: '500'
                              }}
                            >
                              Másolás
                            </button>
                          </div>
                          <button 
                            className="btn-action btn-delete"
                            onClick={() => handleUnshareFile(selectedItem)}
                            style={{
                              width: '100%',
                              marginTop: '8px',
                              padding: '6px',
                              fontSize: '0.75rem',
                              justifyContent: 'center',
                              gap: '6px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}
                          >
                            <FaUnlink /> Megosztás megszüntetése
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="btn-action btn-share" 
                          onClick={() => handleShareFile(selectedItem)}
                          style={{
                            gridColumn: 'span 2',
                            marginTop: '6px',
                            justifyContent: 'center',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <FaLink /> Megosztási link generálása
                        </button>
                      )}
                    </>
                  )}
                  <button 
                    className="btn-action btn-delete" 
                    onClick={() => handleDeleteItem(selectedItem)}
                  >
                    <FaTrashAlt /> Törlés
                  </button>
                </div>
              </div>
            ) : (
              <div className="details-placeholder">
                <FaInfoCircle className="placeholder-icon" />
                <p>Kattints egyszer egy fájlra vagy mappára a részleteinek megtekintéséhez.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Új Mappa Modal */}
      {showFolderModal && (
        <div className="modal-overlay-custom">
          <div className="modal-card-custom animate-slide-down">
            <div className="modal-header-custom">
              <h3>Új mappa létrehozása</h3>
              <button className="modal-close" onClick={() => setShowFolderModal(false)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="modal-body-custom">
                <label htmlFor="folderName">Mappa neve</label>
                <input 
                  type="text" 
                  id="folderName"
                  className="form-control-custom"
                  placeholder="Pl. Feladatlapok, Képek..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-footer-custom">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowFolderModal(false)}
                >
                  Mégse
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={creatingFolder || !newFolderName.trim()}
                >
                  {creatingFolder ? 'Létrehozás...' : 'Létrehozás'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fájl előnézet Modal (Double click / Megnyitás) */}
      {previewFile && (
        <div className="preview-overlay-modal">
          <div className="preview-container-card">
            <div className="preview-header-bar">
              <span className="preview-title" title={previewFile.name}>{previewFile.name}</span>
              <div className="preview-actions-group">
                <button 
                  className="preview-btn-action download" 
                  onClick={() => handleDownloadFile(previewFile)}
                  title="Letöltés"
                >
                  <FaDownload /> Letöltés
                </button>
                <button 
                  className="preview-btn-action close" 
                  onClick={() => setPreviewFile(null)}
                  title="Bezárás"
                >
                  <FaTimes /> Bezárás
                </button>
              </div>
            </div>

            <div className="preview-content-viewport">
              {loadingTextPreview ? (
                <div className="preview-loading">
                  <FaSpinner className="spin-large" />
                  <p>Fájl beolvasása...</p>
                </div>
              ) : previewFile.mimeType.startsWith('image/') ? (
                <div className="image-preview-wrapper">
                  <img 
                    src={previewBlobUrl || ''} 
                    alt={previewFile.name} 
                    className="image-preview-element"
                  />
                </div>
              ) : previewFile.mimeType === 'application/pdf' ? (
                <iframe 
                  src={previewBlobUrl ? `${previewBlobUrl}#toolbar=0` : ''} 
                  title={previewFile.name}
                  className="pdf-preview-element"
                />
              ) : (previewFile.mimeType.startsWith('text/') || 
                   previewFile.mimeType === 'application/json' || 
                   previewFile.mimeType === 'application/javascript') ? (
                <div className="text-preview-element">
                  <pre><code>{textPreviewContent}</code></pre>
                </div>
              ) : (
                <div className="unsupported-preview-element">
                  {getFileIcon(previewFile.mimeType)}
                  <h3>Ehhez a fájltípushoz nincs előnézet</h3>
                  <p>A(z) <strong>{previewFile.name}</strong> ({formatBytes(previewFile.size)}) fájltípusa nem támogatja a közvetlen előnézetet a böngészőben.</p>
                  <button 
                    className="btn-primary-custom margin-top-lg"
                    onClick={() => handleDownloadFile(previewFile)}
                  >
                    <FaDownload /> Fájl letöltése
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Átnevezés Modal */}
      {showRenameModal && renameItem && (
        <div className="modal-overlay-custom">
          <div className="modal-card-custom animate-slide-down">
            <div className="modal-header-custom">
              <h3>{renameItem.type === 'folder' ? 'Mappa átnevezése' : 'Fájl átnevezése'}</h3>
              <button className="modal-close" onClick={() => setShowRenameModal(false)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleRenameSubmit}>
              <div className="modal-body-custom">
                <label htmlFor="renameField">Új név</label>
                <input 
                  type="text" 
                  id="renameField"
                  className="form-control-custom"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="modal-footer-custom">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowRenameModal(false)}
                >
                  Mégse
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={renaming || !renameValue.trim()}
                >
                  {renaming ? 'Mentés...' : 'Mentés'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Egyedi Jobb Klikk Context Menu */}
      {contextMenu && (
        <div 
          className="custom-context-menu animate-slide-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-header">Műveletek</div>
          {selectedItems.length > 1 ? (
            <>
              <div className="context-meta-info" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {selectedItems.length} kijelölt elem
              </div>
              <button 
                className="context-item text-danger" 
                onClick={() => { handleDeleteItem(null); setContextMenu(null); }}
              >
                <FaTrashAlt /> Kijelöltek törlése ({selectedItems.length})
              </button>
            </>
          ) : contextMenu.type === 'folder' ? (
            <>
              <button className="context-item" onClick={() => { handleFolderDoubleClick(contextMenu.item); setContextMenu(null); }}>
                <FaFolderOpen /> Megnyitás
              </button>
              <button className="context-item" onClick={() => { handleRenameTrigger(contextMenu.item, 'folder'); setContextMenu(null); }}>
                <FaEdit /> Átnevezés
              </button>
              <div className="context-submenu-palette">
                <div className="palette-label"><FaPalette /> Mappa színe</div>
                <div className="palette-colors">
                  {[
                    { name: 'Arany', hex: '#f59e0b' },
                    { name: 'Kék', hex: '#3b82f6' },
                    { name: 'Zöld', hex: '#10b981' },
                    { name: 'Piros', hex: '#ef4444' },
                    { name: 'Lila', hex: '#8b5cf6' }
                  ].map(c => (
                    <button 
                      key={c.hex} 
                      className={`color-dot ${contextMenu.item.color === c.hex ? 'active' : ''}`}
                      style={{ backgroundColor: c.hex }} 
                      title={c.name}
                      onClick={() => { handleFolderColorChange(contextMenu.item, c.hex); setContextMenu(null); }}
                    />
                  ))}
                </div>
              </div>
              <button className="context-item text-danger" onClick={() => { handleDeleteItem({ ...contextMenu.item, type: 'folder' }); setContextMenu(null); }}>
                <FaTrashAlt /> Törlés
              </button>
            </>
          ) : (
            <>
              <button className="context-item" onClick={() => { handleFilePreview(contextMenu.item); setContextMenu(null); }}>
                <FaEye /> Előnézet
              </button>
              <button className="context-item" onClick={() => { handleDownloadFile(contextMenu.item); setContextMenu(null); }}>
                <FaDownload /> Letöltés
              </button>
              <button className="context-item" onClick={() => { handleRenameTrigger(contextMenu.item, 'file'); setContextMenu(null); }}>
                <FaEdit /> Átnevezés
              </button>
              <button className="context-item text-danger" onClick={() => { handleDeleteItem({ ...contextMenu.item, type: 'file' }); setContextMenu(null); }}>
                <FaTrashAlt /> Törlés
              </button>
            </>
          )}
        </div>
      )}
      {/* Custom Confirm Delete Modal */}
      <ConfirmModal 
        isOpen={confirmDeleteModal.isOpen}
        title="Elemek törlése"
        message={confirmDeleteModal.message}
        confirmText="Törlés"
        cancelText="Mégse"
        type="danger"
        onConfirm={executeDeleteItems}
        onCancel={() => setConfirmDeleteModal({ isOpen: false, items: [], message: '' })}
      />
      </div>
    </div>
  );
};

export default Documents;
