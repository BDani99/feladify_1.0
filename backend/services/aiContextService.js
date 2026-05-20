const mongoose = require('mongoose');
const User = require('../models/User');
const Assignment = require('../models/Assignment');
const StudentProgress = require('../models/StudentProgress');
const DiagnosticResult = require('../models/DiagnosticResult');
const Class = require('../models/Class');

/**
 * Elemzi az üzenetet és visszaadja a felismert szándékokat (intents).
 * @param {string} message - A felhasználó üzenete
 * @param {string} role - 'student', 'teacher', vagy 'parent'
 * @returns {Array<string>} - A felismert szándékok listája
 */
function analyzeIntents(message, role) {
  const msg = message.toLowerCase();
  const intents = [];

  const keywords = {
    ASSIGNMENTS: ['dolg', 'dolog', 'eredm', 'pont', 'jegy', 'felad', 'teszt'],
    PROGRESS: ['halad', 'fejlőd', 'stat', 'átlag', 'erős', 'gyenge', 'tapasztalat', 'xp'],
    CLASS_STATS: ['osztály', 'stat', 'átlag', 'diák', 'tanuló'],
    EXPLANATION: ['magyaráz', 'hogy kell', 'mi az', 'hogy van']
  };

  if (role === 'student') {
    if (keywords.ASSIGNMENTS.some(k => msg.includes(k))) intents.push('STUDENT_ASSIGNMENTS');
    if (keywords.PROGRESS.some(k => msg.includes(k))) intents.push('STUDENT_PROGRESS');
    if (keywords.EXPLANATION.some(k => msg.includes(k))) intents.push('EXPLANATION');
  } else if (role === 'teacher') {
    if (keywords.ASSIGNMENTS.some(k => msg.includes(k))) intents.push('TEACHER_ASSIGNMENTS');
    if (keywords.CLASS_STATS.some(k => msg.includes(k))) intents.push('TEACHER_CLASS_STATS');
  } else if (role === 'parent') {
    if (keywords.PROGRESS.some(k => msg.includes(k))) intents.push('PARENT_CHILD_PROGRESS');
    if (keywords.ASSIGNMENTS.some(k => msg.includes(k))) intents.push('PARENT_CHILD_ASSIGNMENTS');
  }

  return intents;
}

/**
 * Felépíti a speciális kontextust a felismert szándékok alapján.
 * @param {string} role - A felhasználó szerepköre
 * @param {string} userId - A felhasználó ID-ja (szülő esetén a parent ID, diák esetén student ID)
 * @param {string} message - A kapott üzenet
 * @param {object} extraData - Egyéb azonosítók (pl. childId szülő esetén)
 * @returns {Promise<string>} - A kiegészítő prompt szöveg
 */
