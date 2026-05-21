const mongoose = require('mongoose');

// Válasz séma
const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticTest',
    required: true
  },
  studentAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
    // multiple_choice: 'A', 'B', 'C', 'D'
    // true_false: true/false
    // short_answer: string
    // matching: [{left: string, right: string}]
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  points: {
    type: Number,
    default: 0
  },
  timeSpent: {
    type: Number,
    default: 0 // másodpercben
  }
});

// Kategória elemzés séma
const categoryAnalysisSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  score: {
    type: Number,
    required: true // százalékban (0-100)
  },
  difficulty: {
    easy: { total: Number, correct: Number },
    medium: { total: Number, correct: Number },
    hard: { total: Number, correct: Number }
  },
  weaknesses: [{
    type: String
  }],
  strengths: [{
    type: String
  }]
});

// Diagnosztikai eredmény séma
const diagnosticResultSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    enum: ['Matematika', 'Nyelvtan', 'Irodalom', 'Angol', 'Német', 'Környezetismeret', 'Történelem', 'Fizika', 'Biológia', 'Földrajz']
  },
  testId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DiagnosticTest'
  },
  answers: [answerSchema],

  // Eredmények
  totalQuestions: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  totalPoints: {
    type: Number,
    default: 0
  },
  maxPoints: {
    type: Number,
    default: 0
  },
  scorePercentage: {
    type: Number,
    default: 0
  },
  
  // Részletes elemzés kategóriák szerint
  categoryAnalysis: [categoryAnalysisSchema],
  
  // AI elemzés eredménye
  aiAnalysis: {
    overallPerformance: {
      type: String,
      enum: ['excellent', 'good', 'average', 'needs_improvement']
    },
    strengths: [{
      category: String,
      description: String,
      confidence: Number // 0-1
    }],
    weaknesses: [{
      category: String,
      description: String,
      priority: Number, // 1-5 (1 = legfontosabb)
      recommendedPractice: Number // ajánlott gyakorló órák száma
    }],
    learningPath: {
      recommendedOrder: [String], // kategóriák sorrendje
      estimatedTime: Number, // órában
      focusAreas: [String]
    },
    personalizedFeedback: {
      type: String
    }
  },
  
  // Metaadatok
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  timeSpent: {
    type: Number,
    default: 0 // teljes idő másodpercben
  },
  
  // Állapot
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'analyzed'],
    default: 'in_progress'
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexek
diagnosticResultSchema.index({ studentId: 1, subject: 1 });
diagnosticResultSchema.index({ studentId: 1, status: 1 });
diagnosticResultSchema.index({ completedAt: 1 });

// Pre-save middleware
diagnosticResultSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Számold ki a helyes válaszok számát és a pontokat
  if (this.answers.length > 0) {
    this.correctAnswers = this.answers.filter(a => a.isCorrect).length;
    this.totalPoints = this.answers.reduce((sum, a) => sum + (a.points || 0), 0);
  }
  
  next();
});

// Metódus: Válasz hozzáadása
diagnosticResultSchema.methods.addAnswer = function(questionId, studentAnswer, isCorrect, points, timeSpent) {
  this.answers.push({
    questionId,
    studentAnswer,
    isCorrect,
    points,
    timeSpent
  });
  
  // Frissítsd a teljes időt
  this.timeSpent = this.answers.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
  
  return this.answers.length;
};

// Metódus: Teszt befejezése
diagnosticResultSchema.methods.completeTest = function() {
  this.completedAt = new Date();
  this.status = 'completed';
  
  // Számold ki a százalékos eredményt
  const maxPoints = this.answers.reduce((sum, a) => {
    return sum + (a.points || 1); // Alapértelmezett 1 pont kérdésenként
  }, 0);
  
  this.maxPoints = maxPoints;
  this.scorePercentage = maxPoints > 0 ? (this.totalPoints / maxPoints) * 100 : 0;
  
  return this;
};

// Statikus metódus: Diagnosztikai teszt indítása
diagnosticResultSchema.statics.startDiagnosticTest = async function(studentId, subject, testId) {
  const result = new this({
    studentId,
    subject,
    testId,
    status: 'in_progress',
    answers: []
  });
  
  await result.save();
  return result;
};

