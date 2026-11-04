const mongoose = require("mongoose");

function normalizedName(value) {
  return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const careerSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  nombreNormalizado: { type: String, required: true, unique: true, select: false },
  codigo: { type: String, required: true, unique: true, uppercase: true, trim: true, match: /^[A-Z0-9][A-Z0-9_-]{1,15}$/ },
  totalNiveles: { type: Number, required: true, min: 1, max: 100, validate: Number.isInteger },
  unidadNivel: { type: String, enum: ["semestre", "anio"], required: true },
  activa: { type: Boolean, default: true },
  lockRevision: { type: Number, default: 0, select: false },
}, { timestamps: true });

careerSchema.pre("validate", function () {
  if (this.nombre) this.nombreNormalizado = normalizedName(this.nombre);
});

function publicCareer(career) {
  return { _id: career._id, nombre: career.nombre, codigo: career.codigo, totalNiveles: career.totalNiveles,
    unidadNivel: career.unidadNivel, activa: career.activa, createdAt: career.createdAt, updatedAt: career.updatedAt };
}

module.exports = { Career: mongoose.model("Career", careerSchema), publicCareer };
