const mongoose = require("mongoose");

const ACTION_LABELS = Object.freeze({
  LOGIN_SUCCESS: "Inicio de sesión", LOGIN_FAILURE: "Intento de acceso rechazado", LOGOUT: "Cierre de sesión",
  STUDENT_CREATE: "Estudiante registrado", STUDENT_UPDATE: "Estudiante actualizado", STUDENT_DELETE: "Estudiante eliminado",
  USER_CREATE: "Cuenta creada", USER_UPDATE: "Cuenta actualizada", CAREER_CREATE: "Carrera creada",
  CAREER_UPDATE: "Carrera actualizada", CAREER_STATUS: "Estado de carrera cambiado", ACCESS_DENIED: "Operación sin permisos",
  USER_CLEANUP: "Limpieza autorizada de cuentas",
  PASSWORD_RESET: "Clave temporal emitida", PASSWORD_CHANGE: "Contraseña actualizada",
  ACADEMIC_MIGRATION: "Transición al catálogo académico",
});

const auditSchema = new mongoose.Schema({
  accion: { type: String, enum: Object.keys(ACTION_LABELS), required: true, immutable: true },
  recurso: { type: String, enum: ["sesion", "estudiante", "usuario", "carrera", "auditoria"], required: true, immutable: true },
  recursoId: { type: String, maxlength: 100, immutable: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, immutable: true },
  actorNombre: { type: String, required: true, maxlength: 120, immutable: true },
  actorRol: { type: String, maxlength: 30, immutable: true },
  actorTipo: { type: String, enum: ["usuario", "anonimo", "mantenimiento"], required: true, immutable: true },
  resultado: { type: String, enum: ["exito", "denegado"], required: true, immutable: true },
  campos: { type: [String], default: [], immutable: true },
  cantidad: { type: Number, min: 0, immutable: true },
  fecha: { type: Date, default: Date.now, required: true, immutable: true },
}, { versionKey: false });
auditSchema.index({ fecha: -1, _id: -1 });
auditSchema.index({ actorId: 1, fecha: -1 });
auditSchema.index({ accion: 1, fecha: -1 });
auditSchema.pre(["updateOne", "updateMany", "findOneAndUpdate", "deleteOne", "deleteMany", "findOneAndDelete", "replaceOne"], function () {
  throw new Error("Audit events are append-only");
});
auditSchema.pre("save", function () { if (!this.isNew) throw new Error("Audit events are append-only"); });

module.exports = { AuditEvent: mongoose.model("AuditEvent", auditSchema), ACTION_LABELS };
