const { createHash } = require("node:crypto");
const { BSON } = require("mongoose").mongo;

function encode(value) { return BSON.EJSON.stringify(value, { relaxed: false }); }
function decode(value) { return BSON.EJSON.parse(value, { relaxed: false }); }
function digest(value) { return createHash("sha256").update(encode(value)).digest("hex"); }

async function snapshotDatabase(connection) {
  const definitions = await connection.db.listCollections({}, { nameOnly: false }).toArray();
  const selected = definitions.filter(item => !item.name.startsWith("system."));
  if (selected.some(item => item.type !== "collection" || item.options?.timeseries || item.options?.capped)) {
    throw new Error("Unsupported collection type; use native backup tooling");
  }
  const collections = [];
  const session = await connection.startSession();
  try {
    await session.withTransaction(async () => {
      collections.length = 0;
      for (const item of selected) {
        const documents = await connection.db.collection(item.name).find({}, { session }).sort({ _id: 1 }).toArray();
        collections.push({ name: item.name, options: item.options || {}, documents, checksum: digest(documents) });
      }
    }, { readConcern: { level: "snapshot" } });
    for (const collection of collections) collection.indexes = await connection.db.collection(collection.name).listIndexes().toArray();
  } finally { await session.endSession(); }
  return { version: 1, createdAt: new Date(), sourceDatabase: connection.name, collections };
}

async function restoreAndVerifyEmptyDatabase(connection, archive) {
  if (Number(archive.version) !== 1 || connection.name === archive.sourceDatabase || (await connection.db.listCollections().toArray()).length) {
    throw new Error("Restore requires a different, empty database");
  }
  for (const item of archive.collections) {
    if (digest(item.documents) !== item.checksum) throw new Error("Backup integrity check failed");
    await connection.db.createCollection(item.name, item.options);
    const target = connection.db.collection(item.name);
    if (item.documents.length) await target.insertMany(item.documents);
    const indexes = item.indexes.filter(index => index.name !== "_id_").map(index => {
      const copy = { ...index }; delete copy.v; delete copy.ns; delete copy.background; return copy;
    });
    if (indexes.length) await target.createIndexes(indexes);
    const restored = await target.find().sort({ _id: 1 }).toArray();
    if (digest(restored) !== item.checksum) throw new Error("Restored documents differ from backup");
    const names = (await target.listIndexes().toArray()).map(index => index.name).sort();
    if (JSON.stringify(names) !== JSON.stringify(item.indexes.map(index => index.name).sort())) throw new Error("Restored indexes differ from backup");
  }
  return { verified: true, collections: archive.collections.length, documents: archive.collections.reduce((sum, item) => sum + item.documents.length, 0) };
}

module.exports = { snapshotDatabase, restoreAndVerifyEmptyDatabase, encode, decode, digest };
