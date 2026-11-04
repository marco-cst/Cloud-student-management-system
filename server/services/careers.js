const mongoose = require("mongoose");
const { Career, publicCareer } = require("../models/Career");
const Student = require("../models/Student");
const { appendAudit } = require("./audit");

// New student-assignment code must acquire this same document lock when the
// careerId/level migration is implemented, to serialize enrollment with edits.
async function changeCareer(id, changes, actor) {
  return mongoose.connection.transaction(async (session) => {
    const career = await Career.findByIdAndUpdate(id, { $inc: { lockRevision: 1 } }, {
      session, returnDocument: "after", timestamps: false,
    });
    if (!career) return { status: 404, body: { message: "Carrera no encontrada" } };
    const reducesLevels = changes.totalNiveles !== undefined && changes.totalNiveles < career.totalNiveles;
    const changesUnit = changes.unidadNivel !== undefined && changes.unidadNivel !== career.unidadNivel;
    if (reducesLevels || changesUnit) {
      // Until the migration is approved, an old course/year cannot safely be
      // attributed to a catalog record. Fail closed instead of guessing.
      const pendingMigration = await Student.collection.findOne({
        $or: [{ careerId: { $exists: false } }, { careerId: null }, { nivelAcademico: { $exists: false } }, { nivelAcademico: null }],
      }, { session, projection: { _id: 1 } });
      if (pendingMigration) return { status: 409, body: { message: "Hay estudiantes pendientes de migración; no se puede reducir la duración ni cambiar la unidad todavía" } };
      const incompatible = await Student.collection.findOne({
        careerId: career._id, ...(changesUnit ? {} : { nivelAcademico: { $gt: changes.totalNiveles } }),
      }, { session, projection: { _id: 1 } });
      if (incompatible) return { status: 409, body: { message: changesUnit
        ? "No se puede cambiar la unidad de una carrera con estudiantes asociados"
        : "La duración dejaría estudiantes fuera del rango permitido" } };
    }
    Object.assign(career, changes);
    await career.save({ session });
    await appendAudit({ user: actor, accion: "activa" in changes ? "CAREER_STATUS" : "CAREER_UPDATE", recurso: "carrera", recursoId: career._id, campos: Object.keys(changes) }, session);
    return { status: 200, body: publicCareer(career) };
  });
}

module.exports = { changeCareer };
