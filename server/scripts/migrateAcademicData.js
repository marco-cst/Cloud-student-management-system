const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { snapshotDatabase, restoreAndVerifyEmptyDatabase, encode, decode } = require("../services/developmentBackup");
const { migrateAcademicData, AcademicMigration } = require("../services/academicMigration");
const { AuditEvent } = require("../models/AuditEvent");

async function main() {
  const database = process.argv.find(arg => arg.startsWith("--confirm-database="))?.split("=")[1];
  const approved = (process.argv.find(arg => arg.startsWith("--remove-legacy="))?.split("=")[1] || "").split(",").filter(Boolean);
  if (process.env.NODE_ENV === "production") throw new Error("Development migration only");
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
  if (!database || database !== mongoose.connection.name) throw new Error("Explicit database confirmation required");
  const archive = await snapshotDatabase(mongoose.connection);
  const directory = path.join(__dirname, "../.local-data/backups", `academic-${Date.now()}`);
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, "database.ejson");
  fs.writeFileSync(filename, encode(archive), { flag: "wx", mode: 0o600 });
  const persisted = decode(fs.readFileSync(filename, "utf8"));
  const temporary = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let restored;
  try {
    restored = await mongoose.createConnection(temporary.getUri(), { dbName: "academic_restore_check", autoIndex: false, autoCreate: false }).asPromise();
    const verification = await restoreAndVerifyEmptyDatabase(restored, persisted);
    fs.writeFileSync(path.join(directory, "verification.json"), JSON.stringify(verification, null, 2), { flag: "wx", mode: 0o600 });
  } finally { if (restored) await restored.close(); await temporary.stop(); }
  console.log(`Respaldo académico privado y restauración verificados: server/.local-data/backups/${path.basename(directory)}`);
  if (!process.argv.includes("--apply")) { console.log("Sin aplicar: no se modificaron estudiantes ni carreras."); return; }
  await AuditEvent.createCollection(); await AcademicMigration.createCollection();
  console.log(JSON.stringify({ migrationCompleted: true, ...await migrateAcademicData(persisted, approved) }));
}
main().catch(error => {
  console.error(JSON.stringify({ migrationFailed: true, errorType: error.name, errorCode: error.code, message: "Revisar aprobación, respaldo y configuración. No se muestran datos sensibles." }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
