const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const argon2 = require("argon2");
const { createApp } = require("../app");
const { loadConfig } = require("../config");
const { User } = require("../models/User");
const { AuditEvent } = require("../models/AuditEvent");

const config = loadConfig({ JWT_SECRET: "password-flow-tests-".repeat(4) });
const original = "Fictitious-password-123!", replacement = "Private-new-password-456!";
let mongo, app, admin, coordinator, adminSession, oldSession, temporary, limited;
async function login(email, password = original) {
  return request(app).post("/api/auth/login").set("Origin", config.origin).send({ email, password });
}
function session(response) { return { cookie: response.headers["set-cookie"][0].split(";")[0], csrf: response.body.csrfToken }; }
function signed(method, path, auth = adminSession) {
  return request(app)[method](path).set("Origin", config.origin).set("Cookie", auth.cookie).set("X-CSRF-Token", auth.csrf);
}
function reset(body = { adminPassword: original }, auth = adminSession) { return signed("post", `/api/users/${coordinator._id}/reset-password`, auth).send(body); }
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "password_flow_test" });
  await User.init();
  const passwordHash = await argon2.hash(original, { type: argon2.argon2id });
  [admin, coordinator] = await User.create([
    { nombre: "Admin ficticio", email: "admin@example.test", rol: "administrador", passwordHash },
    { nombre: "Coordinación ficticia", email: "coord@example.test", rol: "coordinador", passwordHash },
  ]);
  app = await createApp(config);
  adminSession = session(await login(admin.email)); oldSession = session(await login(coordinator.email));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("reset requires admin, CSRF, reauthentication and a different active account", async () => {
  assert.equal((await reset({ adminPassword: original }, oldSession)).status, 403);
  assert.equal((await request(app).post(`/api/users/${coordinator._id}/reset-password`).set("Origin", config.origin).set("Cookie", adminSession.cookie).send({ adminPassword: original })).status, 403);
  assert.equal((await reset({ adminPassword: "wrong" })).status, 403);
  assert.equal((await signed("post", `/api/users/${admin._id}/reset-password`).send({ adminPassword: original })).status, 409);
  await User.updateOne({ _id: coordinator._id }, { activo: false });
  assert.equal((await reset()).status, 409);
  await User.updateOne({ _id: coordinator._id }, { activo: true });
});

test("reset issues random hashed expiring key once and invalidates previous sessions", async () => {
  const result = await reset(); assert.equal(result.status, 200);
  temporary = result.body.temporaryPassword;
  assert.ok(temporary.length >= 32); assert.equal(result.body.user.must_change_password, true);
  assert.equal(result.headers["cache-control"], "no-store");
  const stored = await User.findById(coordinator._id).select("+passwordHash +temporaryPasswordExpiresAt");
  assert.notEqual(stored.passwordHash, temporary); assert.equal(await argon2.verify(stored.passwordHash, temporary), true);
  assert.ok(stored.temporaryPasswordExpiresAt > new Date(Date.now() + 23 * 3600000));
  assert.equal((await signed("get", "/api/students", oldSession)).status, 401);
  assert.equal((await login(coordinator.email)).status, 401);
  const users = await signed("get", "/api/users");
  assert.ok(!JSON.stringify(users.body).includes(temporary));
  assert.equal(users.body[0].passwordHash, undefined);
  const logged = await login(coordinator.email, temporary); assert.equal(logged.status, 200); limited = session(logged);
});

test("temporary session cannot navigate APIs but may inspect session and change password", async () => {
  assert.equal((await signed("get", "/api/auth/me", limited)).body.user.must_change_password, true);
  for (const path of ["students", "users", "careers", "audit-events"]) {
    const response = await signed("get", `/api/${path}`, limited);
    assert.equal(response.status, 403); assert.equal(response.body.code, "PASSWORD_CHANGE_REQUIRED");
  }
  assert.equal((await signed("post", "/api/auth/change-password", limited).send({ currentPassword: "wrong", newPassword: replacement })).status, 400);
  assert.equal((await signed("post", "/api/auth/change-password", limited).send({ currentPassword: temporary, newPassword: temporary })).status, 409);
  assert.equal((await signed("post", "/api/auth/change-password", limited).send({ currentPassword: temporary, newPassword: "short" })).status, 400);
});

test("audit outage rolls back reset and password change without exposing secrets", async context => {
  const failing = context.mock.method(AuditEvent, "create", async () => { throw new Error("simulated audit outage"); });
  const result = await reset(); assert.equal(result.status, 503); assert.equal(result.body.temporaryPassword, undefined);
  assert.equal((await signed("post", "/api/auth/change-password", limited).send({ currentPassword: temporary, newPassword: replacement })).status, 503);
  failing.mock.restore();
  assert.equal(await argon2.verify((await User.findById(coordinator._id).select("+passwordHash")).passwordHash, temporary), true);
});

test("concurrent changes consume the temporary key only once and revoke its session", async () => {
  const results = await Promise.all([1, 2].map(() => signed("post", "/api/auth/change-password", limited).send({ currentPassword: temporary, newPassword: replacement })));
  assert.deepEqual(results.map(result => result.status).sort(), [204, 401]);
  assert.equal((await signed("get", "/api/auth/me", limited)).status, 401);
  const logged = await login(coordinator.email, replacement); assert.equal(logged.status, 200);
  assert.equal(logged.body.user.must_change_password, false);
  assert.equal((await signed("get", "/api/students", session(logged))).status, 200);
  assert.equal((await login(coordinator.email, temporary)).status, 401);
  const events = await AuditEvent.find({ accion: { $in: ["PASSWORD_RESET", "PASSWORD_CHANGE"] } }).lean();
  assert.equal(events.length, 2);
  assert.ok(!JSON.stringify(events).includes(temporary)); assert.ok(!JSON.stringify(events).includes(replacement));
});

test("expired key and its previously issued session cannot be used", async () => {
  const resetResult = await reset(); assert.equal(resetResult.status, 200);
  const logged = await login(coordinator.email, resetResult.body.temporaryPassword); assert.equal(logged.status, 200);
  await User.updateOne({ _id: coordinator._id }, { temporaryPasswordExpiresAt: new Date(Date.now() - 1000) });
  assert.equal((await login(coordinator.email, resetResult.body.temporaryPassword)).status, 401);
  assert.equal((await signed("get", "/api/auth/me", session(logged))).status, 401);
  assert.equal((await signed("post", "/api/auth/change-password", session(logged)).send({ currentPassword: resetResult.body.temporaryPassword, newPassword: replacement })).status, 401);
});

test("users can change their own non-temporary password and revoke old sessions", async () => {
  const changed = await signed("post", "/api/auth/change-password").send({ currentPassword: original, newPassword: replacement });
  assert.equal(changed.status, 204);
  assert.equal((await signed("get", "/api/auth/me")).status, 401);
  const logged = await login(admin.email, replacement); assert.equal(logged.status, 200);
  assert.equal(logged.body.user.must_change_password, false);
  assert.equal((await signed("get", "/api/users", session(logged))).status, 200);
});
