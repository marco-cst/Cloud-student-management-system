const express = require("express");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("node:crypto");
const { rateLimit } = require("express-rate-limit");
const { User, publicUser } = require("../models/User");
const { z, email, password, validate } = require("../middleware/validation");
const mongoose = require("mongoose");
const { authenticate, csrfProtection } = require("../middleware/security");
const { isSupportedRole } = require("../policies/roles");
const { appendAudit } = require("../services/audit");

function authRoutes(config, dummyHash) {
  const router = express.Router();
  router.post("/login", rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Demasiados intentos; inténtalo más tarde" },
  }), validate(z.object({ email, password: z.string().min(1).max(128) }).strict()), async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select("+passwordHash +sessionVersion +temporaryPasswordExpiresAt");
    const valid = await argon2.verify(user?.passwordHash || dummyHash, req.body.password);
    if (!user || !valid || !user.activo || !isSupportedRole(user.rol) ||
      (user.must_change_password && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt <= new Date()))) {
      await appendAudit({ accion: "LOGIN_FAILURE", recurso: "sesion", resultado: "denegado" });
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    const csrfToken = randomBytes(32).toString("hex");
    const token = jwt.sign({ csrf: csrfToken, version: user.sessionVersion ?? 0 }, config.secret, {
      algorithm: "HS256", subject: String(user._id), expiresIn: config.expiresIn,
      issuer: config.issuer, audience: config.audience,
    });
    await appendAudit({ user, accion: "LOGIN_SUCCESS", recurso: "sesion" });
    res.cookie("session", token, config.cookie).json({ user: publicUser(user), csrfToken });
  });
  router.get("/me", authenticate(config, { allowPasswordChange: true }), (req, res) => {
    res.json({ user: publicUser(req.user), csrfToken: req.auth.csrf });
  });
  router.post("/change-password", authenticate(config, { allowPasswordChange: true }), csrfProtection,
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
      message: { message: "Demasiados intentos; inténtalo más tarde" } }),
    validate(z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }).strict()), async (req, res) => {
      const result = await mongoose.connection.transaction(async session => {
        const user = await User.findById(req.user._id).select("+passwordHash +sessionVersion +temporaryPasswordExpiresAt").session(session);
        if (!user || !user.activo || (user.sessionVersion ?? 0) !== (req.auth.version ?? 0)) return 401;
        if (user.must_change_password && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt <= new Date())) return 401;
        if (!await argon2.verify(user.passwordHash, req.body.currentPassword)) return 400;
        if (await argon2.verify(user.passwordHash, req.body.newPassword)) return 409;
        user.passwordHash = await argon2.hash(req.body.newPassword, { type: argon2.argon2id });
        user.must_change_password = false; user.temporaryPasswordExpiresAt = undefined;
        user.sessionVersion = (user.sessionVersion ?? 0) + 1;
        await user.save({ session });
        await appendAudit({ user, accion: "PASSWORD_CHANGE", recurso: "usuario", recursoId: user._id }, session);
        return 204;
      });
      if (result !== 204) return res.status(result).json({ message: result === 409 ? "La nueva contraseña debe ser diferente de la actual." : result === 401 ? "Sesión inválida o expirada" : "La contraseña actual no es correcta." });
      res.clearCookie("session", config.cookie).status(204).end();
    });
  router.post("/logout", authenticate(config, { allowPasswordChange: true }), csrfProtection, async (req, res) => {
    await appendAudit({ user: req.user, accion: "LOGOUT", recurso: "sesion" });
    res.clearCookie("session", config.cookie).status(204).end();
  });
  return router;
}

module.exports = authRoutes;
