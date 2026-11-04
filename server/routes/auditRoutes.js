const express = require("express");
const { z } = require("../middleware/validation");
const { AuditEvent, ACTION_LABELS } = require("../models/AuditEvent");
const router = express.Router();
const queryInput = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  accion: z.enum(Object.keys(ACTION_LABELS)).optional(),
  resultado: z.enum(["exito", "denegado"]).optional(),
  actor: z.string().trim().max(120).optional(),
  desde: z.iso.date().optional(), hasta: z.iso.date().optional(),
}).strict().refine(data => !data.desde || !data.hasta || data.desde <= data.hasta);

router.get("/", async (req, res) => {
  const parsed = queryInput.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ message: "Revisa los filtros: fechas válidas y página/tamaño dentro del rango permitido" });
  const { page, limit, accion, resultado, actor, desde, hasta } = parsed.data;
  const filter = {};
  if (accion) filter.accion = accion;
  if (resultado) filter.resultado = resultado;
  if (actor) filter.actorNombre = new RegExp(actor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  if (desde || hasta) {
    filter.fecha = {};
    if (desde) filter.fecha.$gte = new Date(`${desde}T00:00:00.000Z`);
    if (hasta) filter.fecha.$lt = new Date(new Date(`${hasta}T00:00:00.000Z`).getTime() + 86400000);
  }
  const [items, total] = await Promise.all([
    AuditEvent.find(filter).sort({ fecha: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditEvent.countDocuments(filter),
  ]);
  res.json({ items, total, page, limit, actions: ACTION_LABELS });
});
module.exports = router;
