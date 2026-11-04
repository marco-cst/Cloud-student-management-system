const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { snapshotDatabase, restoreAndVerifyEmptyDatabase, encode, decode } = require("../services/developmentBackup");
const { cleanupNonAdminAccounts } = require("../services/accountCleanup");
const { AuditEvent } = require("../models/AuditEvent");

async function main() {
  const expectedDatabase = process.argv.find(arg => arg.startsWith("--confirm-database="))?.split("=")[1];
  const apply = process.argv.includes("--apply");
  if (process.env.NODE_ENV === "production") throw new Error("Development maintenance cannot run in production");
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false });
  if (!expectedDatabase || mongoose.connection.name !== expectedDatabase) throw new Error("Explicit database confirmation required");
  const archive = await snapshotDatabase(mongoose.connection);
  const directory = path.join(__dirname, "../.local-data/backups", String(Date.now()));
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, "database.ejson");
  fs.writeFileSync(filename, encode(archive), { flag: "wx", mode: 0o600 });
  const persisted = decode(fs.readFileSync(filename, "utf8"));
  const temporary = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  let restored;
  try {
    restored = await mongoose.createConnection(temporary.getUri(), { dbName: "isolated_restore_verification", autoCreate: false, autoIndex: false }).asPromise();
    const validation = await restoreAndVerifyEmptyDatabase(restored, persisted);
    fs.writeFileSync(path.join(directory, "verification.json"), JSON.stringify(validation, null, 2), { flag: "wx", mode: 0o600 });
  } finally { if (restored) await restored.close(); await temporary.stop(); }
  console.log(`Respaldo privado y restauración verificados: server/.local-data/backups/${path.basename(directory)}`);
  if (!apply) { console.log("Solo respaldo; no se eliminaron cuentas. --apply requiere autorización previa."); return; }
  await AuditEvent.createCollection();
  const result = await cleanupNonAdminAccounts(persisted);
  console.log(JSON.stringify({ cleanupCompleted: true, ...result }));
}
main().catch(error => {
  console.error(JSON.stringify({ maintenanceFailed: true, errorType: error.name, errorCode: error.code, message: "No se completó la limpieza. No se muestran credenciales; revisar respaldo y configuración." }));
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
