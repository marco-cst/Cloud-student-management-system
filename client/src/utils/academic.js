export function levelLabel(career, level) {
  if (!level) return "Por asignar";
  return `${career?.unidadNivel === "anio" ? "Año" : "Semestre"} ${level}`;
}
export function careerLevels(career) {
  return Array.from({ length: career?.totalNiveles || 0 }, (_, index) => index + 1);
}
