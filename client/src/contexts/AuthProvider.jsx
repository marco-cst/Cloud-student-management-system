import { useEffect, useState } from "react";
import { AuthContext } from "./auth";
import { api, apiMessage, setCsrfToken } from "../services/api";
import { useNotifications } from "./notifications";

export default function AuthProvider({ children }) {
  const { notify } = useNotifications();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const expired = () => { setUser(null); setError("La sesión expiró. Inicia sesión de nuevo."); };
    const restricted = () => setUser(current => current ? { ...current, must_change_password: true } : current);
    window.addEventListener("password-change-required", restricted);
    window.addEventListener("session-expired", expired);
    api.get("/auth/me").then(({ data }) => {
      if (active) { setUser(data.user); setCsrfToken(data.csrfToken); setError(""); }
    }).catch(err => {
      if (active && err.response?.status !== 401) setError(apiMessage(err));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; window.removeEventListener("session-expired", expired); window.removeEventListener("password-change-required", restricted); };
  }, []);
  async function login(email, password) {
    const { data } = await api.post("/auth/login", { email, password });
    setCsrfToken(data.csrfToken);
    setUser(data.user);
    setError("");
    notify({ type: "success", title: "Sesión iniciada", message: data.user.must_change_password ? "Crea una nueva contraseña para acceder al portal." : `Bienvenido/a, ${data.user.nombre}. Ya puedes utilizar tu espacio de trabajo.` });
  }
  async function logout() {
    await api.post("/auth/logout");
    setCsrfToken("");
    setUser(null);
    setError("");
    notify({ type: "info", title: "Sesión cerrada", message: "Tu sesión se cerró correctamente. Para volver a consultar datos debes iniciar sesión." });
  }
  async function refreshCurrentUser() {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user); setCsrfToken(data.csrfToken);
    } catch (err) {
      if (err.response?.status !== 401) throw err;
      setUser(null); setCsrfToken(""); setError("Tu cuenta ya no tiene acceso. Contacta al administrador.");
    }
  }
  function passwordChanged() {
    setCsrfToken(""); setUser(null); setError("");
    notify({ type: "success", title: "Contraseña actualizada", message: "Inicia sesión con tu nueva contraseña. Las sesiones anteriores quedaron cerradas." });
  }
  return <AuthContext.Provider value={{ user, loading, error, login, logout, refreshCurrentUser, passwordChanged }}>{children}</AuthContext.Provider>;
}
