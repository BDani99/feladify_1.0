// Központi segédfüggvények object-level jogosultság-ellenőrzéshez (IDOR
// elleni védelem). Mivel MongoDB-ben nincs RLS-szerű adatbázis-szintű
// hozzáférés-vezérlés, MINDEN ilyen ellenőrzésnek itt, route-szinten kell
// megtörténnie — korábban több végpontról is hiányzott (lásd git history:
// "close IDOR gaps"), mert minden route saját maga írta újra ugyanazt a
// mintát. Új route írásakor ezt a két függvényt kell használni ahelyett,
// hogy a mintát kézzel írnánk le újra.

// Igaz, ha `doc` létezik és `doc[ownerField]` (egyetlen ObjectId) megegyezik
// `userId`-val. Használat: közvetlen tulajdonos-mező esetén
// (pl. Assignment.teacherId, TeacherCurriculum.teacherId).
async function assertOwned(Model, id, ownerField, userId, projection = null) {
  if (!id || !userId) return null;
  return Model.findOne({ _id: id, [ownerField]: userId }, projection);
}

// Igaz, ha `doc` létezik és `doc[arrayField]` (ObjectId tömb) tartalmazza
// `userId`-t. Használat: több-tulajdonosú/tagsági kapcsolat esetén
// (pl. Class.teacherIds, Class.studentIds, User.children).
function assertMemberOf(doc, arrayField, userId) {
  if (!doc || !userId) return false;
  return (doc[arrayField] || []).some(memberId => String(memberId) === String(userId));
}

module.exports = { assertOwned, assertMemberOf };
