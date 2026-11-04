import axios from "axios";

export const api = axios.create({ baseURL: "/api", withCredentials: true });
let csrfToken = "";
export function setCsrfToken(value) { csrfToken = value || ""; }

api.interceptors.request.use(config => {
  if (!["get", "head", "options"].includes(config.method)) {
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});
api.interceptors.response.use(response => response, error => {
  if (error.response?.data?.code === "PASSWORD_CHANGE_REQUIRED") window.dispatchEvent(new Event("password-change-required"));
  if (error.response?.status === 401 && !["/auth/login", "/auth/me"].includes(error.config?.url)) {
    setCsrfToken("");
    window.dispatchEvent(new Event("session-expired"));
  }
  return Promise.reject(error);
});

export function apiMessage(error) {
  if (error.response?.status === 429) {
    const seconds = Number(error.response.headers?.["retry-after"]);
    return `Demasiados intentos. ${seconds > 0 ? `Espera aproximadamente ${Math.ceil(seconds / 60)} minutos` : "Espera unos minutos"} antes de volver a iniciar sesión. No necesitas cambiar tu contraseña.`;
  }
  if (error.response?.status === 400 && error.response.data?.fields?.length) {
    const labels = { studentId: "ID del estudiante", name: "nombre completo", email: "email válido", phone: "teléfono (7–25 caracteres, números y separadores)", careerId: "carrera del catálogo", nivelAcademico: "nivel dentro de la duración de la carrera", nombre: "nombre", rol: "rol", password: "contraseña (12–128 caracteres)", codigo: "código", totalNiveles: "total de niveles (entero entre 1 y 100)", unidadNivel: "unidad académica" };
    const fields = [...new Set(error.response.data.fields.map(field => labels[field]).filter(Boolean))];
    return `Revisa ${fields.length ? fields.join(", ") : "los campos del formulario"}. Conservamos lo que escribiste para que puedas corregirlo.`;
  }
  if (error.response?.status === 401) return "La sesión expiró. Inicia sesión de nuevo.";
  if (error.response?.status === 403) {
    if (/csrf|origen/i.test(error.response.data?.message || "")) return "La sesión no pudo validar esta acción. Conserva los datos que necesites y recarga la página antes de intentarlo otra vez.";
    return error.response.data?.message || "No tienes permisos para esta operación. Solicita ayuda al administrador.";
  }
  if (error.response?.status === 500) return "El servidor no pudo confirmar la operación. Comprueba el listado antes de repetirla y contacta al administrador si el problema continúa.";
  return error.response?.data?.message || "No recibimos confirmación del servidor. Revisa tu conexión y el estado del servicio; comprueba el listado antes de repetir una operación.";
}
