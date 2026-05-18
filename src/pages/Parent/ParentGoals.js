import React, { useState, useEffect, useCallback } from 'react';
import { FaBullseye, FaBook, FaStar, FaFire, FaPlus, FaTrash, FaTimes, FaExclamationCircle } from 'react-icons/fa';
import LoadingSpinner from '../../components/LoadingSpinner';
import ParentChildSelector from '../../components/ParentChildSelector';
import ConfirmModal from '../../components/ConfirmModal';
import CustomSelect from '../../components/CustomSelect';
import CustomDatePicker from '../../components/CustomDatePicker';
import '../../styles/Parent/ParentGlobal.css';
import '../../styles/Parent/ParentGoals.css';

const SUBJECTS = ['Matematika', 'Magyar', 'Angol', 'Környezetismeret'];
const SUBJECTS_WITH_ALL = [...SUBJECTS, 'Összes tantárgy'];

const TYPE_META = {
  assignment_avg: { label: 'Dolgozat Átlag', icon: '📝', cardClass: 'type-assignment' },
  practice_xp:    { label: 'XP Célpont',     icon: '⭐', cardClass: 'type-xp' },
  practice_streak:{ label: 'Sorozat',         icon: '🔥', cardClass: 'type-streak' },
};

const subjectDisplay = (s) => s === 'all' ? 'Összes tantárgy' : s;

const getDeadlineInfo = (deadline) => {
  if (!deadline) return null;
  const diffDays = Math.ceil((new Date(deadline) - Date.now()) / 864e5);
  if (diffDays < 0) return { text: 'Lejárt', cls: 'overdue' };
  if (diffDays === 0) return { text: 'Ma jár le', cls: 'near' };
  if (diffDays <= 3) return { text: `${diffDays} nap múlva jár le`, cls: 'near' };
  return {
    text: new Date(deadline).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }),
    cls: ''
  };
};

/* ── Goal Card ── */
const GoalCard = ({ goal, onDelete }) => {
  const { progress, type, subject, title, periodDays, deadline, goalId } = goal;
  const meta = TYPE_META[type];
  const fillClass = progress.pct >= 100 ? 'pct-high' : progress.pct >= 60 ? 'pct-mid' : 'pct-low';
  const deadlineInfo = deadline ? getDeadlineInfo(deadline) : null;
  const pctColor = progress.pct >= 100 ? '#10b981' : progress.pct >= 60 ? '#3b82f6' : '#f59e0b';

  return (
    <div className={`pg-goal-card ${meta.cardClass}${progress.pct >= 100 ? ' completed' : ''}`}>
      <div className="pg-goal-header">
        <span className="pg-subject-badge">{meta.icon} {subjectDisplay(subject)}</span>
        <span className="pg-goal-title">{title}</span>
        <button className="pg-goal-delete" onClick={() => onDelete(goalId)} title="Cél törlése">
          <FaTrash />
        </button>
      </div>

      <div className="pg-progress-wrap">
        <div className="pg-progress-bar-track">
          <div className={`pg-progress-bar-fill ${fillClass}`} style={{ width: `${progress.pct}%` }} />
        </div>
        <div className="pg-progress-values">
          <span className="pg-progress-current">{progress.current}{progress.unit}</span>
          <span className="pg-progress-target">/ {progress.target}{progress.unit}</span>
          <span className="pg-progress-pct" style={{ color: pctColor }}>{progress.pct}%</span>
        </div>
        {type === 'assignment_avg' && (
          <div className="pg-count-hint">
            {progress.count > 0
              ? `${progress.count} értékelt dolgozat alapján (utolsó ${periodDays} nap)`
              : `Még nincs értékelt dolgozat az utolsó ${periodDays} napban`}
          </div>
        )}
        {type === 'practice_streak' && (
          <div className="pg-count-hint">Jelenlegi napi sorozat alapján mérve</div>
        )}
      </div>

      <div className="pg-goal-footer">
        <span className="pg-type-badge">{meta.label}</span>
        {deadlineInfo && (
          <span className={`pg-deadline-badge ${deadlineInfo.cls}`}>📅 {deadlineInfo.text}</span>
        )}
        {progress.pct >= 100 && <span className="pg-completed-badge">✓ Teljesítve</span>}
      </div>
    </div>
  );
};