// Statikus metódus: Elemzés létrehozása (AI helyett egyszerűsített verzió)
diagnosticResultSchema.statics.analyzeResults = async function(resultId) {
  const result = await this.findById(resultId)
    .populate('answers.questionId')
    .populate('testId');
  
  if (!result) {
    throw new Error('Eredmény nem található');
  }
  
  // Csoportosítsd a válaszokat kategóriák szerint
  const categoryResults = {};
  
  result.answers.forEach(answer => {
    const question = answer.questionId;
    if (!question) return;
    
    const category = question.category;
    if (!categoryResults[category]) {
      categoryResults[category] = {
        category,
        totalQuestions: 0,
        correctAnswers: 0,
        score: 0,
        difficulty: {
          easy: { total: 0, correct: 0 },
          medium: { total: 0, correct: 0 },
          hard: { total: 0, correct: 0 }
        },
        weaknesses: [],
        strengths: []
      };
    }
    
    categoryResults[category].totalQuestions++;
    if (answer.isCorrect) {
      categoryResults[category].correctAnswers++;
      
      // Nehézség szerinti statisztika
      const difficulty = question.difficulty;
      if (difficulty <= 2) {
        categoryResults[category].difficulty.easy.total++;
        categoryResults[category].difficulty.easy.correct++;
      } else if (difficulty <= 4) {
        categoryResults[category].difficulty.medium.total++;
        categoryResults[category].difficulty.medium.correct++;
      } else {
        categoryResults[category].difficulty.hard.total++;
        categoryResults[category].difficulty.hard.correct++;
      }
    }
  });
  
  // Számold ki a százalékos eredményeket kategóriánként
  Object.values(categoryResults).forEach(cat => {
    cat.score = cat.totalQuestions > 0 
      ? (cat.correctAnswers / cat.totalQuestions) * 100 
      : 0;
    
    // Határozd meg az erősségeket és gyengeségeket
    if (cat.score >= 80) {
      cat.strengths.push('Kiváló teljesítmény');
    } else if (cat.score >= 60) {
      cat.strengths.push('Jó alapok');
    } else if (cat.score >= 40) {
      cat.weaknesses.push('Fejlesztésre szorul');
    } else {
      cat.weaknesses.push('Alapos gyakorlás szükséges');
    }
  });
  
  // Hozd létre a kategória elemzést
  result.categoryAnalysis = Object.values(categoryResults);
  
  // Határozd meg az általános teljesítményt
  const overallScore = result.scorePercentage;
  let overallPerformance;
  if (overallScore >= 90) {
    overallPerformance = 'excellent';
  } else if (overallScore >= 70) {
    overallPerformance = 'good';
  } else if (overallScore >= 50) {
    overallPerformance = 'average';
  } else {
    overallPerformance = 'needs_improvement';
  }
  
  // Azonosítsd a legfontosabb fejlesztendő területeket
  const weaknesses = result.categoryAnalysis
    .filter(cat => cat.weaknesses.length > 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(cat => ({
      category: cat.category,
      description: `${cat.category}: ${cat.score.toFixed(0)}% teljesítmény - ${cat.weaknesses[0]}`,
      priority: cat.score < 40 ? 1 : cat.score < 60 ? 2 : 3,
      recommendedPractice: cat.score < 40 ? 10 : cat.score < 60 ? 6 : 3
    }));
  
  // Ajánlott tanulási útvonal
  const recommendedOrder = result.categoryAnalysis
    .sort((a, b) => a.score - b.score)
    .map(cat => cat.category);
  
  // AI elemzés mentése
  result.aiAnalysis = {
    overallPerformance,
    strengths: result.categoryAnalysis
      .filter(cat => cat.strengths.length > 0)
      .map(cat => ({
        category: cat.category,
        description: `${cat.category}: ${cat.score.toFixed(0)}% teljesítmény - ${cat.strengths[0]}`,
        confidence: cat.score / 100
      })),
    weaknesses,
    learningPath: {
      recommendedOrder,
      estimatedTime: weaknesses.reduce((sum, w) => sum + w.recommendedPractice, 0),
      focusAreas: weaknesses.map(w => w.category)
    },
    personalizedFeedback: generatePersonalizedFeedback(overallPerformance, overallScore, weaknesses)
  };
  
  result.status = 'analyzed';
  await result.save();
  
  return result;
};

// Segédfüggvény: Személyre szabott visszajelzés generálása
function generatePersonalizedFeedback(performance, score, weaknesses) {
  const feedbackTemplates = {
    excellent: `Gratulálok! Kiváló teljesítményt nyújtottál (${score.toFixed(0)}%). Alig van olyan terület, ahol ne lennél erős. Folytasd így!`,
    good: `Ügyes vagy! Jó teljesítményt értél el (${score.toFixed(0)}%). ${weaknesses.length > 0 ? 'Néhány területen még van fejlődési lehetőség: ' + weaknesses.map(w => w.category).join(', ') + '.' : 'Minden területen stabil a tudásod.'}`,
    average: `Közepes teljesítményt értél el (${score.toFixed(0)}%). ${weaknesses.length > 0 ? 'A következő területeken érdemes többet gyakorolni: ' + weaknesses.map(w => w.category).join(', ') + '.' : 'Általánosságban rendben van a tudásod, de van hová fejlődni.'}`,
    needs_improvement: `A teljesítményed (${score.toFixed(0)}%) azt mutatja, hogy alaposabb gyakorlásra van szükség. ${weaknesses.length > 0 ? 'Kezdd a következő alapokkal: ' + weaknesses.map(w => w.category).join(', ') + '. Ne add fel, minden nap fejlődhetsz!' : 'Kezdd az alapoktól, és haladj lépésről lépésre.'}`
  };
  
  return feedbackTemplates[performance] || feedbackTemplates.average;
}

module.exports = mongoose.model('DiagnosticResult', diagnosticResultSchema);