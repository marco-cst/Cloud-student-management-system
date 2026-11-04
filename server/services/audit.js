const { AuditEvent } = require("../models/AuditEvent");

const SAFE_FIELDS = new Set(["studentId", "name", "email", "phone", "careerId", "nivelAcademico", "nombre", "rol", "activo", "codigo", "totalNiveles", "unidadNivel", "activa"]);
function auditActor(user) {
  return user ? { actorId: user._id, actorNombre: user.nombre, actorRol: user.rol, actorTipo: "usuario" }
    : { actorNombre: "No autenticado", actorTipo: "anonimo" };
}
async function appendAudit({ user, actor, accion, recurso, recursoId, resultado = "exito", campos = [], cantidad }, session) {
  try {
    const [event] = await AuditEvent.create([{
      ...auditActor(user), ...(actor || {}), accion, recurso, recursoId: recursoId ? String(recursoId) : undefined,
      resultado, campos: campos.filter(field => SAFE_FIELDS.has(field)), cantidad, fecha: new Date(),
    }], { session });
    return event;
  } catch {
    const error = new Error("Audit unavailable");
    error.code = "AUDIT_UNAVAILABLE";
    throw error;
  }
}
async function deniedAudit(req) {
  const resource = { students: "estudiante", users: "usuario", careers: "carrera", "audit-events": "auditoria" }[req.originalUrl.split("/")[2]?.split("?")[0]] || "sesion";
  await appendAudit({ user: req.user, accion: "ACCESS_DENIED", recurso: resource, resultado: "denegado" });
}
module.exports = { appendAudit, deniedAudit };
