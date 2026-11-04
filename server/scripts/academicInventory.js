const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const { academicInventory } = require("../services/academicInventory");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("Missing database configuration");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, autoIndex: false, autoCreate: false });
  const inventory = await academicInventory();
  const directory = path.join(__dirname, "../.local-data");
  fs.mkdirSync(directory, { recursive: true });
  // Contains account IDs/emails, but no hashes, passwords, session data or URI.
  // A new file per run avoids overwriting previous review evidence.
  const filename = `academic-inventory-${Date.now()}.json`;
  fs.writeFileSync(path.join(directory, filename), JSON.stringify(inventory, null, 2), { flag: "wx", mode: 0o600 });
  console.log(`Inventario de solo lectura guardado en server/.local-data/${filename}`);
  console.log("No se modificaron cuentas, carreras ni estudiantes. Revisa el archivo local antes de autorizar cambios.");
}
main().catch(() => {
  console.error("No se pudo generar el inventario. Revisa configuración, DNS y conexión; no se muestran detalles sensibles.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
