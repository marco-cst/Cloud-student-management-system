const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const mongoose = require("mongoose");
const { loadConfig } = require("./config");
const { createApp } = require("./app");

async function start() {
  const config = loadConfig();
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const app = await createApp(config);
  const server = app.listen(process.env.PORT || 5000, process.env.HOST || "127.0.0.1", () => {
    console.log("Student Management API ready");
  });
  async function stop() { server.close(); await mongoose.disconnect(); }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

start().catch(() => {
  console.error("Unable to start API. Check environment and database connectivity.");
  process.exitCode = 1;
});
