const { User } = require("../models/User");
const Student = require("../models/Student");
const { Career } = require("../models/Career");
const { isSupportedRole } = require("../policies/roles");

async function academicInventory() {
  const users = await User.find().select("_id nombre email rol activo").sort({ _id: 1 }).lean();
  const legacyGroups = await Student.collection.aggregate([
    { $match: { $or: [{ course: { $exists: true } }, { year: { $exists: true } }] } },
    { $group: { _id: { course: "$course", year: "$year" }, count: { $sum: 1 } } },
    { $sort: { "_id.course": 1, "_id.year": 1 } },
  ]).toArray();
  const roleCounts = Object.create(null);
  for (const user of users) roleCounts[user.rol] = (roleCounts[user.rol] || 0) + 1;
  return {
    generatedAt: new Date().toISOString(),
    counts: { users: users.length, students: await Student.countDocuments(), careers: await Career.countDocuments() },
    accountsRequiringDecision: users.filter(user => !isSupportedRole(user.rol)),
    roleCounts,
    legacyStudentGroups: legacyGroups.map(group => ({ course: group._id.course ?? null, year: group._id.year ?? null, count: group.count })),
    pendingStudentMigration: await Student.collection.countDocuments({ $or: [{ careerId: { $exists: false } }, { careerId: null }, { nivelAcademico: { $exists: false } }, { nivelAcademico: null }] }),
  };
}

module.exports = { academicInventory };
