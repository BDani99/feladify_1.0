const mongoose = require('mongoose');

// Kérdés típusok
const QUESTION_TYPES = {
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
  SHORT_ANSWER: 'short_answer',
  MATCHING: 'matching'
};

// Tantárgy kategóriák
const SUBJECT_CATEGORIES = {
  'Matematika': {
    categories: ['Algebra', 'Geometria', 'Statisztika', 'Függvények', 'Számelmélet', 'Mértékegységek'],
    difficulty: [1, 2, 3, 4, 5] // Nehézségi szintek
  },
  'Nyelvtan': {
    categories: ['Hangtan', 'Szófajok', 'Mondatelemzés', 'Helyesírás', 'Nyelvhelyesség'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Irodalom': {
    categories: ['Népköltészet', 'Műfajok', 'Verselemzés', 'Szövegértés', 'Cselekmény és Karakterek'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Angol': {
    categories: ['Grammar', 'Vocabulary', 'Reading', 'Writing', 'Listening', 'Speaking'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Környezetismeret': {
    categories: ['Földrajz', 'Biológia', 'Fizika', 'Kémia', 'Társadalomismeret', 'Környezetvédelem'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Történelem': {
    categories: ['Ókori civilizációk és kultúrák', 'A magyarság őstörténete és a honfoglalás', 'Az Árpád-házi királyok kora', 'Középkori élet, kultúra és hitvilág', 'Helytörténet és nemzeti jelképek'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Fizika': {
    categories: ['Mechanika', 'Hőtan', 'Fénytan', 'Elektromosság', 'Hangtan', 'Erők és mozgás'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Biológia': {
    categories: ['Növények', 'Állatok', 'Emberi test', 'Ökológia', 'Sejtek és szaporodás', 'Egészség és betegség'],
    difficulty: [1, 2, 3, 4, 5]
  },
  'Földrajz': {
    categories: ['Magyarország földrajza', 'Európa', 'Kontinensek és óceánok', 'Természetföldrajz', 'Gazdaságföldrajz', 'Térképészet'],
    difficulty: [1, 2, 3, 4, 5]
  }
};

// Kérdés séma
const questionSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    enum: Object.keys(SUBJECT_CATEGORIES)
  },
  category: {
    type: String,
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    required: true,
    enum: Object.values(QUESTION_TYPES)
  },
  difficulty: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  options: {
    type: [{
      label: String,
      text: String,
      isCorrect: Boolean
    }],
    validate: {
      validator: function(v) {
        // multiple_choice és matching típusoknál kötelező
        if (this.questionType === 'multiple_choice' || this.questionType === 'matching') {
          return v && v.length >= 2;
        }
        return true;
      },
      message: 'Legalább 2 opció szükséges multiple choice és matching kérdéseknél'
    }
  },
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
    // multiple_choice: 'A', 'B', 'C', 'D'
    // true_false: true/false
    // short_answer: string (kulcsszavak)
    // matching: [{left: string, right: string}]
  },
  explanation: {
    type: String,
    default: ''
  },
  points: {
    type: Number,
    default: 1,
    min: 0
  },
  tags: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexek a gyorsabb lekérdezésekhez
questionSchema.index({ subject: 1, category: 1 });
questionSchema.index({ subject: 1, difficulty: 1 });
questionSchema.index({ tags: 1 });

// Statikus módszer: Kérdések generálása egy tantárgyhoz (FIX 20 kérdés)
questionSchema.statics.generateDiagnosticTest = async function(subject, count = 20) {
  const categories = SUBJECT_CATEGORIES[subject]?.categories || [];
  
  // Minimum 2 kérdés minden kategóriából, ha lehetséges
  const minPerCategory = Math.max(2, Math.floor(count / categories.length));
  const remaining = count - (minPerCategory * categories.length);
  
  const testQuestions = [];
  const usedIds = new Set();
  
  // 1. Kör: Minden kategóriából válasszunk ki minimum kérdéseket
  for (const category of categories) {
    const categoryQuestions = await this.find({
      subject,
      category,
      difficulty: { $gte: 1, $lte: 3 }, // Kezdetben könnyebb kérdések
      _id: { $nin: Array.from(usedIds) }
    })
    .sort({ difficulty: 1 })
    .limit(minPerCategory);
    
    categoryQuestions.forEach(q => {
      testQuestions.push(q);
      usedIds.add(q._id.toString());
    });
  }
  
  // 2. Kör: Ha még kell kérdés, adjunk hozzá nehezebbeket
  if (testQuestions.length < count) {
    for (const category of categories) {
      const needed = Math.min(remaining, count - testQuestions.length);
      if (needed <= 0) break;
      
      const additionalQuestions = await this.find({
        subject,
        category,
        difficulty: { $gte: 3, $lte: 5 }, // Nehezebb kérdések
        _id: { $nin: Array.from(usedIds) }
      })
      .sort({ difficulty: 1 })
      .limit(needed);
      
      additionalQuestions.forEach(q => {
        testQuestions.push(q);
        usedIds.add(q._id.toString());
      });
    }
  }
  
  // 3. Kör: Ha még mindig nincs elég, vegyünk be bármilyen kérdést a tantárgyból
  if (testQuestions.length < count) {
    const stillNeeded = count - testQuestions.length;
    const anyQuestions = await this.find({
      subject,
      _id: { $nin: Array.from(usedIds) }
    })
    .sort({ difficulty: 1 })
    .limit(stillNeeded);
    
    anyQuestions.forEach(q => {
      testQuestions.push(q);
      usedIds.add(q._id.toString());
    });
  }
  
  // Keverjük össze a kérdéseket és vágjuk le pontosan count-ra
  const shuffled = testQuestions.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// Statikus módszer: Minta kérdések inicializálása
questionSchema.statics.initializeSampleQuestions = async function() {
  const sampleQuestions = [
    // Matematika kérdések
    {
      subject: 'Matematika',
      category: 'Algebra',
      questionText: 'Mennyi 3x + 5 = 20 egyenlet megoldása?',
      questionType: 'multiple_choice',
      difficulty: 2,
      options: [
        { label: 'A', text: 'x = 5', isCorrect: true },
        { label: 'B', text: 'x = 3', isCorrect: false },
        { label: 'C', text: 'x = 15', isCorrect: false },
        { label: 'D', text: 'x = 7', isCorrect: false }
      ],
      correctAnswer: 'A',
      explanation: '3x + 5 = 20 → 3x = 15 → x = 5',
      points: 1,
      tags: ['egyenlet', 'algebra', 'változó']
    },
    {
      subject: 'Matematika',
      category: 'Geometria',
      questionText: 'Egy háromszög belső szögeinek összege:',
      questionType: 'true_false',
      difficulty: 1,
      options: [
        { label: 'Igaz', text: '180°', isCorrect: true },
        { label: 'Hamis', text: '360°', isCorrect: false }
      ],
      correctAnswer: true,
      explanation: 'Minden háromszög belső szögeinek összege 180°.',
      points: 1,
      tags: ['háromszög', 'szögek', 'geometria']
    },
    {
      subject: 'Matematika',
      category: 'Statisztika',
      questionText: 'Mi a következő számok átlaga: 4, 8, 12, 16?',
      questionType: 'short_answer',
      difficulty: 2,
      correctAnswer: '10',
      explanation: '(4 + 8 + 12 + 16) / 4 = 40 / 4 = 10',
      points: 1,
      tags: ['átlag', 'statisztika', 'számítás']
    },
    
    // Nyelvtan kérdések
    {
      subject: 'Nyelvtan',
      category: 'Szófajok',
      questionText: 'Melyik szó FŐNÉV a következők közül?',
      questionType: 'multiple_choice',
      difficulty: 1,
      options: [
        { label: 'A', text: 'fut', isCorrect: false },
        { label: 'B', text: 'asztal', isCorrect: true },
        { label: 'C', text: 'szép', isCorrect: false },
        { label: 'D', text: 'gyorsan', isCorrect: false }
      ],
      correctAnswer: 'B',
      explanation: 'Az "asztal" egy tárgyat megnevező főnév.',
      points: 1,
      tags: ['főnév', 'szófaj', 'nyelvtan']
    },
    {
      subject: 'Nyelvtan',
      category: 'Helyesírás',
      questionText: 'Melyik a helyes írásmód?',
      questionType: 'multiple_choice',
      difficulty: 2,
      options: [
        { label: 'A', text: 'együtt-működés', isCorrect: false },
        { label: 'B', text: 'együttműködés', isCorrect: true },
        { label: 'C', text: 'együtt működés', isCorrect: false },
        { label: 'D', text: 'együtt-működés', isCorrect: false }
      ],
      correctAnswer: 'B',
      explanation: 'Az "együtt" előtaggal alkotott összetételek egybeírandók.',
      points: 1,
      tags: ['helyesírás', 'összetétel', 'egybeírás']
    },
    // Irodalom kérdések
    {
      subject: 'Irodalom',
      category: 'Műfajok',
      questionText: 'Melyik irodalmi műfajba tartozik a János vitéz?',
      questionType: 'multiple_choice',
      difficulty: 2,
      options: [
        { label: 'A', text: 'Elbeszélő költemény', isCorrect: true },
        { label: 'B', text: 'Novella', isCorrect: false },
        { label: 'C', text: 'Dráma', isCorrect: false },
        { label: 'D', text: 'Mese', isCorrect: false }
      ],
      correctAnswer: 'A',
      explanation: 'A János vitéz Petőfi Sándor elbeszélő költeménye (verses elbeszélés).',
      points: 1,
      tags: ['Petőfi', 'János vitéz', 'műfajok']
    },
    
    // Angol kérdések
    {
      subject: 'Angol',
      category: 'Grammar',
      questionText: 'Choose the correct form: "She ___ to school every day."',
      questionType: 'multiple_choice',
      difficulty: 1,
      options: [
        { label: 'A', text: 'go', isCorrect: false },
        { label: 'B', text: 'goes', isCorrect: true },
        { label: 'C', text: 'going', isCorrect: false },
        { label: 'D', text: 'went', isCorrect: false }
      ],
      correctAnswer: 'B',
      explanation: 'Third person singular (she) requires "goes" in present simple tense.',
      points: 1,
      tags: ['grammar', 'present-simple', 'third-person']
    },
    {
      subject: 'Angol',
      category: 'Vocabulary',
      questionText: 'What is the opposite of "happy"?',
      questionType: 'short_answer',
      difficulty: 1,
      correctAnswer: 'sad',
      explanation: '"Sad" is the direct opposite of "happy".',
      points: 1,
      tags: ['vocabulary', 'opposites', 'adjectives']
    },
    
    // Környezetismeret kérdések
    {
      subject: 'Környezetismeret',
      category: 'Biológia',
      questionText: 'Melyik a legnagyobb élőlény a Földön?',
      questionType: 'multiple_choice',
      difficulty: 2,
      options: [
        { label: 'A', text: 'A kék bálna', isCorrect: false },
        { label: 'B', text: 'Az óriás mamutfenyő', isCorrect: true },
        { label: 'C', text: 'Az afrikai elefánt', isCorrect: false },
        { label: 'D', text: 'A kaliforniai vörösfa', isCorrect: false }
      ],
      correctAnswer: 'B',
      explanation: 'Az óriás mamutfenyő (Sequoiadendron giganteum) a legnagyobb élőlény térfogat szerint.',
      points: 1,
      tags: ['biológia', 'növények', 'rekorok']
    },
    {
      subject: 'Környezetismeret',
      category: 'Földrajz',
      questionText: 'Magyarország fővárosa:',
      questionType: 'true_false',
      difficulty: 1,
      options: [
        { label: 'Igaz', text: 'Budapest', isCorrect: true },
        { label: 'Hamis', text: 'Debrecen', isCorrect: false }
      ],
      correctAnswer: true,
      explanation: 'Budapest Magyarország fővárosa 1873 óta.',
      points: 1,
      tags: ['földrajz', 'Magyarország', 'főváros']
    }
  ];
  
  // Ellenőrizzük, hogy vannak-e már kérdések
  const existingCount = await this.countDocuments();
  if (existingCount === 0) {
    await this.insertMany(sampleQuestions);
    console.log(`Initialised ${sampleQuestions.length} sample questions`);
  }
  
  return sampleQuestions.length;
};

module.exports = mongoose.model('DiagnosticTest', questionSchema);