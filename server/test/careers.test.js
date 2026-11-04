const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const { createApp } = require("../app");
const { loadConfig } = require("../config");
const { User } = require("../models/User");
const { Career } = require("../models/Career");
const Student = require("../models/Student");
const { academicInventory } = require("../services/academicInventory");

const config = loadConfig({ JWT_SECRET: "career-tests-".repeat(5) });
const sample = { nombre: "Computación", codigo: "COM", totalNiveles: 8, unidadNivel: "semestre" };
let mongo, app, admin, coordinator, career;
function signed(method, path, user = admin) {
  const token = jwt.sign({ csrf: "career-test-csrf" }, config.secret, { subject: String(user._id), issuer: config.issuer, audience: config.audience, expiresIn: "15m" });
  return request(app)[method](path).set("Cookie", `session=${token}`).set("Origin", config.origin).set("X-CSRF-Token", "career-test-csrf");
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "careers_test" });
  await Promise.all([User.init(), Career.init(), Student.init()]);
  const passwordHash = await argon2.hash("Fictitious-career-password!", { type: argon2.argon2id });
  [admin, coordinator] = await User.create([
    { nombre: "Admin ficticio", email: "admin@example.test", rol: "administrador", passwordHash },
    { nombre: "Coordinación ficticia", email: "coord@example.test", rol: "coordinador", passwordHash },
  ]);
  app = await createApp(config);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("career endpoints require authentication; writes require admin and CSRF", async () => {
  for (const [method, path] of [["get", ""], ["get", "/000000000000000000000000"], ["post", ""], ["patch", "/000000000000000000000000"], ["patch", "/000000000000000000000000/status"]]) {
    assert.equal((await request(app)[method](`/api/careers${path}`).set("Origin", config.origin).send(sample)).status, 401);
  }
  for (const [method, path] of [["post", ""], ["patch", "/000000000000000000000000"], ["patch", "/000000000000000000000000/status"]]) {
    assert.equal((await signed(method, `/api/careers${path}`, coordinator).send(sample)).status, 403);
  }
  assert.equal((await signed("post", "/api/careers").set("X-CSRF-Token", "invalid").send(sample)).status, 403);
  assert.equal((await signed("post", "/api/careers").set("Origin", "https://evil.example").send(sample)).status, 403);
});

test("admin creates dynamic careers; both roles read active/historical records", async () => {
  const created = await signed("post", "/api/careers").send({ ...sample, codigo: " com " });
  assert.equal(created.status, 201);
  career = created.body;
  assert.equal(career.codigo, "COM");
  assert.equal(career.totalNiveles, 8);
  assert.equal(career.nombreNormalizado, undefined);
  assert.equal(career.lockRevision, undefined);
  assert.equal((await signed("get", `/api/careers/${career._id}`, coordinator)).status, 200);
  assert.equal((await signed("get", "/api/careers?activa=true", coordinator)).body.length, 1);
  assert.equal((await signed("get", "/api/careers?activa=invalid")).status, 400);
  assert.equal((await signed("get", "/api/careers?activa[$ne]=true")).status, 400);
  assert.equal((await signed("get", "/api/careers/not-id")).status, 400);
  assert.equal((await signed("get", "/api/careers/000000000000000000000000")).status, 404);
});

test("normalized names/codes are unique and levels are positive bounded integers", async () => {
  assert.equal((await signed("post", "/api/careers").send({ ...sample, nombre: "Otra carrera" })).status, 409);
  assert.equal((await signed("post", "/api/careers").send({ ...sample, codigo: "OTHER", nombre: "  COMPUTACION  " })).status, 409);
  for (const totalNiveles of [0, -1, 2.5, 101, "8"]) {
    assert.equal((await signed("post", "/api/careers").send({ ...sample, totalNiveles })).status, 400);
  }
  assert.equal((await signed("post", "/api/careers").send({ ...sample, unidadNivel: "trimestre" })).status, 400);
  assert.equal((await signed("post", "/api/careers").send({ ...sample, activa: false })).status, 400);
  assert.equal((await signed("patch", `/api/careers/${career._id}`).send({})).status, 400);
  const other = await signed("post", "/api/careers").send({ ...sample, nombre: "Administración", codigo: "ADM" });
  assert.equal(other.status, 201);
  assert.equal((await signed("patch", `/api/careers/${other.body._id}`).send({ codigo: "com" })).status, 409);
  assert.equal((await signed("patch", `/api/careers/${other.body._id}`).send({ nombre: "computacion" })).status, 409);
  assert.equal((await signed("patch", `/api/careers/${other.body._id}/status`).send({ activa: false, totalNiveles: 1 })).status, 400);
  await Career.deleteOne({ _id: other.body._id });
});

