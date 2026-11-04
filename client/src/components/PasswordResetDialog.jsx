import { useState } from "react";
import { api, apiMessage } from "../services/api";
import AccessDialog from "./AccessDialog";
import FeedbackMessage from "./FeedbackMessage";

export default function PasswordResetDialog({ user, onClose, onReset }) {
  const [adminPassword, setAdminPassword] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      const { data } = await api.post(`/users/${user._id}/reset-password`, { adminPassword });
      setAdminPassword(""); setResult(data); onReset(data.user);
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }
  return <AccessDialog title={result ? "Clave temporal generada" : "Restablecer clave"} busy={busy} onClose={onClose}>
    <p>Cuenta: <strong>{user.nombre}</strong> · {user.email}</p>
    {result ? <>
      <FeedbackMessage type="warning" title="Se muestra solo esta vez">Entrégala por un canal privado después de verificar la identidad de la persona. No la guardes en capturas ni mensajes públicos.</FeedbackMessage>
      <div className="form-field"><label htmlFor="temporary-password">Clave temporal</label><input id="temporary-password" readOnly value={result.temporaryPassword} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></div>
      <p>Vence el {new Date(result.expiresAt).toLocaleString("es")}. Al ingresar deberá crear una contraseña nueva. Las sesiones anteriores quedaron invalidadas.</p>
      <button className="primary-btn" onClick={onClose}>Ya la entregué, cerrar</button>
    </> : <form className="password-form" onSubmit={submit}>
      <p>Se invalidarán sus sesiones y su contraseña actual. La clave temporal vencerá en 24 horas y solo permitirá crear una contraseña nueva.</p>
      {error && <FeedbackMessage type="error" title="No se pudo restablecer">{error}</FeedbackMessage>}
      <div className="form-field"><label htmlFor="reset-admin-password">Tu contraseña de administrador</label><input id="reset-admin-password" type="password" autoComplete="current-password" required maxLength={128} value={adminPassword} disabled={busy} onChange={e => setAdminPassword(e.target.value)} /></div>
      <div className="form-actions"><button type="button" className="cancel-btn" disabled={busy} onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={busy}>{busy ? "Generando…" : "Generar clave temporal"}</button></div>
    </form>}
  </AccessDialog>;
}
