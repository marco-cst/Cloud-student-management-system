const mongoose = require("mongoose");
const Student = require("../models/Student");
const { Career } = require("../models/Career");
const { appendAudit } = require("./audit");

const CAREER_FIELDS = "nombre totalNiveles unidadNivel activa";
function publicStudent(document) {
  const value = document.toObject ? document.toObject() : document;
  const career = value.careerId?.nombre ? value.careerId : null;
  return {
    _id: value._id, studentId: value.studentId, name: value.name, email: value.email, phone: value.phone,
    careerId: career ? String(career._id) : null,
    career: career ? { _id: career._id, nombre: career.nombre, totalNiveles: career.totalNiveles, unidadNivel: career.unidadNivel, activa: career.activa } : null,
    nivelAcademico: value.nivelAcademico ?? null, asignacionPendiente: !career || !value.nivelAcademico,
    createdAt: value.createdAt, updatedAt: value.updatedAt,
  };
}

async function saveStudent(input, id, actor) {
  const result = await mongoose.connection.transaction(async session => {
    const existing = id ? await Student.findById(id).session(session) : null;
    if (id && !existing) return { status: 404, body: { message: "Estudiante no encontrado" } };
    const target = String(input.careerId);
    // A deterministic lock order also protects moves between two careers.
    const ids = [...new Set([target, existing?.careerId?.toString()].filter(Boolean))].sort();
    let selectedCareer;
    for (const careerId of ids) {
      const career = await Career.findByIdAndUpdate(careerId, { $inc: { lockRevision: 1 } }, { session, returnDocument: "after", timestamps: false });
      if (careerId === target) selectedCareer = career;
    }
    if (!selectedCareer) return { status: 400, body: { message: "La carrera seleccionada no existe. Actualiza el catálogo y vuelve a elegir.", fields: ["careerId"] } };
    const sameAssignment = existing?.careerId?.toString() === target;
    if (!selectedCareer.activa && !sameAssignment) return { status: 409, body: { message: "Esta carrera está inactiva y no admite nuevas asignaciones. Elige una carrera activa." } };
    if (input.nivelAcademico > selectedCareer.totalNiveles) return { status: 400, body: { message: `El nivel debe estar entre 1 y ${selectedCareer.totalNiveles} para esta carrera.`, fields: ["nivelAcademico"] } };
    let student;
    if (existing) {
      student = await Student.findByIdAndUpdate(id, { $set: input }, { session, runValidators: true, returnDocument: "after" });
      // Also cleans a deliberately restored legacy record after an explicit,
      // validated assignment; old fields never become a second source of truth.
      await Student.collection.updateOne({ _id: student._id }, { $unset: { course: "", year: "" } }, { session });
    } else {
      [student] = await Student.create([input], { session });
    }
    await appendAudit({ user: actor, accion: existing ? "STUDENT_UPDATE" : "STUDENT_CREATE", recurso: "estudiante", recursoId: student._id, campos: Object.keys(input) }, session);
    return { status: existing ? 200 : 201, student };
  });
  if (!result.student) return result;
  await result.student.populate({ path: "careerId", select: CAREER_FIELDS });
  return { status: result.status, body: publicStudent(result.student) };
}

module.exports = { saveStudent, publicStudent, CAREER_FIELDS };
