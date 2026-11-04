const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { createApp } = require("../app");
const { loadConfig } = require("../config");
const { User } = require("../models/User");
const Student = require("../models/Student");
const { Career } = require("../models/Career");
const { AuditEvent } = require("../models/AuditEvent");
const { AcademicMigration, migrateAcademicData } = require("../services/academicMigration");
const { snapshotDatabase, restoreAndVerifyEmptyDatabase, encode, decode } = require("../services/developmentBackup");

const config = loadConfig({ JWT_SECRET: "dynamic-enrollment-tests-".repeat(3) });
const base = { studentId: "DYN001", name: "Estudiante ficticio", email: "student@example.test", phone: "+593999999999", nivelAcademico: 1 };
let mongo, app, admin, coordinator, semesters, years, student;
function signed(method, path, actor = admin) {
  const token = jwt.sign({ csrf: "test-csrf" }, config.secret, { subject: String(actor._id), issuer: config.issuer, audience: config.audience, expiresIn: "15m" });
  return request(app)[method](path).set("Origin", config.origin).set("Cookie", `session=${token}`).set("X-CSRF-Token", "test-csrf");
}
before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "dynamic_enrollment" });
  await Promise.all([Student.init(), Career.init(), User.init(), AcademicMigration.init()]);
  [admin, coordinator] = await User.create([
    { nombre: "Admin ficticio", email: "admin@example.test", passwordHash: "unused-for-token-test", rol: "administrador" },
    { nombre: "Coordinación ficticia", email: "coord@example.test", passwordHash: "unused-for-token-test", rol: "coordinador" },
  ]);
  [semesters, years] = await Career.create([
    { nombre: "Arquitectura", codigo: "ARQ", totalNiveles: 9, unidadNivel: "semestre" },
    { nombre: "Programa anual de prueba", codigo: "ANUAL", totalNiveles: 4, unidadNivel: "anio" },
  ]);
  base.careerId = String(semesters._id);
  app = await createApp(config);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });

test("dynamic assignment validates career references and integer level range", async () => {
  for (const nivelAcademico of [0, -1, 1.5, "1", 10]) assert.equal((await signed("post", "/api/students").send({ ...base, nivelAcademico })).status, 400);
  for (const careerId of ["bad-id", "000000000000000000000000"]) assert.equal((await signed("post", "/api/students").send({ ...base, careerId })).status, 400);
  assert.equal((await signed("post", "/api/students").send({ ...base, course: "CSE", year: "1" })).status, 400);
  const created = await signed("post", "/api/students", coordinator).send({ ...base, nivelAcademico: 9 });
  assert.equal(created.status, 201); student = created.body;
  assert.equal(student.career.nombre, "Arquitectura");
  assert.equal(student.careerId, String(semesters._id));
  assert.equal(student.nivelAcademico, 9);
  assert.equal(student.course, undefined); assert.equal(student.year, undefined);
  assert.equal(student.career.codigo, undefined);
  assert.equal(student.asignacionPendiente, false);
  assert.ok((await AuditEvent.findOne({ accion: "STUDENT_CREATE", recursoId: student._id })).campos.includes("careerId"));
});

test("inactive historical career remains readable/editable but cannot receive new assignments", async () => {
  assert.equal((await signed("patch", `/api/careers/${semesters._id}/status`).send({ activa: false })).status, 200);
  assert.equal((await signed("get", `/api/students/${student._id}`, coordinator)).body.career.activa, false);
  assert.equal((await signed("post", "/api/students").send({ ...base, studentId: "BLOCKED" })).status, 409);
  assert.equal((await signed("put", `/api/students/${student._id}`, coordinator).send({ ...base, nivelAcademico: 8, name: "Histórico actualizado" })).status, 200);
  const other = await signed("post", "/api/students").send({ ...base, careerId: String(years._id), studentId: "ANUAL001", nivelAcademico: 4 });
  assert.equal(other.status, 201);
  assert.equal((await signed("put", `/api/students/${other.body._id}`).send({ ...base, studentId: "ANUAL001" })).status, 409);
  assert.equal((await signed("delete", `/api/students/${student._id}`, coordinator)).status, 403);
  assert.equal((await signed("patch", `/api/careers/${semesters._id}`).send({ totalNiveles: 7 })).status, 409);
  assert.equal((await signed("patch", `/api/careers/${years._id}`).send({ unidadNivel: "semestre" })).status, 409);
});

