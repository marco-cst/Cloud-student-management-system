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
const Student = require("../models/Student");
const { Career } = require("../models/Career");

const config = loadConfig({ JWT_SECRET: "test-only-secret-".repeat(4), APP_ORIGIN: "http://localhost:5173" });
const password = "Fictitious-password-123!";
const sample = { studentId: "TEST001", name: "Estudiante Ficticio", email: "student@example.test", phone: "+593 999999999", nivelAcademico: 1 };
let mongo, app, admin, coordinator, adminSession, coordinatorSession;

async function login(email, pass = password) {
  return request(app).post("/api/auth/login").set("Origin", config.origin).send({ email, password: pass });
}
function session(response) {
  return { cookie: response.headers["set-cookie"][0].split(";")[0], csrf: response.body.csrfToken };
}
function signed(method, path, auth = adminSession) {
  return request(app)[method](path).set("Origin", config.origin).set("Cookie", auth.cookie).set("x-csrf-token", auth.csrf);
}

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "student_management_test" });
  await Promise.all([User.init(), Student.init(), Career.init()]);
  sample.careerId = String((await Career.create({ nombre: "Computación", codigo: "COMP", totalNiveles: 9, unidadNivel: "semestre" }))._id);
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  [admin, coordinator] = await User.create([
    { nombre: "Admin Ficticio", email: "admin@example.test", passwordHash: hash, rol: "administrador" },
    { nombre: "Coordinador Ficticio", email: "coordinator@example.test", passwordHash: hash, rol: "coordinador" },
  ]);
  app = await createApp(config);
  adminSession = session(await login(admin.email));
  coordinatorSession = session(await login(coordinator.email));
}, { timeout: 180000 });

after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("login, HttpOnly cookie, public profile and logout", async () => {
  const response = await login("ADMIN@example.test");
  assert.equal(response.status, 200);
  assert.match(response.headers["set-cookie"][0], /HttpOnly/);
  assert.match(response.headers["set-cookie"][0], /SameSite=Strict/);
  assert.equal(response.body.user.passwordHash, undefined);
  assert.equal(response.body.token, undefined);
  const auth = session(response);
  const me = await signed("get", "/api/auth/me", auth);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.rol, "administrador");
  const logout = await signed("post", "/api/auth/logout", auth);
  assert.equal(logout.status, 204);
  assert.match(logout.headers["set-cookie"][0], /Expires=Thu, 01 Jan 1970/);
  assert.equal((await request(app).get("/api/auth/me")).status, 401);
});

test("wrong and unknown credentials have identical errors; no login CSRF", async () => {
  const wrong = await login(admin.email, "wrong");
  const missing = await login("missing@example.test", "wrong");
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.body, missing.body);
  assert.equal((await request(app).post("/api/auth/login").send({ email: admin.email, password })).status, 403);
  assert.equal((await login("invalid-email")).status, 400);
});

test("all student endpoints require a session", async () => {
  for (const [method, path] of [["get", ""], ["get", "/000000000000000000000000"], ["post", ""], ["put", "/000000000000000000000000"], ["delete", "/000000000000000000000000"]]) {
    assert.equal((await request(app)[method](`/api/students${path}`).set("Origin", config.origin).send(sample)).status, 401);
  }
});

test("expired and altered JWTs, inactive users and deleted users are rejected", async () => {
  const expired = jwt.sign({}, config.secret, { subject: String(admin._id), issuer: config.issuer, audience: config.audience, expiresIn: -1 });
  for (const cookie of [`session=${expired}`, `${adminSession.cookie}altered`]) {
    assert.equal((await request(app).get("/api/students").set("Cookie", cookie)).status, 401);
  }
  await User.updateOne({ _id: coordinator._id }, { activo: false });
  assert.equal((await signed("get", "/api/students", coordinatorSession)).status, 401);
  await User.updateOne({ _id: coordinator._id }, { activo: true });
  const deleted = jwt.sign({}, config.secret, { subject: String(new mongoose.Types.ObjectId()), issuer: config.issuer, audience: config.audience, expiresIn: "1m" });
  assert.equal((await request(app).get("/api/students").set("Cookie", `session=${deleted}`)).status, 401);
});

