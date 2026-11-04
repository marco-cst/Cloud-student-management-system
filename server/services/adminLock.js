const mongoose = require("mongoose");

const AdminLock = mongoose.model("AdminLock", new mongoose.Schema({
  _id: String, revision: { type: Number, default: 0 },
}));

// All admin-state mutations write the same document in a transaction. This
// prevents two concurrent demotions from each observing another active admin.
async function withAdminLock(work) {
  await AdminLock.updateOne({ _id: "administrators" }, { $setOnInsert: { revision: 0 } }, { upsert: true });
  return mongoose.connection.transaction(async (session) => {
    await AdminLock.updateOne({ _id: "administrators" }, { $inc: { revision: 1 } }, { session });
    return work(session);
  });
}

module.exports = { withAdminLock };
