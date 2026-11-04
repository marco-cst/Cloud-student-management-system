const mongoose = require("mongoose");
const { z } = require("zod");
const { USER_ROLES } = require("../policies/roles");

const email = z.email().trim().toLowerCase().max(254);
const password = z.string().min(12).max(128);
const role = z.enum(USER_ROLES);
const studentInput = z.object({
  studentId: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(120),
  email,
  phone: z.string().trim().regex(/^\+?[\d ()-]{7,25}$/),
  careerId: z.string().refine(value => mongoose.isObjectIdOrHexString(value)),
  nivelAcademico: z.number().int().min(1).max(100),
}).strict();

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ message: "Datos inválidos", fields: result.error.issues.map(i => i.path.join(".")) });
    req.body = result.data;
    next();
  };
}

function validateId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ message: "Identificador inválido" });
  next();
}

module.exports = { z, email, password, role, studentInput, validate, validateId };
