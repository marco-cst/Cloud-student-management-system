const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "../.env"), quiet: true });
const mongoose = require("mongoose");
const readline = require("node:readline/promises");
const { Writable } = require("node:stream");
const { User } = require("../models/User");
const { bootstrapAdmin } = require("../services/bootstrapAdmin");
const { z, email, password } = require("../middleware/validation");

async function main() {
  if (!process.stdin.isTTY) throw new Error("Use an interactive terminal");
  let hidden = false;
  const output = new Writable({ write(chunk, encoding, callback) {
    if (!hidden) process.stdout.write(chunk, encoding);
    callback();
  } });
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  let input;
  try {
    const nombre = await rl.question("Nombre: ");
    const correo = await rl.question("Email: ");
    process.stdout.write("Contraseña (mínimo 12 caracteres, oculta): ");
    hidden = true;
    const secret = await rl.question("");
    process.stdout.write("\nRepetir contraseña: ");
    const confirmation = await rl.question("");
    process.stdout.write("\n");
    if (secret !== confirmation) throw new Error("Passwords differ");
    input = z.object({ nombre: z.string().trim().min(1).max(120), email, password }).parse({ nombre, email: correo, password: secret });
  } finally { rl.close(); }
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await User.init();
  const created = await bootstrapAdmin(input);
  console.log(created ? "Administrador inicial creado" : "Ya existe una cuenta o administrador; no se modifica");
}

main().catch(() => {
  console.error("No se creó el administrador. Revisa los datos y la configuración; mínimo 12 caracteres.");
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
