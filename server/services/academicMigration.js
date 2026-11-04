const mongoose = require("mongoose");
const Student = require("../models/Student");
const { Career } = require("../models/Career");
const { appendAudit } = require("./audit");
const { digest } = require("./developmentBackup");

const AcademicMigration = mongoose.model("AcademicMigration", new mongoose.Schema({
  _id: String, approvedRemovalIds: [String], deleted: Number, shadowsRemoved: Number, appliedAt: Date,
}));
const MIGRATION_ID = "career-reference-v1";
const hasLegacy = value => Object.hasOwn(value, "course") || Object.hasOwn(value, "year");

async function migrateAcademicData(archive, approvedRemovalIds) {
  const approved = [...new Set(approvedRemovalIds.map(String))].sort();
  if (approved.some(id => !mongoose.isObjectIdOrHexString(id))) throw new Error("Invalid approved student ID");
  const saved = archive.collections.find(item => item.name === Student.collection.name) || { documents: [], checksum: digest([]) };
  if (digest(saved.documents) !== saved.checksum) throw new Error("Invalid student snapshot");
  return mongoose.connection.transaction(async session => {
    const students = await Student.collection.find({}, { session }).sort({ _id: 1 }).toArray();
    const careers = new Map((await Career.collection.find({}, { session }).toArray()).map(career => [String(career._id), career]));
    const legacy = [], shadows = [];
    for (const student of students) {
      const career = careers.get(String(student.careerId));
      const valid = career && Number.isInteger(student.nivelAcademico) && student.nivelAcademico >= 1 && student.nivelAcademico <= career.totalNiveles;
      if (!valid) {
        if (!hasLegacy(student) || student.careerId) throw new Error("Unresolved reference requires individual review");
        legacy.push(student);
      } else if (hasLegacy(student)) shadows.push(student);
    }
    const prior = await AcademicMigration.findById(MIGRATION_ID).session(session);
    if (prior && !legacy.length && !shadows.length) {
      if (JSON.stringify([...prior.approvedRemovalIds].sort()) !== JSON.stringify(approved)) throw new Error("Different approval requires review");
      return { alreadyApplied: true, deleted: 0, shadowsRemoved: 0, remaining: students.length };
    }
    if (digest(students) !== saved.checksum) throw new Error("Students changed since backup; make a new verified snapshot");
    if (JSON.stringify(legacy.map(item => String(item._id)).sort()) !== JSON.stringify(approved)) throw new Error("Approved IDs must match the reviewed legacy students exactly");
    const actor = { actorNombre: "Migración académica local autorizada", actorTipo: "mantenimiento" };
    for (const student of legacy) {
      const removed = await Student.collection.deleteOne({ _id: student._id }, { session });
      if (removed.deletedCount !== 1) throw new Error("Legacy student changed during migration");
      await appendAudit({ actor, accion: "STUDENT_DELETE", recurso: "estudiante", recursoId: student._id }, session);
    }
    for (const student of shadows) await Student.collection.updateOne({ _id: student._id }, { $unset: { course: "", year: "" } }, { session });
    await AcademicMigration.updateOne({ _id: MIGRATION_ID }, { $set: {
      approvedRemovalIds: approved, deleted: legacy.length, shadowsRemoved: shadows.length, appliedAt: new Date(),
    } }, { upsert: true, session });
    await appendAudit({ actor, accion: "ACADEMIC_MIGRATION", recurso: "estudiante", cantidad: legacy.length + shadows.length }, session);
    return { alreadyApplied: false, deleted: legacy.length, shadowsRemoved: shadows.length, remaining: students.length - legacy.length };
  });
}

module.exports = { migrateAcademicData, AcademicMigration };
