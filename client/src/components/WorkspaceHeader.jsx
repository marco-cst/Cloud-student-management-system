import { useState } from "react";
import { CalendarDays, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/auth";
import { apiMessage } from "../services/api";
import { roleLabel } from "../utils/permissions";
import { Link } from "react-router-dom";

export default function WorkspaceHeader({ children, onError }) {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const formattedDate = new Date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  return <header className="topbar">
    {children || <div className="workspace-breadcrumb">Área de trabajo <span>/</span> <strong>Usuarios</strong></div>}
    <div className="topbar-right">
      <span className="workspace-date"><CalendarDays size={16} />{formattedDate}</span>
      <span className="role-label"><ShieldCheck size={14} />{roleLabel(user.rol)}</span>
      <Link className="account-password-link" to="/change-password">Cambiar contraseña</Link>
      <button className="logout-btn" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await logout(); } catch (err) { onError?.(apiMessage(err)); }
        finally { setBusy(false); }
      }}><LogOut size={17} aria-hidden="true" /><span>{busy ? "Saliendo…" : "Cerrar sesión"}</span></button>
    </div>
  </header>;
}
