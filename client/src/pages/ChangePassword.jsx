import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/auth";
import { api, apiMessage } from "../services/api";
import Brand from "../components/Brand";
import SessionLoading from "../components/SessionLoading";
import FeedbackMessage from "../components/FeedbackMessage";

export default function ChangePassword() {
  const { user, loading, logout, passwordChanged } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (loading) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace />;
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    if (newPassword !== confirmation) { setError("Las contraseñas nuevas no coinciden."); return; }
    setBusy(true); setError("");
    try { await api.post("/auth/change-password", { currentPassword, newPassword }); passwordChanged(); }
    catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }
  return <main className="password-page"><section className="password-card"><Brand compact /><span className="access-label">SEGURIDAD DE TU CUENTA</span>
    <h1>{user.must_change_password ? "Crea tu nueva contraseña" : "Cambiar contraseña"}</h1>
    <p>{user.must_change_password ? "Tu clave es temporal. Para acceder al portal debes reemplazarla por una contraseña privada." : "Elige una contraseña que solo tú conozcas."} Al guardar, volverás a iniciar sesión y se cerrarán las sesiones anteriores.</p>
    {error && <FeedbackMessage type="error" title="No se pudo cambiar la contraseña">{error}</FeedbackMessage>}
    <form className="password-form" onSubmit={submit} aria-busy={busy}>
      <div className="form-field"><label htmlFor="current-password">{user.must_change_password ? "Clave temporal" : "Contraseña actual"}</label><input id="current-password" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} value={currentPassword} onChange={e => setCurrent(e.target.value)} /></div>
      <div className="form-field"><label htmlFor="new-password">Nueva contraseña</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="new-password-hint" disabled={busy} value={newPassword} onChange={e => setNew(e.target.value)} /><small id="new-password-hint" className="field-hint">Entre 12 y 128 caracteres. Debe ser distinta de la clave actual; usa una frase larga y única.</small></div>
      <div className="form-field"><label htmlFor="confirm-password">Confirmar nueva contraseña</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
      <button className="primary-btn" disabled={busy}>{busy ? "Guardando…" : "Guardar nueva contraseña"}</button>
    </form>{!user.must_change_password && !busy && <Link className="account-password-link password-exit" to="/">Volver al portal</Link>}
    <button className="table-text-btn password-exit" disabled={busy} onClick={async () => { setBusy(true); try { await logout(); } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); } }}>Cerrar sesión</button>
  </section></main>;
}
