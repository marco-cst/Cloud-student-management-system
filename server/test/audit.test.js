const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const { createApp } = require("../app");
const { loadConfig } = require("../config");
const { User } = require("../models/User");
const { AuditEvent } = require("../models/AuditEvent");
const Student = require("../models/Student");
const { Career } = require("../models/Career");
const { snapshotDatabase, restoreAndVerifyEmptyDatabase, encode, decode } = require("../services/developmentBackup");
const { cleanupNonAdminAccounts } = require("../services/accountCleanup");

const config = loadConfig({ JWT_SECRET: "audit-test-secret-".repeat(4) });
const password = "Fictitious-audit-password-123!";
const student = { studentId: "AUDIT001", name: "Ficticio", email: "student@example.test", phone: "+593999999999", nivelAcademico: 1 };
let mongo, app, admin, coordinator;
function signed(method, path, user = admin) {
  const token = jwt.sign({ csrf: "audit-csrf" }, config.secret, { subject: String(user._id), issuer: config.issuer, audience: config.audience, expiresIn: "15m" });
  return request(app)[method](path).set("Origin", config.origin).set("Cookie", `session=${token}`).set("X-CSRF-Token", "audit-csrf");
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "audit_test" });
  await Promise.all([User.init(), Student.init(), Career.init()]);
  student.careerId = String((await Career.create({ nombre: "Carrera de prueba", codigo: "TEST", totalNiveles: 9, unidadNivel: "semestre" }))._id);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  [admin, coordinator] = await User.create([
    { nombre: "Admin ficticio", email: "admin@example.test", rol: "administrador", passwordHash },
    { nombre: "Coordinación ficticia", email: "coord@example.test", rol: "coordinador", passwordHash },
  ]);
  app = await createApp(config);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("successful/failed login and logout record server time without credentials", async () => {
  const success = await request(app).post("/api/auth/login").set("Origin", config.origin).send({ email: admin.email, password });
  assert.equal(success.status, 200);
  assert.equal((await request(app).post("/api/auth/login").set("Origin", config.origin).send({ email: admin.email, password: "wrong-password" })).status, 401);
  assert.equal((await signed("post", "/api/auth/logout")).status, 204);
  const events = await AuditEvent.find().lean();
  assert.ok(events.some(event => event.accion === "LOGIN_SUCCESS" && event.actorId.equals(admin._id)));
  assert.ok(events.some(event => event.accion === "LOGIN_FAILURE" && event.actorTipo === "anonimo" && event.resultado === "denegado"));
  assert.ok(events.some(event => event.accion === "LOGOUT"));
  assert.ok(events.every(event => event.fecha instanceof Date && Math.abs(Date.now() - event.fecha) < 60000));
  const serialized = JSON.stringify(events);
  for (const secret of [password, "wrong-password", "passwordHash", "cookie", "csrf", config.secret, admin.email]) assert.ok(!serialized.includes(secret));
});

test("student/user/career mutations are attributed to the authenticated actor", async () => {
  const added = await signed("post", "/api/students", coordinator).send(student);
  assert.equal(added.status, 201);
  assert.equal((await signed("put", `/api/students/${added.body._id}`, coordinator).send({ ...student, name: "Actualizado" })).status, 200);
  assert.equal((await signed("delete", `/api/students/${added.body._id}`)).status, 204);
  const user = await signed("post", "/api/users").send({ nombre: "Nuevo ficticio", email: "new@example.test", password, rol: "coordinador" });
  assert.equal(user.status, 201);
  assert.equal((await signed("patch", `/api/users/${user.body._id}`).send({ activo: false })).status, 200);
  const career = await signed("post", "/api/careers").send({ nombre: "Computación", codigo: "COM", totalNiveles: 8, unidadNivel: "semestre" });
  assert.equal(career.status, 201);
  assert.equal((await signed("patch", `/api/careers/${career.body._id}`).send({ totalNiveles: 9 })).status, 200);
  assert.equal((await signed("patch", `/api/careers/${career.body._id}/status`).send({ activa: false })).status, 200);
  for (const action of ["STUDENT_CREATE", "STUDENT_UPDATE", "STUDENT_DELETE", "USER_CREATE", "USER_UPDATE", "CAREER_CREATE", "CAREER_UPDATE", "CAREER_STATUS"]) assert.ok(await AuditEvent.exists({ accion: action }));
  const event = await AuditEvent.findOne({ accion: "STUDENT_CREATE" });
  assert.equal(String(event.actorId), String(coordinator._id));
  assert.equal(event.recursoId, added.body._id);
  assert.ok(event.campos.includes("name"));
  assert.ok(!(await AuditEvent.findOne({ accion: "USER_CREATE" })).campos.includes("password"));
});