test("concurrent enrollment and duration reduction never leave an out-of-range student", async () => {
  const career = await Career.create({ nombre: "Concurrencia", codigo: "RACE", totalNiveles: 9, unidadNivel: "semestre" });
  const [enroll, reduce] = await Promise.all([
    signed("post", "/api/students").send({ ...base, studentId: "RACE", careerId: String(career._id), nivelAcademico: 9 }),
    signed("patch", `/api/careers/${career._id}`).send({ totalNiveles: 8 }),
  ]);
  assert.ok([201, 400].includes(enroll.status));
  assert.ok([200, 409].includes(reduce.status));
  const saved = await Student.findOne({ studentId: "RACE" });
  const current = await Career.findById(career._id);
  assert.ok(!saved || saved.nivelAcademico <= current.totalNiveles);
});

test("concurrent deactivation prevents new enrollment unless it was committed first", async () => {
  const career = await Career.create({ nombre: "Estado concurrente", codigo: "STATE", totalNiveles: 5, unidadNivel: "semestre" });
  const [enroll, disable] = await Promise.all([
    signed("post", "/api/students").send({ ...base, studentId: "STATE", careerId: String(career._id) }),
    signed("patch", `/api/careers/${career._id}/status`).send({ activa: false }),
  ]);
  assert.ok([201, 409].includes(enroll.status)); assert.equal(disable.status, 200);
  assert.equal((await signed("post", "/api/students").send({ ...base, studentId: "STATE-LATE", careerId: String(career._id) })).status, 409);
});

test("approved legacy removal is exact, preserves modern records and is idempotent", async () => {
  const legacy = [{ _id: new mongoose.Types.ObjectId(), studentId: "OLD1", course: "CSE", year: "1" }, { _id: new mongoose.Types.ObjectId(), studentId: "OLD2", course: "EEE", year: "4" }];
  await Student.collection.insertMany(legacy);
  await Student.collection.updateOne({ _id: new mongoose.Types.ObjectId(student._id) }, { $set: { course: "CSE", year: "4" } });
  const archive = decode(encode(await snapshotDatabase(mongoose.connection)));
  await assert.rejects(migrateAcademicData(archive, [String(legacy[0]._id)]));
  const before = await Student.countDocuments();
  const result = await migrateAcademicData(archive, legacy.map(item => String(item._id)));
  assert.equal(result.deleted, 2); assert.equal(result.shadowsRemoved, 1);
  assert.equal(await Student.countDocuments(), before - 2);
  assert.ok(await Career.exists({ _id: semesters._id }));
  assert.ok(await User.exists({ _id: admin._id }));
  const saved = await Student.collection.findOne({ _id: new mongoose.Types.ObjectId(student._id) });
  assert.equal(saved.course, undefined); assert.equal(saved.nivelAcademico, 8);
  const events = await AuditEvent.countDocuments({ accion: "ACADEMIC_MIGRATION" });
  assert.equal((await migrateAcademicData(archive, legacy.map(item => String(item._id)))).alreadyApplied, true);
  assert.equal(await AuditEvent.countDocuments({ accion: "ACADEMIC_MIGRATION" }), events);
  const restored = await mongoose.createConnection(mongo.getUri(), { dbName: "isolated_academic_rollback", autoIndex: false, autoCreate: false }).asPromise();
  try {
    assert.equal((await restoreAndVerifyEmptyDatabase(restored, archive)).verified, true);
    assert.equal(await restored.db.collection("students").countDocuments(), before);
    assert.equal((await restored.db.collection("students").findOne({ _id: legacy[1]._id })).year, "4");
  } finally { await restored.close(); }
});