test("career editing, deactivation and reactivation retain history; no physical delete", async () => {
  const updated = await signed("patch", `/api/careers/${career._id}`).send({ nombre: "Ingeniería en Computación", totalNiveles: 10 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.totalNiveles, 10);
  assert.equal((await signed("patch", `/api/careers/${career._id}/status`).send({ activa: false })).status, 200);
  assert.equal((await signed("get", "/api/careers?activa=true", coordinator)).body.length, 0);
  assert.equal((await signed("get", "/api/careers?activa=false", coordinator)).body.length, 1);
  assert.equal((await signed("get", `/api/careers/${career._id}`, coordinator)).body.activa, false);
  assert.equal((await signed("delete", `/api/careers/${career._id}`)).status, 404);
  assert.ok(await Career.exists({ _id: career._id }));
  assert.equal((await signed("patch", `/api/careers/${career._id}/status`).send({ activa: true })).status, 200);
});

test("incompatible reduction/unit changes are blocked for referenced students", async () => {
  const id = new mongoose.Types.ObjectId();
  await Student.collection.insertOne({ _id: id, studentId: "FUTURE-REF", careerId: new mongoose.Types.ObjectId(career._id), nivelAcademico: 9 });
  assert.equal((await signed("patch", `/api/careers/${career._id}`).send({ totalNiveles: 8 })).status, 409);
  assert.equal((await signed("patch", `/api/careers/${career._id}`).send({ unidadNivel: "anio" })).status, 409);
  assert.equal((await Career.findById(career._id)).totalNiveles, 10);
  assert.equal((await signed("patch", `/api/careers/${career._id}/status`).send({ activa: false })).status, 200);
  assert.ok(await Student.collection.findOne({ _id: id }));
  assert.equal((await signed("get", `/api/careers/${career._id}`, coordinator)).status, 200);
  await Student.collection.deleteOne({ _id: id });
  assert.equal((await signed("patch", `/api/careers/${career._id}`).send({ totalNiveles: 8 })).status, 200);
});

test("legacy student fields are preserved; duration changes wait for approved migration", async () => {
  const old = { _id: new mongoose.Types.ObjectId(), studentId: "LEGACY", name: "Ficticio", email: "legacy@example.test", phone: "+593999999999", course: "CSE", year: "4" };
  await Student.collection.insertOne(old);
  assert.equal((await signed("patch", `/api/careers/${career._id}`).send({ totalNiveles: 6 })).status, 409);
  const stored = await Student.collection.findOne({ _id: old._id });
  assert.equal(stored.course, "CSE");
  assert.equal(stored.year, "4");
  assert.equal((await signed("patch", `/api/careers/${career._id}`).send({ totalNiveles: 12 })).status, 200);
});

test("read-only inventory identifies pending decisions and exposes no hashes/secrets", async () => {
  await User.collection.insertOne({ nombre: "Legado ficticio", email: "legacy@example.test", rol: "profesor", activo: true, passwordHash: "never-export-hash" });
  const beforeCounts = [await User.countDocuments(), await Student.countDocuments(), await Career.countDocuments()];
  const inventory = await academicInventory();
  assert.equal(inventory.counts.users, beforeCounts[0]);
  assert.equal(inventory.accountsRequiringDecision.length, 1);
  assert.equal(inventory.pendingStudentMigration, 1);
  assert.deepEqual(inventory.legacyStudentGroups, [{ course: "CSE", year: "4", count: 1 }]);
  assert.equal(inventory.roleCounts.profesor, 1);
  assert.ok(!JSON.stringify(inventory).includes("passwordHash"));
  assert.ok(!JSON.stringify(inventory).includes("never-export-hash"));
  assert.deepEqual([await User.countDocuments(), await Student.countDocuments(), await Career.countDocuments()], beforeCounts);
});
