import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, apiMessage } from "../services/api";
import Sidebar from "../components/Sidebar";
import WorkspaceHeader from "../components/WorkspaceHeader";
import { ArrowLeft, LoaderCircle, ShieldCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import { roles } from "../utils/permissions";
import { useNotifications } from "../contexts/notifications";
import { useAuth } from "../contexts/auth";
import FeedbackMessage from "../components/FeedbackMessage";
import PasswordResetDialog from "../components/PasswordResetDialog";

const emptyForm = { nombre: "", email: "", password: "", rol: "coordinador" };
export default function Users() {
  const { notify } = useNotifications();
  const { user: currentUser, refreshCurrentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetUser, setResetUser] = useState(null);
  useEffect(() => {
    let active = true;
    api.get("/users").then(({ data }) => { if (active) setUsers(data); })
      .catch(err => { if (active) setError(apiMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function create(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const { data } = await api.post("/users", form);
      setUsers(current => [data, ...current]); setForm(emptyForm);
      notify({ type: "success", title: "Cuenta creada", message: `La cuenta de ${data.nombre} se creó correctamente. Comparte sus credenciales por un canal seguro.` });
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }
  async function update(user, changes) {
    if (busy) return; setBusy(true); setError("");
    try {
      const { data } = await api.patch(`/users/${user._id}`, changes);
      setUsers(current => current.map(item => item._id === data._id ? data : item));
      notify({ type: "success", title: "Cuenta actualizada", message: "Los cambios se guardaron correctamente y quedaron registrados en auditoría." });
      // Reload current account to apply self-demotion/deactivation immediately.
      if (data._id === currentUser._id) {
        try { await refreshCurrentUser(); }
        catch { notify({ type: "warning", title: "Cambios guardados", message: "La cuenta se actualizó, pero no pudimos refrescar tu sesión. Recarga la página para comprobar el acceso actual." }); }
      }
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }
  return <div className="app-shell"><Sidebar /><div className="main-content">
    <WorkspaceHeader onError={setError} />
    <main className="dashboard-content users-page">
    <Link className="back-link" to="/"><ArrowLeft size={15} />Volver al resumen</Link>
    <div className="users-page-heading"><div><span className="eyebrow">PERSONAS QUE HACEN COMUNIDAD</span><h1>Administración de usuarios</h1><p>El acceso adecuado, para cada integrante de tu equipo.</p></div><span className="admin-access-badge"><ShieldCheck size={17} />Solo administradores</span></div>
    {error && <FeedbackMessage type="error" title="No se pudo completar la operación de usuarios">{error}</FeedbackMessage>}
    <section className="users-summary" aria-label="Resumen de usuarios">
      <div><span>Cuentas registradas</span><strong>{loading ? "…" : users.length}</strong></div>
      <div><span>Usuarios con acceso</span><strong>{loading ? "…" : users.filter(user => user.activo && roles.includes(user.rol)).length}</strong></div>
      <div><span>Administradores activos</span><strong>{loading ? "…" : users.filter(user => user.rol === "administrador" && user.activo).length}</strong></div>
    </section>
    <div className="users-workspace">
    <form className="student-form-card user-form" onSubmit={create} aria-busy={busy}>
      <span className="form-heading-icon"><UserPlus size={22} /></span><span className="eyebrow">SUMA A TU EQUIPO</span><h2>Crear usuario</h2><p className="form-description">Invita a un nuevo integrante a tu espacio académico.</p>
      {[["nombre", "Nombre", "text"], ["email", "Email", "email"], ["password", "Contraseña", "password"]].map(([key, label, type]) =>
        <div className="form-field" key={key}><label htmlFor={`user-${key}`}>{label}</label>
          <input id={`user-${key}`} type={type} required minLength={key === "password" ? 12 : 1} maxLength={key === "email" ? 254 : key === "password" ? 128 : 120}
            placeholder={key === "nombre" ? "Nombres y apellidos" : key === "email" ? "correo@institucion.edu" : "Mínimo 12 caracteres"}
            disabled={busy} aria-describedby={key === "password" ? "user-password-hint" : undefined}
            autoComplete={key === "password" ? "new-password" : "off"} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></div>)}
      <small id="user-password-hint" className="field-hint">Comparte la contraseña solo por un canal seguro.</small>
      <div className="form-field"><label htmlFor="user-role">Rol</label><select id="user-role" disabled={busy} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
        <option value="coordinador">Coordinador académico</option><option value="administrador">Administrador</option></select></div>
      <p className="role-description"><ShieldCheck size={15} />{form.rol === "coordinador" ? "Puede registrar y editar estudiantes; no eliminarlos ni gestionar cuentas o carreras." : "Puede gestionar estudiantes, carreras y cuentas de usuario."}</p>
      <button className="save-student-btn" disabled={busy}><UserPlus size={17} />{busy ? "Guardando…" : "Crear usuario"}</button>
    </form>
    <section className="users-directory" aria-labelledby="users-directory-heading">
    <div className="directory-header"><div className="directory-title"><span className="directory-icon"><UsersIcon size={22} /></span><div><h2 id="users-directory-heading">Tu equipo académico</h2><p>Administra roles y mantén el control de los accesos.</p></div></div></div>
    <p className="users-table-hint">Si no ves todas las acciones, desplaza la tabla horizontalmente. También puedes enfocarla con Tab y usar las flechas.</p>
    {loading ? <p className="loading-inline" role="status"><LoaderCircle size={20} className="spin" />Cargando usuarios…</p> : <div className="student-table-wrapper" tabIndex={0} role="region" aria-label="Tabla de usuarios, desplazamiento horizontal"><table className="student-table users-table">
      <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody>{users.map(user => <tr key={user._id}>
        <td><span className="student-identity"><span className="student-avatar" aria-hidden="true">{user.nombre.charAt(0).toUpperCase()}</span><strong>{user.nombre}</strong></span></td><td>{user.email}</td>
        <td><select aria-label={`Rol de ${user.nombre}`} value={user.rol} disabled={busy} onChange={e => {
          if (window.confirm(`¿Cambiar el rol de ${user.nombre}?`)) update(user, { rol: e.target.value });
        }}>{!roles.includes(user.rol) && <option value={user.rol} disabled>Rol heredado: revisar acceso</option>}<option value="coordinador">Coordinador académico</option><option value="administrador">Administrador</option></select></td>
        <td><span className={`status-badge ${user.activo && roles.includes(user.rol) ? "is-active" : "is-inactive"}`}><span className="status-dot" />{!roles.includes(user.rol) ? "Revisión pendiente" : user.activo ? "Activo" : "Inactivo"}</span></td>
        <td><div className="user-actions"><button className="table-text-btn" disabled={busy} onClick={() => {
          const nombre = window.prompt("Nombre del usuario", user.nombre);
          if (nombre?.trim()) update(user, { nombre: nombre.trim() });
        }}>Editar nombre</button> <button className={`table-text-btn ${user.activo ? "danger-text" : ""}`} disabled={busy} onClick={() => {
          if (window.confirm(`¿${user.activo ? "Desactivar" : "Activar"} a ${user.nombre}?`)) update(user, { activo: !user.activo });
        }}>{user.activo ? "Desactivar" : "Activar"}</button>
        {user._id !== currentUser._id && user.activo && roles.includes(user.rol) && <button className="table-text-btn" disabled={busy} onClick={() => setResetUser(user)}>Restablecer clave</button>}
        {user.must_change_password && <small className="field-hint">Cambio de clave pendiente</small>}</div></td>
      </tr>)}</tbody>
    </table></div>}
    <div className="users-directory-note"><ShieldCheck size={16} /><p>Siempre debe existir al menos un administrador activo. Los cambios de rol o estado se aplican en la siguiente consulta.</p></div>
    </section></div>
    <footer className="workspace-footer"><span>StudentHub · Gestión estudiantil</span><span>Un equipo conectado, una mejor gestión.</span></footer>
  </main></div>{resetUser && <PasswordResetDialog user={resetUser} onClose={() => setResetUser(null)} onReset={updated => setUsers(current => current.map(item => item._id === updated._id ? updated : item))} />}</div>;
}
