const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const argon2 = require("argon2");
const { randomBytes } = require("node:crypto");
const studentRoutes = require("./routes/studentRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const careerRoutes = require("./routes/careerRoutes");
const auditRoutes = require("./routes/auditRoutes");
const { AuditEvent } = require("./models/AuditEvent");
const { authenticate, authorize, checkOrigin, csrfProtection } = require("./middleware/security");

async function createApp(config) {
  await AuditEvent.init();
  const app = express();
  app.disable("x-powered-by");
  // Only the explicitly configured local reverse proxy may supply client IPs.
  app.set("trust proxy", config.trustProxy ?? false);
  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.use(cookieParser());
  app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  app.use("/api", checkOrigin(config));
  app.get("/", (req, res) => res.json({ message: "Student Management System API is running" }));
  const dummyHash = await argon2.hash(randomBytes(32), { type: argon2.argon2id });
  app.use("/api/auth", authRoutes(config, dummyHash));
  app.use("/api/students", authenticate(config), authorize("administrador", "coordinador"), csrfProtection, studentRoutes);
  app.use("/api/users", authenticate(config), authorize("administrador"), csrfProtection, userRoutes);
  app.use("/api/careers", authenticate(config), authorize("administrador", "coordinador"), csrfProtection, careerRoutes);
  app.use("/api/audit-events", authenticate(config), authorize("administrador"), csrfProtection, auditRoutes);
  app.use((req, res) => res.status(404).json({ message: "Recurso no encontrado" }));
  // Do not return driver messages, request bodies or secrets to clients/logs.
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.code === "AUDIT_UNAVAILABLE") return res.status(503).json({ message: "No se pudo registrar la auditoría. No se confirmó la operación; inténtalo nuevamente más tarde." });
    if (error.code === 11000) return res.status(409).json({ message: "El identificador o correo ya existe" });
    if (error.type === "entity.too.large") return res.status(413).json({ message: "Solicitud demasiado grande" });
    if (error.type === "entity.parse.failed" || error.name === "ValidationError") return res.status(400).json({ message: "Datos inválidos" });
    res.status(500).json({ message: "Error interno del servidor" });
  });
  return app;
}

module.exports = { createApp };
