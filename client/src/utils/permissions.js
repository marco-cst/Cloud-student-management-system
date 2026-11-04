export const roles = ["administrador", "coordinador"];
export function roleLabel(role) {
  return { administrador: "Administrador", coordinador: "Coordinador académico" }[role] || "Acceso pendiente de revisión";
}
export function canEditStudents(user) { return roles.includes(user?.rol); }
export function canManageAdministration(user) { return user?.rol === "administrador"; }