test("coordinator can read/create/edit students but cannot delete", async () => {
  assert.equal((await signed("get", "/api/students", coordinatorSession)).status, 200);
  const added = await signed("post", "/api/students", coordinatorSession).send({ ...sample, studentId: "COORD001" });
  assert.equal(added.status, 201);
  assert.equal((await signed("get", `/api/students/${added.body._id}`, coordinatorSession)).status, 200);
  const edited = await signed("put", `/api/students/${added.body._id}`, coordinatorSession).send({ ...sample, studentId: "COORD001", name: "Editado por coordinación" });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.name, "Editado por coordinación");
  assert.equal((await signed("delete", `/api/students/${added.body._id}`, coordinatorSession)).status, 403);
  assert.equal((await signed("delete", `/api/students/${added.body._id}`)).status, 204);
  assert.equal((await request(app).post("/api/students").set("Origin", config.origin).set("Cookie", coordinatorSession.cookie).send(sample)).status, 403);
});

test("CSRF and origin protect writes and logout", async () => {
  for (const path of ["/api/students", "/api/auth/logout"]) {
    assert.equal((await request(app).post(path).set("Origin", config.origin).set("Cookie", adminSession.cookie).send(sample)).status, 403);
    assert.equal((await signed("post", path).set("Origin", "https://evil.example").send(sample)).status, 403);
    assert.equal((await signed("post", path).set("x-csrf-token", "bad").send(sample)).status, 403);
  }
});

test("admin CRUD, persistence, validation and duplicates on create/update", async () => {
  const added = await signed("post", "/api/students").send(sample);
  assert.equal(added.status, 201);
  const id = added.body._id;
  assert.equal((await signed("get", `/api/students/${id}`)).body.name, sample.name);
  assert.equal((await Student.findById(id)).email, sample.email);
  assert.equal((await signed("post", "/api/students").send(sample)).status, 409);
  assert.equal((await signed("post", "/api/students").send({ ...sample, email: "bad" })).status, 400);
  assert.equal((await signed("post", "/api/students").send({ ...sample, role: "administrador" })).status, 400);
  assert.equal((await signed("get", "/api/students/not-an-id")).status, 400);
  assert.equal((await signed("get", "/api/students/000000000000000000000000")).status, 404);
  const other = await signed("post", "/api/students").send({ ...sample, studentId: "TEST002" });
  assert.equal((await signed("put", `/api/students/${other.body._id}`).send(sample)).status, 409);
  const updated = await signed("put", `/api/students/${id}`).send({ ...sample, name: "Nombre actualizado" });
  assert.equal(updated.body.name, "Nombre actualizado");
  assert.equal((await signed("delete", `/api/students/${id}`)).status, 204);
  assert.equal((await signed("get", `/api/students/${id}`)).status, 404);
});

test("current database role overrides token age", async () => {
  await User.updateOne({ _id: admin._id }, { rol: "coordinador" });
  assert.equal((await signed("delete", "/api/students/000000000000000000000000")).status, 403);
  assert.equal((await signed("get", "/api/users")).status, 403);
  await User.updateOne({ _id: admin._id }, { rol: "administrador" });
});

test("user management is admin-only, validates input and never returns hashes", async () => {
  for (const [method, path] of [["get", ""], ["post", ""], ["patch", `/${coordinator._id}`]]) {
    assert.equal((await signed(method, `/api/users${path}`, coordinatorSession).send({ rol: "administrador" })).status, 403);
  }
  assert.equal((await request(app).get("/api/users")).status, 401);
  const payload = { nombre: "Cuenta ficticia", email: "new@example.test", password, rol: "coordinador" };
  const created = await signed("post", "/api/users").send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.passwordHash, undefined);
  const stored = await User.findById(created.body._id).select("+passwordHash");
  assert.match(stored.passwordHash, /^\$argon2id\$/);
  assert.equal(await argon2.verify(stored.passwordHash, password), true);
  assert.equal((await signed("post", "/api/users").send(payload)).status, 409);
  assert.equal((await signed("post", "/api/users").send({ ...payload, email: "other@example.test", rol: "invalid-role" })).status, 400);
  assert.equal((await signed("patch", `/api/users/${stored._id}`).send({ passwordHash: "injected" })).status, 400);
  assert.equal((await signed("patch", `/api/users/${stored._id}`).send({})).status, 400);
  assert.equal((await signed("patch", `/api/users/${stored._id}`).send({ nombre: "Otro nombre", activo: false })).status, 200);
  const listing = await signed("get", "/api/users");
  assert.equal(listing.status, 200);
  assert.ok(listing.body.every(user => !user.passwordHash && !user.password));
  assert.equal((await signed("patch", "/api/users/not-an-id").send({ activo: false })).status, 400);
});