test("audit search is admin-only, paginated, validates filters and cannot mutate events", async () => {
  assert.equal((await request(app).get("/api/audit-events")).status, 401);
  assert.equal((await signed("get", "/api/audit-events", coordinator)).status, 403);
  assert.ok(await AuditEvent.exists({ accion: "ACCESS_DENIED", actorId: coordinator._id }));
  const listing = await signed("get", "/api/audit-events?limit=2&page=1");
  assert.equal(listing.status, 200);
  assert.equal(listing.body.items.length, 2);
  assert.ok(listing.body.total > 2);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = await signed("get", `/api/audit-events?accion=STUDENT_CREATE&desde=${today}&hasta=${today}`);
  assert.equal(filtered.body.total, 1);
  assert.equal((await signed("get", "/api/audit-events?actor=.*")).body.total, 0);
  for (const query of ["page=0", "limit=1000", "actor[$ne]=x", "desde=invalid", "desde=2026-12-31&hasta=2026-01-01"]) assert.equal((await signed("get", `/api/audit-events?${query}`)).status, 400);
  const event = listing.body.items[0];
  for (const method of ["post", "patch", "delete"]) assert.equal((await signed(method, `/api/audit-events/${event._id}`).send({ actorNombre: "injected" })).status, 404);
  await assert.rejects(AuditEvent.updateOne({ _id: event._id }, { actorNombre: "injected" }));
  await assert.rejects(AuditEvent.deleteMany({}));
});

test("audit failure rolls back a business change and prevents unrecorded login", async context => {
  const before = await Student.countDocuments();
  context.mock.method(AuditEvent, "create", async () => { throw new Error("simulated audit outage"); });
  assert.equal((await signed("post", "/api/students").send({ ...student, studentId: "ROLLBACK" })).status, 503);
  assert.equal(await Student.countDocuments(), before);
  const login = await request(app).post("/api/auth/login").set("Origin", config.origin).send({ email: admin.email, password });
  assert.equal(login.status, 503);
  assert.equal(login.headers["set-cookie"], undefined);
});

test("snapshot round-trips BSON, hashes and indexes into an empty isolated database", async () => {
  const archive = decode(encode(await snapshotDatabase(mongoose.connection)));
  const restore = await mongoose.createConnection(mongo.getUri(), { dbName: "restore_validation", autoIndex: false, autoCreate: false }).asPromise();
  try {
    const result = await restoreAndVerifyEmptyDatabase(restore, archive);
    assert.equal(result.verified, true);
    const restored = await restore.db.collection("users").findOne({ _id: admin._id });
    assert.ok(restored.createdAt instanceof Date);
    assert.ok(await argon2.verify(restored.passwordHash, password));
    await assert.rejects(restoreAndVerifyEmptyDatabase(restore, archive));
    await assert.rejects(restoreAndVerifyEmptyDatabase(mongoose.connection, archive));
  } finally { await restore.close(); }
});

test("authorized cleanup keeps every admin, detects stale backup and retains actor history", async context => {
  const secondAdmin = await User.create({ nombre: "Segundo admin ficticio", email: "second-admin@example.test", rol: "administrador", passwordHash: await argon2.hash(password, { type: argon2.argon2id }) });
  const archive = await snapshotDatabase(mongoose.connection);
  await User.updateOne({ _id: coordinator._id }, { nombre: "Nombre cambiado" });
  await assert.rejects(cleanupNonAdminAccounts(archive));
  const fresh = await snapshotDatabase(mongoose.connection);
  const before = await User.countDocuments();
  const failingAudit = context.mock.method(AuditEvent, "create", async () => { throw new Error("simulated audit outage"); });
  await assert.rejects(cleanupNonAdminAccounts(fresh));
  assert.equal(await User.countDocuments(), before);
  failingAudit.mock.restore();
  const result = await cleanupNonAdminAccounts(fresh);
  assert.ok(result.deleted >= 2);
  assert.equal(result.administratorsPreserved, 2);
  assert.equal(await User.countDocuments({ rol: { $ne: "administrador" } }), 0);
  assert.ok(await User.exists({ _id: admin._id }));
  assert.ok(await User.exists({ _id: secondAdmin._id }));
  assert.equal((await signed("get", "/api/students", coordinator)).status, 401);
  assert.ok(await AuditEvent.exists({ actorId: coordinator._id, actorNombre: "Coordinación ficticia" }));
  assert.ok(await AuditEvent.exists({ accion: "USER_CLEANUP", cantidad: result.deleted, actorTipo: "mantenimiento" }));
});
