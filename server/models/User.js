const mongoose = require("mongoose");
const { USER_ROLES } = require("../policies/roles");

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  rol: { type: String, enum: USER_ROLES, required: true },
  activo: { type: Boolean, default: true },
  must_change_password: { type: Boolean, default: false },
  temporaryPasswordExpiresAt: { type: Date, select: false },
  sessionVersion: { type: Number, default: 0, select: false },
}, { timestamps: true });

function publicUser(user) {
  return { _id: user._id, nombre: user.nombre, email: user.email, rol: user.rol,
    activo: user.activo, must_change_password: !!user.must_change_password, createdAt: user.createdAt, updatedAt: user.updatedAt };
}

module.exports = { User: mongoose.model("User", userSchema), publicUser };
