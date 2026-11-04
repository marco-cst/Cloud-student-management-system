const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    careerId: { type: mongoose.Schema.Types.ObjectId, ref: "Career", required: true },
    nivelAcademico: { type: Number, required: true, min: 1, max: 100, validate: Number.isInteger },
  },
  {
    timestamps: true,
  }
);
studentSchema.index({ careerId: 1, nivelAcademico: 1 });

module.exports = mongoose.model("Student", studentSchema);
