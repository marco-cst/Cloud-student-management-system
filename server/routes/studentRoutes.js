const express = require("express");
const mongoose = require("mongoose");
const Student = require("../models/Student");
const { authorize } = require("../middleware/security");
const { validate, validateId, studentInput } = require("../middleware/validation");
const router = express.Router();
const { appendAudit } = require("../services/audit");
const { saveStudent, publicStudent, CAREER_FIELDS } = require("../services/students");

router.get("/", async (req, res) => {
  const students = await Student.find().sort({ createdAt: -1, _id: -1 }).populate({ path: "careerId", select: CAREER_FIELDS });
  res.json(students.map(publicStudent));
});
router.get("/:id", validateId, async (req, res) => {
  const student = await Student.findById(req.params.id).populate({ path: "careerId", select: CAREER_FIELDS });
  if (!student) return res.status(404).json({ message: "Estudiante no encontrado" });
  res.json(publicStudent(student));
});
router.post("/", authorize("administrador", "coordinador"), validate(studentInput), async (req, res) => {
  const result = await saveStudent(req.body, null, req.user);
  res.status(result.status).json(result.body);
});
router.put("/:id", authorize("administrador", "coordinador"), validateId, validate(studentInput), async (req, res) => {
  const result = await saveStudent(req.body, req.params.id, req.user);
  res.status(result.status).json(result.body);
});
router.delete("/:id", authorize("administrador"), validateId, async (req, res) => {
  const student = await mongoose.connection.transaction(async session => {
    const removed = await Student.findByIdAndDelete(req.params.id, { session });
    if (removed) await appendAudit({ user: req.user, accion: "STUDENT_DELETE", recurso: "estudiante", recursoId: removed._id }, session);
    return removed;
  });
  if (!student) return res.status(404).json({ message: "Estudiante no encontrado" });
  res.status(204).end();
});

module.exports = router;
