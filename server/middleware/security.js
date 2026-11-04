const jwt = require("jsonwebtoken");
const { timingSafeEqual } = require("node:crypto");
const mongoose = require("mongoose");
const { User } = require("../models/User");
const { isSupportedRole } = require("../policies/roles");
const { deniedAudit } = require("../services/audit");

function authenticate(config, { allowPasswordChange = false } = {}) {
  return async (req, res, next) => {
    let claims;
    try {
      claims = jwt.verify(req.cookies.session, config.secret, {
        algorithms: ["HS256"], issuer: config.issuer, audience: config.audience,
      });
      if (!mongoose.isObjectIdOrHexString(claims.sub)) throw new Error("Invalid subject");
    } catch {
      return res.status(401).json({ message: "Sesión inválida o expirada" });
    }
    const user = await User.findById(claims.sub).select("+sessionVersion +temporaryPasswordExpiresAt");
    if (!user || !user.activo || !isSupportedRole(user.rol)) return res.status(401).json({ message: "Sesión inválida o expirada" });
    if ((claims.version ?? 0) !== (user.sessionVersion ?? 0) ||
      (user.must_change_password && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt <= new Date()))) {
      return res.status(401).json({ message: "Sesión inválida o expirada. Solicita otra clave temporal si corresponde." });
    }
    if (user.must_change_password && !allowPasswordChange) return res.status(403).json({ code: "PASSWORD_CHANGE_REQUIRED", message: "Debes crear una nueva contraseña antes de continuar." });
    req.user = user;
    req.auth = claims;
    next();
  };
}

function authorize(...roles) {
  return async (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      await deniedAudit(req);
      return res.status(403).json({ message: "No tienes permisos para esta operación" });
    }
    next();
  };
}

function checkOrigin(config) {
  return (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") !== config.origin) {
      return res.status(403).json({ message: "Origen no permitido" });
    }
    next();
  };
}

function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const supplied = Buffer.from(req.get("x-csrf-token") || "");
  const expected = Buffer.from(req.auth.csrf || "");
  if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return res.status(403).json({ message: "Token CSRF inválido" });
  }
  next();
}

module.exports = { authenticate, authorize, checkOrigin, csrfProtection };