test("last active admin cannot be disabled or demoted, including concurrent requests", async () => {
  assert.equal((await signed("patch", `/api/users/${admin._id}`).send({ activo: false })).status, 409);
  assert.equal((await signed("patch", `/api/users/${admin._id}`).send({ rol: "coordinador" })).status, 409);
  const second = await signed("post", "/api/users").send({ nombre: "Segundo admin", email: "second@example.test", password, rol: "administrador" });
  assert.equal(second.status, 201);
  // Both requests authenticate before their transaction; exactly one may demote.
  const results = await Promise.all([
    signed("patch", `/api/users/${admin._id}`).send({ rol: "coordinador" }),
    signed("patch", `/api/users/${second.body._id}`).send({ rol: "coordinador" }),
  ]);
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.ok(results.every(result => [200, 403, 409].includes(result.status)));
  assert.equal(await User.countDocuments({ rol: "administrador", activo: true }), 1);
  await User.updateOne({ _id: admin._id }, { rol: "administrador" });
  await User.deleteOne({ _id: second.body._id });
});

test("initial admin service is idempotent and never overwrites accounts", async () => {
  const { bootstrapAdmin } = require("../services/bootstrapAdmin");
  assert.equal(await bootstrapAdmin({ nombre: "No crear", email: "bootstrap@example.test", password }), false);
  assert.equal(await User.countDocuments({ email: "bootstrap@example.test" }), 0);
  await User.updateOne({ _id: admin._id }, { rol: "coordinador" });
  try {
    assert.equal(await bootstrapAdmin({ nombre: "No sobrescribir", email: coordinator.email, password }), false);
    assert.equal((await User.findById(coordinator._id)).rol, "coordinador");
    assert.equal(await bootstrapAdmin({ nombre: "Admin semilla", email: "bootstrap@example.test", password }), true);
    assert.equal(await bootstrapAdmin({ nombre: "Otra semilla", email: "bootstrap2@example.test", password }), false);
    assert.equal(await User.countDocuments({ rol: "administrador", activo: true }), 1);
  } finally {
    await User.updateOne({ _id: admin._id }, { rol: "administrador" });
    await User.deleteMany({ email: { $in: ["bootstrap@example.test", "bootstrap2@example.test"] } });
  }
});

test("legacy roles cannot login or reuse JWTs and require explicit admin approval", async () => {
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const rol of ["profesor", "director", "unknown"]) {
    const id = new mongoose.Types.ObjectId();
    await User.collection.insertOne({ _id: id, nombre: "Cuenta heredada ficticia", email: `legacy-${rol}@example.test`, passwordHash: hash, rol, activo: true });
    // A fresh app resets only the test limiter, not account state.
    const freshApp = await createApp(config);
    const denied = await request(freshApp).post("/api/auth/login").set("Origin", config.origin).send({ email: `legacy-${rol}@example.test`, password });
    assert.equal(denied.status, 401);
    assert.equal(denied.headers["set-cookie"], undefined);
    const token = jwt.sign({ csrf: "old-csrf" }, config.secret, { subject: String(id), issuer: config.issuer, audience: config.audience, expiresIn: "1m" });
    const oldSession = { cookie: `session=${token}`, csrf: "old-csrf" };
    for (const path of ["/api/auth/me", "/api/students", "/api/users"]) {
      assert.equal((await signed("get", path, oldSession)).status, 401);
    }
    assert.equal((await signed("patch", `/api/users/${id}`).send({ activo: true })).status, 409);
    assert.equal((await signed("patch", `/api/users/${id}`).send({ activo: false })).status, 200);
    assert.equal((await User.findById(id)).rol, rol);
    const approved = await signed("patch", `/api/users/${id}`).send({ rol: "coordinador", activo: true });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.rol, "coordinador");
    assert.equal((await signed("get", "/api/students", oldSession)).status, 200);
  }
});

test("repeated logins are rate limited", async () => {
  let response;
  for (let i = 0; i < 11; i++) response = await login("missing@example.test", "wrong");
  assert.equal(response.status, 429);
  assert.ok(response.headers.ratelimit);
});

test("production fails closed without secure cookies and HTTPS", () => {
  assert.throws(() => loadConfig({ JWT_SECRET: "x".repeat(40), NODE_ENV: "production" }));
  assert.throws(() => loadConfig({ JWT_SECRET: "x".repeat(40), JWT_EXPIRES_IN: "7d" }));
  const production = loadConfig({ JWT_SECRET: "x".repeat(40), NODE_ENV: "production", APP_ORIGIN: "https://school.example", COOKIE_SECURE: "true" });
  assert.equal(production.cookie.secure, true);
});