async function buildContextForRole(role, userId, message, extraData = {}) {
  const intents = analyzeIntents(message, role);
  if (intents.length === 0) return ''; // Ha nincs felismert szándék, nincs extra kontextus

  let specialContext = '\n\n=== DINAMIKUS KONTEXTUS A VÁLASZHOZ ===\n';

  try {
    if (role === 'student') {
      if (intents.includes('STUDENT_ASSIGNMENTS')) {
        const student = await User.findById(userId).populate('assignments.assignmentId');
        
        const assignmentsArr = student.assignments || [];
        const completed = assignmentsArr
          .filter(a => !a.isDraft && a.assignmentId)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 5);
        
        const completedInfo = completed.length > 0 
          ? completed.map(a => `"${a.assignmentId.title}": ${a.achievedPoints} pont (${a.grade ? a.grade + ' érdemjegy' : 'még nincs osztályozva'})`).join(', ')
          : 'Nincs megírt dolgozat.';

        const completedIds = assignmentsArr.map(a => a.assignmentId?._id || a.assignmentId).filter(Boolean);
        const pending = await Assignment.find({
          studentIds: userId,
          _id: { $nin: completedIds }
        }).limit(5);

        const pendingInfo = pending.length > 0
          ? pending.map(a => `"${a.title}" (Határidő: ${a.dueDate ? new Date(a.dueDate).toLocaleDateString('hu-HU') : 'nincs'})`).join(', ')
          : 'Nincs függőben lévő dolgozat.';
          
        const diagnostics = await DiagnosticResult.find({ studentId: userId, status: 'analyzed' }).sort({ completedAt: -1 }).limit(3);
        const diagInfo = diagnostics.length > 0
          ? diagnostics.map(d => `"${d.subject}" szintfelmérő: ${d.scorePercentage.toFixed(0)}%`).join(', ')
          : 'Nincs megírt szintfelmérő.';

        specialContext += `\n[Eredmények]: Megírt dolgozatok: ${completedInfo} | Függőben lévő dolgozatok: ${pendingInfo} | Szintfelmérők: ${diagInfo}`;
      }
      
      if (intents.includes('STUDENT_PROGRESS')) {
        const diagnostics = await DiagnosticResult.find({ studentId: userId, status: 'analyzed' });
        let diagStr = '';
        diagnostics.forEach(d => {
          const strengths = d.aiAnalysis?.strengths?.map(s => s.category).join(', ') || '';
          const weaknesses = d.aiAnalysis?.weaknesses?.map(w => w.category).join(', ') || '';
          diagStr += `\n- ${d.subject} szintfelmérő: ${d.scorePercentage.toFixed(0)}%`;
          if (strengths) diagStr += `, Erősségek: ${strengths}`;
          if (weaknesses) diagStr += `, Fejlesztendő: ${weaknesses}`;
        });
        specialContext += `\n[Részletes Szintfelmérő Haladás]:${diagStr ? diagStr : ' Nincs elérhető szintfelmérő adat.'}`;
      }
      
      if (intents.includes('EXPLANATION')) {
        specialContext += `\n[Tanári Utasítás]: A diák egy téma magyarázatát szeretné. Kezd egyszerűen, majd fokozatosan menj mélyebbre. Kérdéseket is tegyen fel, hogy ellenőrizze a megértést!`;
      }
    } 
    else if (role === 'teacher') {
      const teacherObjectId = new mongoose.Types.ObjectId(userId);
      
      if (intents.includes('TEACHER_CLASS_STATS')) {
        const classes = await Class.find({ teacherIds: teacherObjectId }).populate('studentIds', 'name assignments').lean();
        const classLines = classes.length > 0
          ? classes.map(c => {
              const students = (c.studentIds || []).filter(Boolean);
              const studentDetails = students.map(s => {
                const completedCount = (s.assignments || []).length;
                const totalAchieved = (s.assignments || []).reduce((sum, a) => sum + (a.achievedPoints || 0), 0);
                return `    • ${s.name}: ${completedCount} megírt dolgozat, összesen ${totalAchieved} pont`;
              });
              return `  - ${c.name} (${students.length} diák)${studentDetails.length > 0 ? ':\n' + studentDetails.join('\n') : ''}`;
            }).join('\n')
          : '  Nincs hozzárendelt osztály.';
        specialContext += `\n[Osztály Statisztikák]:\n${classLines}`;
      }

      if (intents.includes('TEACHER_ASSIGNMENTS')) {
        const assignments = await Assignment.find({ teacherId: teacherObjectId }).lean().limit(10);
        const assignmentLines = assignments.length > 0
          ? assignments.map(a => {
              const studentCount = (a.studentIds || []).length;
              return `  - "${a.title}" | tantárgy: ${a.subject} | nehézség: ${a.difficulty} | teljesítette: ${a.completedCount || 0}/${studentCount} diák | max pont: ${a.totalPoints}`;
            }).join('\n')
          : '  Még nem hozott létre dolgozatot.';
        specialContext += `\n[Létrehozott Dolgozatok]:\n${assignmentLines}`;
      }
    }
    else if (role === 'parent' && extraData.childId) {
      if (intents.includes('PARENT_CHILD_PROGRESS')) {
        const [progress, diagnostics] = await Promise.all([
          StudentProgress.findOne({ studentId: extraData.childId }),
          DiagnosticResult.find({ studentId: extraData.childId, status: 'analyzed' })
        ]);

        const subjectProgress = progress?.subjectProgress || [];
        let progressStr = '';
        subjectProgress.forEach(sp => {
          const completed = (sp.checkpoints || []).filter(c => c.status === 'completed').length;
          const total = (sp.checkpoints || []).length;
          const avgScore = completed > 0
            ? Math.round((sp.checkpoints || []).filter(c => c.status === 'completed').reduce((s, c) => s + (c.score || 0), 0) / completed)
            : 0;
          if (total > 0) {
            progressStr += `\n- ${sp.subject}: ${completed}/${total} fejezet teljesítve, átlag ${avgScore}%, szint ${sp.currentLevel || 1}, ${sp.subjectXP || 0} XP`;
          }
        });

        let diagStr = '';
        diagnostics.forEach(d => {
          const strengths = d.aiAnalysis?.strengths?.map(s => s.category).join(', ') || '';
          const weaknesses = d.aiAnalysis?.weaknesses?.map(w => w.category).join(', ') || '';
          diagStr += `\n- ${d.subject} szintfelmérő: ${d.scorePercentage.toFixed(0)}%`;
          if (strengths) diagStr += `, erősségek: ${strengths}`;
          if (weaknesses) diagStr += `, fejlesztendő: ${weaknesses}`;
        });

        specialContext += `\n[Gyermek Haladása]:${progressStr ? progressStr : ' Még nincs adat.'}`;
        specialContext += `\n[Szintfelmérő Eredmények]:${diagStr ? diagStr : ' Még nincs adat.'}`;
      }

      if (intents.includes('PARENT_CHILD_ASSIGNMENTS')) {
        const childWithAssignments = await User.findById(extraData.childId).populate('assignments.assignmentId');
        const assignmentsArr = childWithAssignments?.assignments || [];
        
        const completed = assignmentsArr
          .filter(a => !a.isDraft && a.assignmentId)
          .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
          .slice(0, 5);
        
        const completedInfo = completed.length > 0 
          ? completed.map(a => `"${a.assignmentId.title}": ${a.achievedPoints} pont (${a.grade ? a.grade + ' érdemjegy' : 'még nincs osztályozva'})`).join(', ')
          : 'Nincs megírt dolgozata a gyermeknek.';
        
        specialContext += `\n[Gyermek Dolgozatai]: ${completedInfo}`;
      }
    }

  } catch (error) {
    console.error(`[aiContextService] Hiba a kontextus építésekor (${role}):`, error);
  }

  return specialContext;
}

module.exports = { buildContextForRole };
