import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Info, LoaderCircle, Plus, ShieldCheck } from "lucide-react";
import { api, apiMessage } from "../services/api";
import Sidebar from "../components/Sidebar";
import WorkspaceHeader from "../components/WorkspaceHeader";
import FeedbackMessage from "../components/FeedbackMessage";
import { useNotifications } from "../contexts/notifications";

const emptyForm = { nombre: "", codigo: "", totalNiveles: "", unidadNivel: "semestre" };

export default function Careers() {
  const { notify } = useNotifications();
  const [careers, setCareers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/careers").then(({ data }) => { if (active) setCareers(data); })
      .catch(err => { if (active) setError(apiMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function reset() { setEditingId(null); setForm(emptyForm); }
  function edit(career) {
    setEditingId(career._id);
    setForm({ nombre: career.nombre, codigo: career.codigo, totalNiveles: career.totalNiveles, unidadNivel: career.unidadNivel });
    setError("");
    document.getElementById("career-name")?.focus();
  }
  async function submit(event) {
    event.preventDefault(); if (busy) return; setBusy(true); setError("");
    try {
      const payload = { ...form, totalNiveles: Number(form.totalNiveles) };
      const { data } = editingId ? await api.patch(`/careers/${editingId}`, payload) : await api.post("/careers", payload);
      setCareers(current => editingId ? current.map(item => item._id === data._id ? data : item) : [...current, data]);
      notify({ type: "success", title: editingId ? "Carrera actualizada" : "Carrera creada", message: editingId ? "Los cambios se guardaron correctamente." : "La nueva carrera se agregó al catálogo institucional." });
      reset();
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }
  async function toggle(career) {
    if (!window.confirm(`¿${career.activa ? "Desactivar" : "Activar"} la carrera ${career.nombre}? Los registros históricos se conservan.`)) return;
    if (busy) return; setBusy(true); setError("");
    try {
      const { data } = await api.patch(`/careers/${career._id}/status`, { activa: !career.activa });
      setCareers(current => current.map(item => item._id === data._id ? data : item));
      notify({ type: data.activa ? "success" : "info", title: data.activa ? "Carrera activada" : "Carrera desactivada", message: "El cambio se guardó correctamente. Su información histórica se conserva." });
    } catch (err) { setError(apiMessage(err)); }
    finally { setBusy(false); }
  }

  return <div className="app-shell"><Sidebar /><div className="main-content">
    <WorkspaceHeader onError={setError}><div className="workspace-breadcrumb">Área de trabajo <span>/</span><strong>Carreras</strong></div></WorkspaceHeader>
    <main className="dashboard-content users-page">
      <Link className="back-link" to="/"><ArrowLeft size={15} />Volver al resumen</Link>
      <div className="users-page-heading"><div><span className="eyebrow">CONFIGURACIÓN ACADÉMICA</span><h1>Administración de carreras</h1><p>Define la duración y organiza el catálogo de tu institución.</p></div><span className="admin-access-badge"><ShieldCheck size={17} />Solo administradores</span></div>
      <p className="catalog-migration-note"><Info size={18} /><span><strong>Catálogo conectado al directorio.</strong> Las carreras activas aparecen en el formulario de estudiantes por su nombre completo. Cada una ofrece sus propios años o semestres; desactivarlas conserva sus asignaciones históricas.</span></p>
      {error && <FeedbackMessage type="error" title="No se pudo guardar el cambio de carrera">{error}</FeedbackMessage>}
      <section className="users-summary" aria-label="Resumen de carreras"><div><span>Carreras registradas</span><strong>{loading ? "…" : careers.length}</strong></div><div><span>Activas</span><strong>{loading ? "…" : careers.filter(career => career.activa).length}</strong></div><div><span>Inactivas</span><strong>{loading ? "…" : careers.filter(career => !career.activa).length}</strong></div></section>
      <div className="users-workspace">
        <form className="student-form-card user-form" onSubmit={submit} aria-busy={busy}>
          <span className="form-heading-icon"><BookOpen size={22} /></span><span className="eyebrow">CATÁLOGO INSTITUCIONAL</span><h2>{editingId ? "Editar carrera" : "Nueva carrera"}</h2><p className="form-description">Cada carrera tiene su propia duración y unidad académica.</p>
          <div className="form-field"><label htmlFor="career-name">Nombre de la carrera</label><input id="career-name" required minLength={2} maxLength={120} placeholder="Ej. Computación" disabled={busy} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></div>
          <div className="form-field"><label htmlFor="career-code">Código</label><input id="career-code" required minLength={2} maxLength={16} pattern="[A-Za-z0-9][A-Za-z0-9_\-]{1,15}" placeholder="Ej. COM" disabled={busy} value={form.codigo} onChange={e => setForm({ ...form, codigo: e.target.value })} /></div>
          <div className="form-field"><label htmlFor="career-levels">Total de niveles</label><input id="career-levels" type="number" required min={1} max={100} step={1} placeholder="Ej. 8" disabled={busy} value={form.totalNiveles} onChange={e => setForm({ ...form, totalNiveles: e.target.value })} /></div>
          <div className="form-field"><label htmlFor="career-unit">Unidad académica</label><select id="career-unit" disabled={busy} value={form.unidadNivel} onChange={e => setForm({ ...form, unidadNivel: e.target.value })}><option value="semestre">Semestres</option><option value="anio">Años</option></select></div>
          <small className="field-hint">No reduzcas la duración ni cambies la unidad sin revisar los estudiantes asociados. El servidor protege los datos históricos.</small>
          <button className="save-student-btn" disabled={busy}><Plus size={17} />{busy ? "Guardando…" : editingId ? "Guardar carrera" : "Crear carrera"}</button>
          {editingId && <button className="cancel-btn" type="button" disabled={busy} onClick={reset}>Cancelar edición</button>}
        </form>
        <section className="users-directory" aria-labelledby="career-directory-heading">
          <div className="directory-header"><div className="directory-title"><span className="directory-icon"><BookOpen size={22} /></span><div><h2 id="career-directory-heading">Catálogo de carreras</h2><p>Configura carreras sin eliminar su historial.</p></div></div></div>
          {loading ? <p className="loading-inline" role="status"><LoaderCircle className="spin" size={20} />Cargando carreras…</p> : careers.length === 0 ? <div className="catalog-empty"><BookOpen size={30} /><h3>Aún no hay carreras registradas</h3><p>Crea la primera carrera y define su duración.</p></div> : <div className="student-table-wrapper"><table className="student-table users-table careers-table"><thead><tr><th>Carrera</th><th>Código</th><th>Duración</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{careers.map(career => <tr key={career._id}>
            <td><strong>{career.nombre}</strong></td><td><span className="course-badge">{career.codigo}</span></td><td>{career.totalNiveles} {career.unidadNivel === "anio" ? "años" : "semestres"}</td>
            <td><span className={`status-badge ${career.activa ? "is-active" : "is-inactive"}`}><span className="status-dot" />{career.activa ? "Activa" : "Inactiva"}</span></td>
            <td><div className="user-actions"><button type="button" className="table-text-btn" disabled={busy} onClick={() => edit(career)}>Editar carrera</button><button type="button" className={`table-text-btn ${career.activa ? "danger-text" : ""}`} disabled={busy} onClick={() => toggle(career)}>{career.activa ? "Desactivar" : "Activar"}</button></div></td>
          </tr>)}</tbody></table></div>}
          <div className="users-directory-note"><ShieldCheck size={16} /><p>Las carreras se desactivan, no se eliminan físicamente. Una reducción de niveles incompatible o con estudiantes pendientes de migración será rechazada.</p></div>
        </section>
      </div>
      <footer className="workspace-footer"><span>StudentHub · Gestión administrativa</span><span>Un catálogo ordenado, una mejor gestión.</span></footer>
    </main>
  </div></div>;
}
