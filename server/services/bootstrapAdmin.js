const argon2 = require("argon2");
const { User } = require("../models/User");
const { withAdminLock } = require("./adminLock");
const { AuditEvent } = require("../models/AuditEvent");
const { appendAudit } = require("./audit");

async function bootstrapAdmin(input) {
  await AuditEvent.init();
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  return withAdminLock(async (session) => {
    if (await User.exists({ rol: "administrador", activo: true }).session(session)) return false;
    const result = await User.updateOne({ email: input.email }, { $setOnInsert: {
      nombre: input.nombre, email: input.email, passwordHash, rol: "administrador", activo: true,
    } }, { upsert: true, session, runValidators: true });
    if (result.upsertedCount) await appendAudit({ actor: { actorNombre: "Inicialización local del administrador", actorTipo: "mantenimiento" }, accion: "USER_CREATE", recurso: "usuario", recursoId: result.upsertedId, campos: ["nombre", "email", "rol"] }, session);
    return Boolean(result.upsertedCount);
  });
}

module.exports = { bootstrapAdmin };
