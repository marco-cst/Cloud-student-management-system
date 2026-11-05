const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const { createApp } = require("../app");
const { loadConfig } = require("../config");

const base = { JWT_SECRET: "local-proxy-test-secret-".repeat(3) };
let mongo, app, config;
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "proxy_security_test" });
  config = loadConfig({ ...base, TRUST_PROXY: "loopback" });
  app = await createApp(config);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("proxy trust is disabled by default and unrestricted settings are rejected", () => {
  assert.equal(loadConfig(base).trustProxy, false);
  assert.equal(loadConfig({ ...base, TRUST_PROXY: "false" }).trustProxy, false);
  for (const TRUST_PROXY of ["true", "1", "uniquelocal", "0.0.0.0/0"]) {
    assert.throws(() => loadConfig({ ...base, TRUST_PROXY }), /TRUST_PROXY/);
  }
});

test("configured application trusts loopback peers but not public or private network peers", () => {
  assert.equal(app.get("trust proxy"), "loopback");
  const trusted = app.get("trust proxy fn");
  for (const address of ["127.0.0.1", "::1", "::ffff:127.0.0.1"]) assert.equal(trusted(address), true);
  for (const address of ["203.0.113.10", "10.20.0.4", "192.168.1.1"]) assert.equal(trusted(address), false);
});

test("login rate limit uses the forwarded client and cannot be reset by prepending fake hops", async () => {
  const login = forwarded => request(app).post("/api/auth/login")
    .set("Origin", config.origin).set("X-Forwarded-For", forwarded)
    .send({ email: "unknown@example.test", password: "wrong-test-password" });
  for (let i = 0; i < 10; i++) {
    assert.equal((await login(`198.51.100.${i + 1}, 203.0.113.10`)).status, 401);
  }
  assert.equal((await login("198.51.100.99, 203.0.113.10")).status, 429);
  assert.equal((await login("203.0.113.11")).status, 401);
});
