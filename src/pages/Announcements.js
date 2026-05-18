import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../api/config';
import { 
  FaChalkboard, 
  FaBullhorn, 
  FaTrashAlt, 
  FaPlus, 
  FaSpinner, 
  FaUserGraduate, 
  FaCalendarAlt, 
  FaClock,
  FaBell,
  FaChevronDown
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import CustomSelect from '../components/CustomSelect';
import '../styles/Announcements.css';


const Announcements = () => {
  const { user } = useUser() || {};
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teacherClassesData, setTeacherClassesData] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  
  const [selectedRosterClassId, setSelectedRosterClassId] = useState('');
  const [newlyJoinedIds, setNewlyJoinedIds] = useState(new Set());
  // Track new announcement IDs for highlight animation
  const [newAnnouncementIds, setNewAnnouncementIds] = useState(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('AccessToken');
      
      const resAnn = await fetch(`${API_BASE_URL}/announcements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resAnn.ok) throw new Error('Sikertelen betöltés.');
      const dataAnn = await resAnn.json();
      setAnnouncements(dataAnn.announcements || []);
      setClasses(dataAnn.classes || []);
      if (dataAnn.classes?.length > 0) {
        setSelectedClassId(dataAnn.classes[0]._id);
      }

      if (user?.role === 'teacher') {
        const resCls = await fetch(`${API_BASE_URL}/teacher/classes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resCls.ok) {
          const dataCls = await resCls.json();
          setTeacherClassesData(dataCls.classes || []);
          if (dataCls.classes?.length > 0) {
            setSelectedRosterClassId(dataCls.classes[0]._id);
          }
        }
      }
    } catch (err) {
      toast.error(err.message || 'Hiba az adatok letöltése során.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role) {
      fetchData();
    }
  }, [user, fetchData]);

  // SSE: Tanár – diákok belépésének figyelése
  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const token = localStorage.getItem('AccessToken');
    if (!token) return;

    const sseUrl = `${API_BASE_URL}/realtime/stream?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'student_joined') {
          const { classId, className, student } = parsed.data;
          setTeacherClassesData(prevClasses => {
            const classExists = prevClasses.some(c => String(c._id) === String(classId));
            if (!classExists) return prevClasses;
            return prevClasses.map(c => {
              if (String(c._id) !== String(classId)) return c;
              const studentExists = c.studentIds.some(s => String(s._id) === String(student._id));
              if (studentExists) return c;
              toast.info(`Új diák regisztrált a(z) ${className} osztályodba: ${student.name}!`);
              setNewlyJoinedIds(prevSet => {
                const updated = new Set(prevSet);
                updated.add(student._id);
                return updated;
              });
              setTimeout(() => {
                setNewlyJoinedIds(prevSet => {
                  const updated = new Set(prevSet);
                  updated.delete(student._id);
                  return updated;
                });
              }, 12000);
              return { ...c, studentIds: [...c.studentIds, student] };
            });
          });
        }
      } catch (err) {
        console.error('[SSE Roster Parser Error]', err);
      }
    };

    eventSource.onerror = () => {};
    return () => eventSource.close();
  }, [user]);

  // SSE: Diák – új bejegyzés figyelése (valós idejű frissítés)
  useEffect(() => {
    if (user?.role !== 'student') return;
    const token = localStorage.getItem('AccessToken');
    if (!token) return;

    const sseUrl = `${API_BASE_URL}/realtime/stream?token=${token}`;
    const es = new EventSource(sseUrl);

    es.addEventListener('new_announcement', (event) => {
      try {
        const data = JSON.parse(event.data);
        // Újratöltjük az összes közleményt, hogy megkapjuk a teljes, populált objektumot
        const token2 = localStorage.getItem('AccessToken');
        fetch(`${API_BASE_URL}/announcements`, {
          headers: { 'Authorization': `Bearer ${token2}` }
        })
          .then(r => r.json())
          .then(d => {
            if (d.announcements?.length > 0) {
              const freshId = d.announcements[0]._id;
              setAnnouncements(d.announcements);
              // Flash kiemelés az új bejegyzésre
              setNewAnnouncementIds(prev => {
                const s = new Set(prev);
                s.add(freshId);
                return s;
              });
              setTimeout(() => {
                setNewAnnouncementIds(prev => {
                  const s = new Set(prev);
                  s.delete(freshId);
                  return s;
                });
              }, 8000);
              toast.info(`📢 ${data.teacherName} új bejegyzést tett ki: "${data.title}"`);
            }
          })
          .catch(() => {});
      } catch {}
    });

    es.onerror = () => {};
    return () => es.close();
  }, [user]);

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !selectedClassId) {
      toast.warning('Kérlek töltsd ki az összes mezőt.');
      return;
    }
    setPosting(true);
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), classId: selectedClassId })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Sikertelen közzététel.');
      }
      const data = await response.json();
      setAnnouncements(prev => [data.announcement, ...prev]);
      setTitle('');
      setContent('');
      toast.success('Közlemény sikeresen közzétéve az osztálynak!');
    } catch (err) {
      toast.error(err.message || 'Hiba a közzététel során.');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a közleményt?')) return;
    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Nem sikerült törölni a közleményt.');
      setAnnouncements(prev => prev.filter(a => a._id !== id));
      toast.success('Közlemény törölve.');
    } catch (err) {
      toast.error(err.message || 'Hiba a törlés során.');
    }
  };

  const getActiveRoster = () => {
    return teacherClassesData.find(c => String(c._id) === String(selectedRosterClassId))?.studentIds || [];
  };

  return (
    <div id="content">
      <div className="ann-container">

        {/* Fejléc banner */}
        <div className="page-header-banner animate-slide-down">
          <div className="phb-icon">
            <FaChalkboard />
          </div>
          <div className="phb-text">
            <h1 className="phb-title">Osztálytermi Faliújság</h1>
            <p className="phb-subtitle">
              {user?.role === 'teacher'
                ? 'Tegyél közzé bejelentéseket diákjaidnak, és kövesd valós időben a virtuális tanterem névsorát.'
                : 'Nézd meg a tanáraid által kitett legfrissebb felhívásokat és osztálytermi híreket.'}
            </p>
          </div>
        </div>

        {loading ? (
          <div style={{ minHeight: '300px' }}>
            <LoadingSpinner />
          </div>
        ) : (
          <div className={`ann-grid ${user?.role === 'teacher' ? 'ann-grid--two-col' : ''}`}>

            {/* ========== TANÁR NÉZET ========== */}
            {user?.role === 'teacher' && (
              <>
                {/* Bal oszlop: Form + Névsor */}
                <div className="ann-left-col animate-slide-in">

                  {/* Új bejegyzés kártya */}
                  <div className="ann-card">
                    <h3 className="ann-card-title">
                      <FaPlus className="ann-card-title-icon ann-card-title-icon--primary" />
                      Új üzenet közzététele
                    </h3>
                    <form onSubmit={handlePostAnnouncement} className="ann-form">
                      <div className="ann-field">
                        <label className="ann-label">Célosztály</label>
                        <CustomSelect
                          value={selectedClassId}
                          onChange={setSelectedClassId}
                          options={classes.map(c => ({ value: c._id, label: c.name }))}
                          placeholder="Válassz osztályt"
                          icon={<FaChalkboard />}
                        />
                      </div>

                      <div className="ann-field">
                        <label className="ann-label">Bejegyzés címe</label>
                        <input
                          type="text"
                          placeholder="Pl. Házi feladat határidő módosulás"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          maxLength={100}
                          className="ann-input"
                        />
                      </div>

                      <div className="ann-field">
                        <label className="ann-label">Üzenet szövege</label>
                        <textarea
                          rows={4}
                          placeholder="Írd ide a részleteket..."
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          className="ann-textarea"
                        />
                      </div>

                      <button type="submit" disabled={posting} className="ann-submit-btn">
                        {posting ? <FaSpinner className="spin" /> : <FaPlus />}
                        Bejegyzés közzététele
                      </button>
                    </form>
                  </div>

                  {/* Névsor kártya */}
                  <div className="ann-card">
                    <div className="ann-roster-header">
                      <h3 className="ann-card-title" style={{ margin: 0 }}>
                        <FaUserGraduate className="ann-card-title-icon ann-card-title-icon--green" />
                        Virtuális Névsor
                      </h3>
                    </div>

                    <div className="ann-field">
                      <label className="ann-label">Válassz osztályt</label>
                      <CustomSelect
                        value={selectedRosterClassId}
                        onChange={setSelectedRosterClassId}
                        options={teacherClassesData.map(c => ({ value: c._id, label: `${c.name} (${c.studentIds?.length || 0} fő)` }))}
                        placeholder="Válassz osztályt"
                        icon={<FaUserGraduate />}
                      />
                    </div>

                    <div className="ann-roster-list">
                      {getActiveRoster().length === 0 ? (
                        <div className="ann-empty-small">Nincsenek diákok ebben az osztályban.</div>
                      ) : (
                        getActiveRoster().map(student => {
                          const isNew = newlyJoinedIds.has(student._id);
                          return (
                            <div key={student._id} className={`ann-roster-item ${isNew ? 'ann-roster-item--new' : ''}`}>
                              <div>
                                <div className={`ann-roster-name ${isNew ? 'ann-roster-name--new' : ''}`}>{student.name}</div>
                                <div className="ann-roster-email">{student.email}</div>
                              </div>
                              {isNew && <span className="ann-new-badge">ÚJONC!</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Jobb oszlop: Eddigi bejegyzések */}
                <div className="ann-right-col animate-slide-in">
                  <h3 className="ann-section-title">
                    <FaBullhorn className="ann-section-title-icon" />
                    Eddigi bejelentéseid
                  </h3>

                  {announcements.length === 0 ? (
                    <div className="ann-empty-card">Még nem tettél ki közleményt.</div>
                  ) : (
                    <div className="ann-list">
                      {announcements.map(ann => (
                        <div key={ann._id} className="ann-teacher-item">
                          <div className="ann-teacher-item-top">
                            <span className="ann-class-badge">{ann.classId?.name || 'Ismeretlen osztály'}</span>
                            <button
                              onClick={() => handleDeleteAnnouncement(ann._id)}
                              className="ann-delete-btn"
                              title="Közlemény törlése"
                            >
                              <FaTrashAlt />
                            </button>
                          </div>
                          <h4 className="ann-item-title">{ann.title}</h4>
                          <p className="ann-item-content">{ann.content}</p>
                          <div className="ann-item-meta">
                            <span className="ann-meta-item"><FaCalendarAlt /> {new Date(ann.createdAt).toLocaleDateString('hu-HU')}</span>
                            <span className="ann-meta-item"><FaClock /> {new Date(ann.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ========== DIÁK NÉZET ========== */}
            {user?.role === 'student' && (
              <div className="ann-student-col animate-slide-in">
                <h3 className="ann-section-title">
                  <FaBullhorn className="ann-section-title-icon" />
                  Bejövő bejelentések
                </h3>

                {announcements.length === 0 ? (
                  <div className="ann-empty-hero">
                    <div className="ann-empty-hero-icon"><FaChalkboard /></div>
                    <h4 className="ann-empty-hero-title">Üres a faliújságod</h4>
                    <p className="ann-empty-hero-subtitle">Jelenleg nincs aktív bejelentés vagy házi feladat felhívás az osztályodban.</p>
                  </div>
                ) : (
                  <div className="ann-list">
                    {announcements.map(ann => {
                      const isNew = newAnnouncementIds.has(ann._id);
                      return (
                        <div
                          key={ann._id}
                          className={`ann-student-item ${isNew ? 'ann-student-item--new' : ''}`}
                        >
                          {/* Fejléc: tanár + osztály */}
                          <div className="ann-student-item-header">
                            <div className="ann-teacher-info">
                              <div className="ann-teacher-avatar">
                                {ann.teacherId?.name?.charAt(0) || 'T'}
                              </div>
                              <div>
                                <div className="ann-teacher-name">{ann.teacherId?.name || 'Tanár'}</div>
                                <div className="ann-teacher-role">osztályfőnök / tanár</div>
                              </div>
                            </div>
                            <div className="ann-right-badges">
                              {isNew && (
                                <span className="ann-new-post-badge">
                                  <FaBell /> ÚJ
                                </span>
                              )}
                              <span className="ann-class-badge-green">{ann.classId?.name || 'Osztály'}</span>
                            </div>
                          </div>

                          {/* Tartalom */}
                          <h4 className="ann-item-title">{ann.title}</h4>
                          <p className="ann-item-content">{ann.content}</p>

                          {/* Meta */}
                          <div className="ann-item-meta ann-item-meta--bordered">
                            <span className="ann-meta-item"><FaCalendarAlt /> {new Date(ann.createdAt).toLocaleDateString('hu-HU')}</span>
                            <span className="ann-meta-item"><FaClock /> {new Date(ann.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;
