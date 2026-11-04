// Isolated E2E harness: never loads .env or connects to Atlas.
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const argon2 = require("argon2");
const { randomBytes } = require("node:crypto");
const { createApp } = require("../app");
const { loadConfig } = require("../config");
const { User } = require("../models/User");
const Student = require("../models/Student");
const { Career } = require("../models/Career");

async function main() {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "student_management_e2e" });
  await Promise.all([User.init(), Student.init(), Career.init()]);
  const passwordHash = await argon2.hash("Fictitious-password-123!", { type: argon2.argon2id });
  await User.create([
    { nombre: "Admin Ficticio", email: "admin@example.test", passwordHash, rol: "administrador" },
    { nombre: "Coordinador Ficticio", email: "coordinator@example.test", passwordHash, rol: "coordinador" },
  ]);
  const [computing, administration] = await Career.create([
    { nombre: "Computación", codigo: "COMP", totalNiveles: 9, unidadNivel: "semestre" },
    { nombre: "Gestión administrativa", codigo: "ADM", totalNiveles: 4, unidadNivel: "anio" },
  ]);
  await Student.create(Array.from({ length: 7 }, (_, index) => ({
    studentId: `SEED00${index}`, name: `Estudiante Ficticio ${index}`, email: `student${index}@example.test`,
    phone: "+593999999999", careerId: index === 6 ? administration._id : computing._id, nivelAcademico: index === 6 ? 2 : 1,
  })));
  const app = await createApp(loadConfig({ JWT_SECRET: randomBytes(48).toString("hex"), APP_ORIGIN: process.env.E2E_APP_ORIGIN || "http://localhost:5173" }));
  const server = app.listen(Number(process.env.E2E_API_PORT || 5000), "127.0.0.1");
  const stop = async () => { server.close(); await mongoose.disconnect(); await mongo.stop(); };
  process.on("SIGINT", stop); process.on("SIGTERM", stop);
}
main().catch(() => { console.error("E2E harness failed"); process.exitCode = 1; });
