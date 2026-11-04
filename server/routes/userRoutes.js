const express = require("express");
const argon2 = require("argon2");
const { User, publicUser } = require("../models/User");
const { z, email, password, role, validate, validateId } = require("../middleware/validation");
const { withAdminLock } = require("../services/adminLock");
const { isSupportedRole } = require("../policies/roles");
const mongoose = require("mongoose");
const { appendAudit } = require("../services/audit");
const router = express.Router();
const { randomBytes } = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const nombre = z.string().trim().min(1).max(120);

router.get("/", async (req, res) => res.json((await User.find().sort({ createdAt: -1 })).map(publicUser)));
router.post("/:id/reset-password", validateId,
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Demasiados intentos; inténtalo más tarde" } }),
  validate(z.object({ adminPassword: z.string().min(1).max(128) }).strict()), async (req, res) => {
    if (String(req.user._id) === req.params.id) return res.status(409).json({ message: "Para tu propia cuenta utiliza Cambiar contraseña." });
    const temporaryPassword = randomBytes(24).toString("base64url");
    const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });
    const result = await withAdminLock(async session => {
      const actor = await User.findById(req.user._id).select("+passwordHash +sessionVersion").session(session);
      if (!actor?.activo || actor.rol !== "administrador" || actor.must_change_password || (actor.sessionVersion ?? 0) !== (req.auth.version ?? 0)) return { status: 401, body: { message: "Sesión inválida o expirada" } };
      if (!await argon2.verify(actor.passwordHash, req.body.adminPassword)) return { status: 403, body: { message: "No se pudo confirmar tu contraseña de administrador." } };
      const user = await User.findById(req.params.id).select("+sessionVersion").session(session);
      if (!user) return { status: 404, body: { message: "Usuario no encontrado" } };
      if (!user.activo || !isSupportedRole(user.rol)) return { status: 409, body: { message: "Activa y revisa el rol de la cuenta antes de restablecer su clave." } };
      user.passwordHash = passwordHash; user.must_change_password = true;
      user.temporaryPasswordExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
      await user.save({ session });
      await appendAudit({ user: actor, accion: "PASSWORD_RESET", recurso: "usuario", recursoId: user._id }, session);
      return { status: 200, body: { user: publicUser(user), temporaryPassword, expiresAt: user.temporaryPasswordExpiresAt } };
    });
    res.status(result.status).json(result.body);
  });
router.post("/", validate(z.object({ nombre, email, password, rol: role }).strict()), async (req, res) => {
  const { password: secret, ...data } = req.body;
  const passwordHash = await argon2.hash(secret, { type: argon2.argon2id });
  const user = await mongoose.connection.transaction(async session => {
    const [created] = await User.create([{ ...data, passwordHash }], { session });
    await appendAudit({ user: req.user, accion: "USER_CREATE", recurso: "usuario", recursoId: created._id, campos: ["nombre", "email", "rol"] }, session);
    return created;
  });
  res.status(201).json(publicUser(user));
});
router.patch("/:id", validateId, validate(z.object({ nombre: nombre.optional(), rol: role.optional(), activo: z.boolean().optional() }).strict()
  .refine(value => Object.keys(value).length > 0)), async (req, res) => {
  const result = await withAdminLock(async (session) => {
    const user = await User.findById(req.params.id).session(session);
    if (!user) return { status: 404, body: { message: "Usuario no encontrado" } };
    const removesAdmin = user.rol === "administrador" && user.activo &&
      (req.body.rol === "coordinador" || req.body.activo === false);
    if (removesAdmin && await User.countDocuments({ rol: "administrador", activo: true }).session(session) <= 1) {
      return { status: 409, body: { message: "Debe quedar al menos un administrador activo" } };
    }
    if (!isSupportedRole(user.rol) && !req.body.rol && req.body.activo !== false) {
      return { status: 409, body: { message: "Esta cuenta necesita una decisión explícita de rol antes de habilitar su acceso" } };
    }
    // Updated paths are validated; legacy accounts may be disabled without
    // rewriting their historical role or silently granting new privileges.
    const updated = await User.findByIdAndUpdate(user._id, { $set: req.body }, { session, runValidators: true, returnDocument: "after" });
    await appendAudit({ user: req.user, accion: "USER_UPDATE", recurso: "usuario", recursoId: updated._id, campos: Object.keys(req.body) }, session);
    return { status: 200, body: publicUser(updated) };
  });
  res.status(result.status).json(result.body);
});

module.exports = router;
