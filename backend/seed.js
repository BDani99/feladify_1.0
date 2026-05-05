require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Class = require('./models/Class');

// Csatlakozás az adatbázishoz
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

async function seedDatabase() {
  try {
    // Jelszó hash-elése
    const hashedPassword = await bcrypt.hash('jelszo123', 10);

    // Tanárok hozzáadása egyenként, emailcím alapján ellenőrizve
    const teachersData = [
      { name: 'Kovács Anna', email: 'kovacs.anna@iskola.hu', password: hashedPassword, role: 'teacher', subject: 'Magyar' },
      { name: 'Nagy Péter', email: 'nagy.peter@iskola.hu', password: hashedPassword, role: 'teacher', subject: 'Matematika' },
      { name: 'Szabó Zoltán', email: 'szabo.zoltan@iskola.hu', password: hashedPassword, role: 'teacher', subject: 'Történelem' },
    ];

    const teacherIds = [];
    for (const teacherData of teachersData) {
      let teacher = await User.findOne({ email: teacherData.email });
      if (!teacher) {
        teacher = new User(teacherData);
        await teacher.save();
        console.log(`Tanárok hozzáadva: ${teacherData.email}`);
      } else {
        console.log(`Tanárok kihagyva: ${teacherData.email}`);
      }
      teacherIds.push(teacher._id); // Az azonosítókat összegyűjtjük
    }

    // Osztályok hozzáadása 1-8-ig, ha nem léteznek név alapján
    const classesData = Array.from({ length: 8 }, (_, i) => ({
      name: `${i + 1}. osztály`,
      teacherIds: teacherIds
    }));

    const classDocuments = [];
    for (const classData of classesData) {
      let schoolClass = await Class.findOne({ name: classData.name });
      if (!schoolClass) {
        schoolClass = new Class(classData);
        await schoolClass.save();
        console.log(`Osztály hozzáadva: ${classData.name}`);
      } else {
        console.log(`Osztály kihagyva: ${classData.name}`);
      }
      classDocuments.push(schoolClass);
    }

    // Diákok hozzáadása 7. és 8. osztályhoz
    const studentsData1 = [
      { name: 'Tóth János', email: 'toth.janos@iskola.hu' },
      { name: 'Kiss Éva', email: 'kiss.eva@iskola.hu' },
      { name: 'Farkas Ádám', email: 'farkas.adam@iskola.hu' },
      { name: 'Varga László', email: 'varga.laszlo@iskola.hu' },
      { name: 'Molnár István', email: 'molnar.istvan@iskola.hu' }
    ];

    const studentsData2 = [
      { name: 'Horváth Réka', email: 'horvath.reka@iskola.hu' },
      { name: 'Balogh Csaba', email: 'balogh.csaba@iskola.hu' },
      { name: 'Papp András', email: 'papp.andras@iskola.hu' },
      { name: 'Szalai Nóra', email: 'szalai.nora@iskola.hu' },
      { name: 'Takács Tamás', email: 'takacs.tamas@iskola.hu' }
    ];

    const studentIdsClass7 = [];
    for (const studentData of studentsData1) {
      let student = await User.findOne({ email: studentData.email });
      if (!student) {
        student = new User({
          ...studentData,
          password: hashedPassword,
          role: 'student',
          className: classDocuments[6].name // 7. osztály
        });
        await student.save();
        console.log(`Diák hozzáadva a 7. osztályhoz: ${studentData.email}`);
      } else {
        console.log(`Diák kihagyva: ${studentData.email}`);
      }
      studentIdsClass7.push(student._id);
    }

    const studentIdsClass8 = [];
    for (const studentData of studentsData2) {
      let student = await User.findOne({ email: studentData.email });
      if (!student) {
        student = new User({
          ...studentData,
          password: hashedPassword,
          role: 'student',
          className: classDocuments[7].name // 8. osztály
        });
        await student.save();
        console.log(`Diák hozzáadva a 8. osztályhoz: ${studentData.email}`);
      } else {
        console.log(`Diák kihagyva: ${studentData.email}`);
      }
      studentIdsClass8.push(student._id);
    }

    // 7. és 8. osztályok frissítése a diákok azonosítóival
    await Class.findByIdAndUpdate(classDocuments[6]._id, { $addToSet: { studentIds: { $each: studentIdsClass7 } } });
    await Class.findByIdAndUpdate(classDocuments[7]._id, { $addToSet: { studentIds: { $each: studentIdsClass8 } } });

    console.log('Adatok sikeresen feltöltve az adatbázisba');
  } catch (error) {
    console.error('Hiba történt az adatok feltöltése során:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDatabase();