/* ── Add Goal Modal ── */
const EMPTY_FORM = { type: 'assignment_avg', subject: 'Matematika', targetValue: '', periodDays: 7, deadline: '', title: '' };

const AddGoalModal = ({ section, onClose, onSave }) => {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    type: section === 'practice' ? 'practice_xp' : 'assignment_avg',
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleTypeChange = (newType) => {
    set('type', newType);
    if (newType === 'practice_streak') set('subject', 'all');
    else if (form.subject === 'all' && newType !== 'practice_xp') set('subject', 'Matematika');
    set('targetValue', '');
  };

  const autoTitle = useCallback(() => {
    const sub = subjectDisplay(form.subject);
    if (form.type === 'assignment_avg')  return `${sub}: ≥${form.targetValue || '?'}% átlag (${form.periodDays} nap)`;
    if (form.type === 'practice_xp')     return `${form.targetValue || '?'} XP${form.subject !== 'all' ? ` – ${sub}` : ''}`;
    if (form.type === 'practice_streak') return `${form.targetValue || '?'} napos tanulási sorozat`;
    return '';
  }, [form]);

  const practiceTypes = [
    { value: 'practice_xp',     label: '⭐ XP Célpont' },
    { value: 'practice_streak', label: '🔥 Sorozat' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.targetValue) return;
    setSubmitting(true);
    setErr('');
    try {
      const body = {
        type: form.type,
        subject: form.type === 'practice_streak' ? 'all' : form.subject,
        title: form.title.trim() || autoTitle(),
        ...(form.deadline && { deadline: form.deadline }),
        ...(form.type === 'assignment_avg' && { targetPercent: Number(form.targetValue), periodDays: form.periodDays }),
        ...(form.type === 'practice_xp' && { targetXP: Number(form.targetValue) }),
        ...(form.type === 'practice_streak' && { targetStreak: Number(form.targetValue) }),
      };
      await onSave(body);
    } catch (e) {
      setErr(e.message || 'Hiba a mentés során.');
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const subjectOptions = (form.type === 'practice_xp' ? SUBJECTS_WITH_ALL : SUBJECTS).map(s => ({
    value: s === 'Összes tantárgy' ? 'all' : s,
    label: s
  }));

  return (
    <div className="pg-modal-overlay" onClick={onClose}>
      <div className="pg-modal" onClick={e => e.stopPropagation()}>
        <div className="pg-modal-header">
          <h3 className="pg-modal-title">
            {section === 'assignment' ? '📝 Dolgozat cél hozzáadása' : '⭐ Gyakorlási cél hozzáadása'}
          </h3>
          <button className="pg-modal-close" type="button" onClick={onClose}><FaTimes /></button>
        </div>

        {/* Type tabs – only for practice section (2 types) */}
        {section === 'practice' && (
          <div className="pg-type-tabs">
            {practiceTypes.map(t => (
              <button
                key={t.value}
                type="button"
                className={`pg-type-tab${form.type === t.value ? ' active' : ''}`}
                onClick={() => handleTypeChange(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Subject – not for streak */}
          {form.type !== 'practice_streak' && (
            <div className="pg-form-group">
              <label className="pg-form-label">Tantárgy</label>
              <CustomSelect
                value={form.subject}
                onChange={val => set('subject', val)}
                options={subjectOptions}
                placeholder="Válassz tantárgyat"
                icon={<FaBook />}
              />
            </div>
          )}

          {/* Target value */}
          <div className="pg-form-group">
            <label className="pg-form-label">
              {form.type === 'assignment_avg' ? 'Minimum átlag (%)' :
               form.type === 'practice_xp'    ? 'Elérendő XP mennyiség' :
                                                'Egymást követő tanulási napok'}
            </label>
            <input
              type="number"
              className="pg-input"
              placeholder={form.type === 'assignment_avg' ? 'pl. 80' : form.type === 'practice_xp' ? 'pl. 500' : 'pl. 7'}
              min="1"
              max={form.type === 'assignment_avg' ? 100 : undefined}
              value={form.targetValue}
              onChange={e => set('targetValue', e.target.value)}
              required
            />
            {form.type === 'practice_streak' && (
              <p className="pg-form-hint">A napi sorozat (streak) globálisan, minden tantárgy együtt méri az egymást követő aktív napokat.</p>
            )}
          </div>

          {/* Period – only for assignment_avg */}
          {form.type === 'assignment_avg' && (
            <div className="pg-form-group">
              <label className="pg-form-label">Visszatekintési időszak</label>
              <div className="pg-period-btns">
                {[7, 14, 30].map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`pg-period-btn${form.periodDays === d ? ' active' : ''}`}
                    onClick={() => set('periodDays', d)}
                  >
                    {d} nap
                  </button>
                ))}
              </div>
              <p className="pg-form-hint">Az utolsó {form.periodDays} napban értékelt dolgozatok átlagát méri.</p>
            </div>
          )}

          {/* Deadline */}
          <div className="pg-form-group">
            <label className="pg-form-label">Határidő (opcionális)</label>
            <CustomDatePicker
              value={form.deadline}
              onChange={val => set('deadline', val)}
              type="date"
              placeholder="éééé. hh. nn."
            />
          </div>

          {/* Custom title */}
          <div className="pg-form-group">
            <label className="pg-form-label">Egyéni cím (elhagyható)</label>
            <input
              type="text"
              className="pg-input"
              placeholder={autoTitle()}
              value={form.title}
              onChange={e => set('title', e.target.value)}
              maxLength={150}
            />
          </div>

          {err && <p style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: 12 }}>{err}</p>}

          <div className="pg-form-actions">
            <button type="button" className="pg-cancel-btn" onClick={onClose}>Mégse</button>
            <button type="submit" className="pg-submit-btn" disabled={submitting || !form.targetValue}>
              {submitting ? 'Mentés...' : 'Cél hozzáadása'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════ */
const ParentGoals = () => {
  const [children, setChildren] = useState([]);
  const [childrenLoaded, setChildrenLoaded] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState(() => localStorage.getItem('parent-selected-child') || '');
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalSection, setModalSection] = useState(null); // 'assignment' | 'practice' | null
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, goalId: null });

  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await fetch('/api/parent/children', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
        });
        const data = await res.json();
        if (data.children?.length > 0) {
          setChildren(data.children);
          if (!selectedChildId || !data.children.some(c => c._id === selectedChildId)) {
            const firstId = data.children[0]._id;
            setSelectedChildId(firstId);
            localStorage.setItem('parent-selected-child', firstId);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        setLoading(false);
      } finally {
        setChildrenLoaded(true);
      }
    };
    fetchChildren();
  }, []);

  const fetchGoals = useCallback(async () => {
    if (!selectedChildId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/parent/child/${selectedChildId}/goals`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals || []);
      } else {
        setError('Nem sikerült betölteni a célkitűzéseket.');
      }
    } catch (err) {
      setError('Hiba a célkitűzések lekérésekor.');
    } finally {
      setLoading(false);
    }
  }, [selectedChildId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleChildChange = (id) => {
    setSelectedChildId(id);
    localStorage.setItem('parent-selected-child', id);
  };

  const handleSaveGoal = async (body) => {
    const res = await fetch(`/api/parent/child/${selectedChildId}/goals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('AccessToken')}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.message || 'Hiba a mentés során.');
    }
    setModalSection(null);
    fetchGoals();
  };

  const handleDeleteConfirm = (goalId) => setConfirmDelete({ isOpen: true, goalId });

  const executeDelete = async () => {
    const { goalId } = confirmDelete;
    setConfirmDelete({ isOpen: false, goalId: null });
    try {
      await fetch(`/api/parent/child/${selectedChildId}/goals/${goalId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('AccessToken')}` }
      });
      fetchGoals();
    } catch (err) {
      setError('Hiba a cél törlése során.');
    }
  };

  const assignmentGoals = goals.filter(g => g.type === 'assignment_avg');
  const practiceGoals   = goals.filter(g => g.type !== 'assignment_avg');

  if (childrenLoaded && children.length === 0) {
    return (
      <div id="content">
        <div className="completed-assignments-wrapper">
          <div className="page-header-banner">
            <div className="phb-icon"><FaBullseye /></div>
            <div className="phb-text">
              <h1 className="phb-title">Célkitűzések</h1>
              <p className="phb-subtitle">Tűzz ki motivációs célokat gyermeked tanulásához.</p>
            </div>
          </div>
          <div className="pg-empty-section">
            <div className="pg-empty-icon">👨‍👩‍👧</div>
            <p>Nincs összekapcsolt gyermek. Adj hozzá egy gyermeket a Beállítások menüben.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="content">
      <div className="completed-assignments-wrapper">
        <div className="page-header-banner">
          <div className="phb-icon"><FaBullseye /></div>
          <div className="phb-text">
            <h1 className="phb-title">Célkitűzések</h1>
            <p className="phb-subtitle">Tűzz ki motivációs célokat, és kövesd nyomon gyermeked haladását élő progress barral.</p>
          </div>
          {children.length > 0 && (
            <ParentChildSelector
              childrenList={children}
              selectedId={selectedChildId}
              onChange={handleChildChange}
            />
          )}
        </div>

        {(!childrenLoaded || loading) ? (
          <div style={{ minHeight: 300 }}><LoadingSpinner /></div>
        ) : error ? (
          <div className="error-box"><FaExclamationCircle /> {error}</div>
        ) : (
          <>
            {/* ── A) Dolgozat Célok ── */}
            <div className="pg-section">
              <div className="pg-section-header">
                <h2 className="pg-section-title">
                  <FaBook style={{ color: '#3b82f6' }} />
                  Dolgozat Célok
                  <span className="pg-section-count">{assignmentGoals.length}</span>
                </h2>
                <button className="pg-add-btn" onClick={() => setModalSection('assignment')}>
                  <FaPlus /> Új cél
                </button>
              </div>

              {assignmentGoals.length === 0 ? (
                <div className="pg-empty-section">
                  <div className="pg-empty-icon">📝</div>
                  <p>Még nincs dolgozat cél beállítva.</p>
                  <p>Pl. „Matek: legalább 80% az utolsó 7 napban."</p>
                </div>
              ) : (
                <div className="pg-goals-grid">
                  {assignmentGoals.map(g => (
                    <GoalCard key={g.goalId} goal={g} onDelete={handleDeleteConfirm} />
                  ))}
                </div>
              )}
            </div>

            {/* ── B) Egyéni Gyakorlási Célok ── */}
            <div className="pg-section">
              <div className="pg-section-header">
                <h2 className="pg-section-title">
                  <FaStar style={{ color: '#f59e0b' }} />
                  Egyéni Gyakorlási Célok
                  <span className="pg-section-count">{practiceGoals.length}</span>
                </h2>
                <button className="pg-add-btn" onClick={() => setModalSection('practice')}>
                  <FaPlus /> Új cél
                </button>
              </div>

              {practiceGoals.length === 0 ? (
                <div className="pg-empty-section">
                  <div className="pg-empty-icon">⭐</div>
                  <p>Még nincs egyéni gyakorlási cél beállítva.</p>
                  <p>Pl. „Gyűjts 500 XP-t Angolból" vagy „5 napos tanulási sorozat".</p>
                </div>
              ) : (
                <div className="pg-goals-grid">
                  {practiceGoals.map(g => (
                    <GoalCard key={g.goalId} goal={g} onDelete={handleDeleteConfirm} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {modalSection && (
        <AddGoalModal
          section={modalSection}
          onClose={() => setModalSection(null)}
          onSave={handleSaveGoal}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Cél törlése"
        message="Biztosan törölni szeretnéd ezt a célkitűzést? A haladás elvész."
        confirmText="Törlés"
        cancelText="Mégse"
        type="danger"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete({ isOpen: false, goalId: null })}
      />
    </div>
  );
};

export default ParentGoals;
