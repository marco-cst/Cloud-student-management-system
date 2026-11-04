const { User } = require("../models/User");
const { withAdminLock } = require("./adminLock");
const { appendAudit } = require("./audit");
const { digest } = require("./developmentBackup");

async function cleanupNonAdminAccounts(archive) {
  const saved = archive.collections.find(item => item.name === User.collection.name);
  if (!saved || digest(saved.documents) !== saved.checksum) throw new Error("A valid user backup is required");
  return withAdminLock(async session => {
    const current = await User.collection.find({}, { session }).sort({ _id: 1 }).toArray();
    if (digest(current) !== saved.checksum) throw new Error("Accounts changed since backup; create a new verified snapshot");
    const admins = current.filter(user => user.rol === "administrador");
    if (!admins.some(user => user.activo)) throw new Error("An active administrator must remain");
    const candidates = current.filter(user => user.rol !== "administrador");
    if (!candidates.length) return { deleted: 0, administratorsPreserved: admins.length };
    const result = await User.collection.deleteMany({ _id: { $in: candidates.map(user => user._id) }, rol: { $ne: "administrador" } }, { session });
    if (result.deletedCount !== candidates.length) throw new Error("Account cleanup did not match reviewed candidates");
    await appendAudit({ actor: { actorNombre: "Mantenimiento local autorizado", actorTipo: "mantenimiento" }, accion: "USER_CLEANUP", recurso: "usuario", cantidad: result.deletedCount }, session);
    return { deleted: result.deletedCount, administratorsPreserved: admins.length };
  });
}
module.exports = { cleanupNonAdminAccounts };
