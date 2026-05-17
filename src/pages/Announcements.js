import React, { useState, useEffect } from 'react';
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
  FaClock 
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/Documents.css'; // Leverage shared glassmorphism transitions and layout helpers

const Announcements = () => {
  const { user } = useUser() || {};
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]); // Selected target classes for posting
  const [teacherClassesData, setTeacherClassesData] = useState([]); // Class rosters with student lists
  
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  
  // Post state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  
  // Selected class for Roster View (Teacher only)
  const [selectedRosterClassId, setSelectedRosterClassId] = useState('');
  
  // Newly joined students (to show pulsing green border/badge)
  const [newlyJoinedIds, setNewlyJoinedIds] = useState(new Set());

  // 1. Initial Load of Announcements & Classes
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('AccessToken');
      
      // Fetch announcements (and targeted classes)
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

      // If teacher, fetch their full class student rosters
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
  };

  useEffect(() => {
    if (user?.role) {
      fetchData();
    }
  }, [user]);

  // 2. Real-Time SSE Student Join Listener
  useEffect(() => {
    if (user?.role !== 'teacher') return;

    const token = localStorage.getItem('AccessToken');
    if (!token) return;

    // Connect to native SSE stream passing JWT in query string
    const sseUrl = `${API_BASE_URL}/realtime/stream?token=${token}`;
    const eventSource = new EventSource(sseUrl);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.event === 'student_joined') {
          const { classId, className, student } = parsed.data;
          
          // Check if this class belongs to the teacher
          setTeacherClassesData(prevClasses => {
            const classExists = prevClasses.some(c => String(c._id) === String(classId));
            if (!classExists) return prevClasses;

            // Update class list by appending student if not already present
            return prevClasses.map(c => {
              if (String(c._id) !== String(classId)) return c;
              
              const studentExists = c.studentIds.some(s => String(s._id) === String(student._id));
              if (studentExists) return c;
              
              toast.info(`Új diák regisztrált a(z) ${className} osztályodba: ${student.name}!`);
              
              // Register new student for temporary highlight
              setNewlyJoinedIds(prevSet => {
                const updated = new Set(prevSet);
                updated.add(student._id);
                return updated;
              });

              // Automatically clear highlight after 12 seconds
              setTimeout(() => {
                setNewlyJoinedIds(prevSet => {
                  const updated = new Set(prevSet);
                  updated.delete(student._id);
                  return updated;
                });
              }, 12000);

              return {
                ...c,
                studentIds: [...c.studentIds, student]
              };
            });
          });
        }
      } catch (err) {
        console.error('[SSE Roster Parser Error]', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('[SSE Connection closed or re-connecting...]');
    };

    return () => {
      eventSource.close();
    };
  }, [user]);

  // 3. Post New Announcement (Teacher only)
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          classId: selectedClassId
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Sikertelen közzététel.');
      }

      const data = await response.json();
      setAnnouncements(prev => [data.announcement, ...prev]);
      
      // Clear inputs
      setTitle('');
      setContent('');
      
      toast.success('Közlemény sikeresen közzétéve az osztálynak!');
    } catch (err) {
      toast.error(err.message || 'Hiba a közzététel során.');
    } finally {
      setPosting(false);
    }
  };

  // 4. Delete Announcement (Teacher only)
  const handleDeleteAnnouncement = async (id) => {
    if (!window.confirm('Biztosan törölni szeretnéd ezt a közleményt?')) return;

    try {
      const token = localStorage.getItem('AccessToken');
      const response = await fetch(`${API_BASE_URL}/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Nem sikerült törölni a közleményt.');
      }

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
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div className="page-header-banner animate-slide-down">
        <div className="phb-icon">
          <FaChalkboard />
        </div>
        <div className="phb-text">
          <h1 className="phb-title">
            Osztálytermi Faliújság
          </h1>
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
        <div style={{
          display: 'grid',
          gridTemplateColumns: user?.role === 'teacher' ? '1fr 1fr' : '1fr',
          gap: '28px',
          alignItems: 'start'
        }}>
          
          {/* ==================== TEACHER VIEW ==================== */}
          {user?.role === 'teacher' && (
            <>
              {/* Bal oszlop: Form & Névsor */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-slide-in">
                
                {/* Új bejegyzés létrehozása kártya */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
                }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', color: 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FaPlus style={{ color: 'var(--color-primary)' }} /> Új üzenet közzététele
                  </h3>

                  <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '600' }}>Célosztály</label>
                      <select 
                        value={selectedClassId} 
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: 'white',
                          outline: 'none',
                          fontSize: '0.9rem'
                        }}
                      >
                        {classes.map(c => (
                          <option key={c._id} value={c._id} style={{ background: '#111', color: 'white' }}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '600' }}>Bejegyzés címe</label>
                      <input 
                        type="text" 
                        placeholder="Pl. Házi feladat határidő módosulás" 
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={100}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: 'white',
                          outline: 'none',
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '600' }}>Üzenet szövege</label>
                      <textarea 
                        rows={4}
                        placeholder="Írd ide a részleteket..." 
                        value={content} 
                        onChange={(e) => setContent(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(0, 0, 0, 0.3)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          color: 'white',
                          outline: 'none',
                          fontSize: '0.9rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={posting}
                      style={{
                        padding: '12px',
                        background: 'linear-gradient(135deg, var(--color-primary), #2563eb)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {posting ? <FaSpinner className="spin" /> : <FaPlus />} Bejegyzés közzététele
                    </button>
                  </form>
                </div>

                {/* Valós idejű Osztálytermi Roster / Névsor kártya */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <FaUserGraduate style={{ color: '#10b981' }} /> Virtuális Névsor
                    </h3>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '6px', fontWeight: '600' }}>Válassz osztályt</label>
                    <select 
                      value={selectedRosterClassId} 
                      onChange={(e) => setSelectedRosterClassId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '6px',
                        color: 'white',
                        outline: 'none',
                        fontSize: '0.85rem'
                      }}
                    >
                      {teacherClassesData.map(c => (
                        <option key={c._id} value={c._id} style={{ background: '#111', color: 'white' }}>{c.name} ({c.studentIds?.length || 0} fő)</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ 
                    maxHeight: '260px', 
                    overflowY: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '10px',
                    paddingRight: '6px' 
                  }}>
                    {getActiveRoster().length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                        Nincsenek diákok ebben az osztályban.
                      </div>
                    ) : (
                      getActiveRoster().map(student => {
                        const isNew = newlyJoinedIds.has(student._id);
                        return (
                          <div 
                            key={student._id} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              background: isNew ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                              borderRadius: '8px',
                              border: isNew ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                              transition: 'all 0.4s ease',
                              animation: isNew ? 'pulse-border 2s infinite' : 'none'
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.9rem', color: isNew ? '#a7f3d0' : 'white' }}>{student.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{student.email}</div>
                            </div>
                            
                            {isNew && (
                              <span style={{
                                background: '#10b981',
                                color: 'white',
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: '700',
                                animation: 'bounce-animation 1s infinite'
                              }}>ÚJONC!</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Jobb oszlop: Eddigi bejegyzések listája */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-slide-in">
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FaBullhorn style={{ color: 'var(--color-primary)' }} /> Eddigi bejelentéseid
                </h3>

                {announcements.length === 0 ? (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '40px',
                    textAlign: 'center',
                    color: 'var(--color-text-secondary)'
                  }}>
                    Még nem tettél ki közleményt.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {announcements.map(ann => (
                      <div 
                        key={ann._id} 
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '20px',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            fontSize: '0.75rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: '600'
                          }}>
                            {ann.classId?.name || 'Ismeretlen osztály'}
                          </span>
                          
                          <button 
                            onClick={() => handleDeleteAnnouncement(ann._id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              borderRadius: '4px',
                              transition: 'all 0.2s'
                            }}
                            title="Közlemény törlése"
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <FaTrashAlt />
                          </button>
                        </div>

                        <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'white', marginBottom: '8px' }}>{ann.title}</h4>
                        <p style={{ 
                          fontSize: '0.9rem', 
                          color: 'var(--color-text-secondary)', 
                          lineHeight: '1.5',
                          whiteSpace: 'pre-wrap',
                          margin: '0 0 12px 0' 
                        }}>{ann.content}</p>

                        <div style={{ display: 'flex', gap: '12px', color: 'var(--color-text-muted)', fontSize: '0.75rem', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FaCalendarAlt /> {new Date(ann.createdAt).toLocaleDateString('hu-HU')}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FaClock /> {new Date(ann.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ==================== STUDENT VIEW ==================== */}
          {user?.role === 'student' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-slide-in">
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'white', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FaBullhorn style={{ color: 'var(--color-primary)' }} /> Bejövő bejelentések
              </h3>

              {announcements.length === 0 ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(16px)',
                  border: '1px dashed rgba(255, 255, 255, 0.12)',
                  borderRadius: '16px',
                  padding: '50px 24px',
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '16px', opacity: 0.4 }}><FaChalkboard /></div>
                  <h4 style={{ color: 'white', fontWeight: '600', marginBottom: '6px' }}>Üres a faliújságod</h4>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>Jelenleg nincs aktív bejelentés vagy házi feladat felhívás az osztályodban.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  {announcements.map(ann => (
                    <div 
                      key={ann._id} 
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '24px',
                        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
                        transition: 'transform 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            background: 'var(--color-primary)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            color: 'white'
                          }}>
                            {ann.teacherId?.name?.charAt(0) || 'T'}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: 'white' }}>{ann.teacherId?.name || 'Tanár'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>osztályfőnök / tanár</div>
                          </div>
                        </div>

                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          fontSize: '0.75rem',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontWeight: '600'
                        }}>
                          {ann.classId?.name || 'Osztály'}
                        </span>
                      </div>

                      <h4 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'white', marginBottom: '10px' }}>{ann.title}</h4>
                      <p style={{ 
                        fontSize: '0.92rem', 
                        color: 'var(--color-text-secondary)', 
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        margin: '0 0 16px 0' 
                      }}>{ann.content}</p>

                      <div style={{ 
                        display: 'flex', 
                        gap: '16px', 
                        color: 'var(--color-text-muted)', 
                        fontSize: '0.75rem', 
                        alignItems: 'center',
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingTop: '12px'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FaCalendarAlt /> {new Date(ann.createdAt).toLocaleDateString('hu-HU')}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><FaClock /> {new Date(ann.createdAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
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
