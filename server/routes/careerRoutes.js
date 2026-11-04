const express = require("express");
const { Career, publicCareer } = require("../models/Career");
const { authorize } = require("../middleware/security");
const { z, validate, validateId } = require("../middleware/validation");
const { changeCareer } = require("../services/careers");
const mongoose = require("mongoose");
const { appendAudit } = require("../services/audit");

const router = express.Router();
const careerInput = z.object({
  nombre: z.string().trim().min(2).max(120).transform(value => value.replace(/\s+/g, " ")),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9_-]{1,15}$/),
  totalNiveles: z.number().int().min(1).max(100),
  unidadNivel: z.enum(["semestre", "anio"]),
}).strict();

router.get("/", async (req, res) => {
  const parsed = z.object({ activa: z.enum(["true", "false"]).optional() }).strict().safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Filtro de carreras inválido" });
  const filter = parsed.data.activa === undefined ? {} : { activa: parsed.data.activa === "true" };
  res.json((await Career.find(filter).sort({ nombre: 1 })).map(publicCareer));
});
router.get("/:id", validateId, async (req, res) => {
  const career = await Career.findById(req.params.id);
  if (!career) return res.status(404).json({ message: "Carrera no encontrada" });
  res.json(publicCareer(career));
});
router.post("/", authorize("administrador"), validate(careerInput), async (req, res) => {
  const career = await mongoose.connection.transaction(async session => {
    const [created] = await Career.create([req.body], { session });
    await appendAudit({ user: req.user, accion: "CAREER_CREATE", recurso: "carrera", recursoId: created._id, campos: Object.keys(req.body) }, session);
    return created;
  });
  res.status(201).json(publicCareer(career));
});
router.patch("/:id/status", authorize("administrador"), validateId, validate(z.object({ activa: z.boolean() }).strict()), async (req, res) => {
  const result = await changeCareer(req.params.id, req.body, req.user);
  res.status(result.status).json(result.body);
});
router.patch("/:id", authorize("administrador"), validateId, validate(careerInput.partial().refine(value => Object.keys(value).length > 0)), async (req, res) => {
  const result = await changeCareer(req.params.id, req.body, req.user);
  res.status(result.status).json(result.body);
});

module.exports = router;
