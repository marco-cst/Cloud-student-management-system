import { useEffect, useState } from "react";
import { ArrowLeft, History, LoaderCircle, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiMessage } from "../services/api";
import { roleLabel } from "../utils/permissions";
import Sidebar from "../components/Sidebar";
import WorkspaceHeader from "../components/WorkspaceHeader";
import FeedbackMessage from "../components/FeedbackMessage";
import AuditAction from "../components/AuditAction";

const emptyFilters = { actor: "", accion: "", resultado: "", desde: "", hasta: "" };
export default function Audit() {
  const [filters, setFilters] = useState(emptyFilters);
  const [query, setQuery] = useState({ page: 1, limit: 20 });
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0, actions: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    let active = true;
    api.get("/audit-events", { params: query }).then(({ data }) => {
      if (active) { setResult(data); setError(""); setUpdatedAt(new Date()); }
    }).catch(err => { if (active) setError(apiMessage(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, revision]);
  function reload() { setLoading(true); setError(""); setRevision(value => value + 1); }
  function apply(event) {
    event.preventDefault();
    if (filters.desde && filters.hasta && filters.desde > filters.hasta) {
      setError("La fecha Desde no puede ser posterior a Hasta. Corrige el rango y vuelve a buscar."); return;
    }
    setLoading(true); setError("");
    setQuery({ page: 1, limit: 20, ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim())) });
  }
  const totalPages = Math.max(1, Math.ceil(result.total / query.limit));
  return <div className="app-shell"><Sidebar /><div className="main-content">
    <WorkspaceHeader onError={setError}><div className="workspace-breadcrumb">Área de trabajo <span>/</span><strong>Auditoría</strong></div></WorkspaceHeader>
    <main className="dashboard-content users-page">
      <Link to="/" className="back-link"><ArrowLeft size={15} />Volver al resumen</Link>
      <div className="users-page-heading"><div><span className="eyebrow">TRAZABILIDAD ADMINISTRATIVA</span><h1>Auditoría del sistema</h1><p>Conoce qué se hizo, quién lo realizó y en qué momento.</p></div><span className="admin-access-badge"><ShieldCheck size={17} />Solo administradores</span></div>
      <FeedbackMessage type="info" title="Cómo leer este registro">Se muestran eventos desde que se habilitó la auditoría, no acciones anteriores. Las horas se presentan en tu zona: {timezone}. Los filtros Desde/Hasta usan días UTC. Los intentos fallidos no se atribuyen a un usuario autenticado.</FeedbackMessage>
      <section className="audit-panel" aria-labelledby="audit-filters-title">
        <h2 id="audit-filters-title">Buscar actividad</h2>
        <form className="audit-filters" onSubmit={apply} aria-busy={loading}>
          <div className="form-field"><label htmlFor="audit-actor">Nombre del usuario</label><input id="audit-actor" maxLength={120} placeholder="Buscar por nombre" value={filters.actor} onChange={e => setFilters({ ...filters, actor: e.target.value })} /></div>
          <div className="form-field"><label htmlFor="audit-action">Acción</label><select id="audit-action" value={filters.accion} onChange={e => setFilters({ ...filters, accion: e.target.value })}><option value="">Todas las acciones</option>{Object.entries(result.actions || {}).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div className="form-field"><label htmlFor="audit-result">Resultado</label><select id="audit-result" value={filters.resultado} onChange={e => setFilters({ ...filters, resultado: e.target.value })}><option value="">Todos</option><option value="exito">Completado</option><option value="denegado">Denegado</option></select></div>
          <div className="form-field"><label htmlFor="audit-from">Desde (UTC)</label><input id="audit-from" type="date" value={filters.desde} onChange={e => setFilters({ ...filters, desde: e.target.value })} /></div>
          <div className="form-field"><label htmlFor="audit-to">Hasta (UTC)</label><input id="audit-to" type="date" value={filters.hasta} onChange={e => setFilters({ ...filters, hasta: e.target.value })} /></div>
          <div className="audit-filter-actions"><button className="save-student-btn" disabled={loading}><Search size={16} />Buscar actividad</button><button className="cancel-btn" type="button" disabled={loading} onClick={() => { setFilters(emptyFilters); setQuery({ page: 1, limit: 20 }); setError(""); setLoading(true); }}>Limpiar filtros</button></div>
        </form>
      </section>
      {error && <FeedbackMessage type="error" title="No se pudo consultar la actividad" onRetry={reload}>{error}</FeedbackMessage>}
      <section className="users-directory audit-directory" aria-labelledby="audit-title" aria-busy={loading}>
        <div className="directory-header"><div className="directory-title"><span className="directory-icon"><History size={22} /></span><div><h2 id="audit-title">Registro de actividad</h2><p>{loading ? "Consultando registros…" : `${result.total} eventos encontrados`}{updatedAt && !loading ? ` · Última consulta ${updatedAt.toLocaleTimeString("es")}` : ""}</p></div></div><button type="button" className="directory-search-btn" disabled={loading} onClick={reload}><RefreshCw size={14} /> Actualizar registros</button></div>
        <ul className="audit-legend" aria-label="Guía de colores de acciones"><li><span className="legend-dot tone-success" />Ingresos y altas</li><li><span className="legend-dot tone-info" />Actualizaciones</li><li><span className="legend-dot tone-warning" />Cambios sensibles</li><li><span className="legend-dot tone-danger" />Rechazos y eliminaciones</li></ul>
        {!loading && !error && result.items.length > 0 && <p className="table-scroll-hint" id="audit-scroll-help">Desliza la tabla hacia los lados para ver acción, recurso y resultado. Con teclado, enfoca la tabla y utiliza las flechas.</p>}
        {loading ? <p className="loading-inline" role="status"><LoaderCircle size={22} className="spin" />Cargando auditoría…</p> : !error && (result.items.length ? <div className="student-table-wrapper" tabIndex={0} role="region" aria-label="Tabla de auditoría desplazable" aria-describedby="audit-scroll-help"><table className="student-table audit-table"><thead><tr><th>Fecha y hora local</th><th>Quién</th><th>Acción</th><th>Recurso</th><th>Resultado</th></tr></thead><tbody>{result.items.map(item => <tr key={item._id}>
          <td><time dateTime={item.fecha} title={`UTC: ${new Date(item.fecha).toISOString()}`}><strong>{new Date(item.fecha).toLocaleDateString("es", { dateStyle: "medium" })}</strong><small>{new Date(item.fecha).toLocaleTimeString("es")}</small></time></td>
          <td><strong>{item.actorNombre}</strong><small>{item.actorTipo === "usuario" ? roleLabel(item.actorRol) : item.actorTipo === "mantenimiento" ? "Mantenimiento autorizado" : "No autenticado"}</small></td>
          <td><AuditAction action={item.accion} label={result.actions?.[item.accion]} denied={item.resultado === "denegado"} />{item.cantidad !== undefined && <small>{item.cantidad} registros procesados</small>}</td>
          <td><span className="audit-resource">{item.recurso}</span>{item.recursoId && <small className="audit-resource-id" title={item.recursoId}>ID: {item.recursoId}</small>}</td>
          <td><span className={`audit-outcome outcome-${item.resultado}`}>{item.resultado === "exito" ? "✓ Completado" : "! Denegado"}</span></td>
        </tr>)}</tbody></table></div> : <div className="catalog-empty"><History size={30} /><h3>No hay eventos para estos filtros</h3><p>Prueba con otro rango o limpia los filtros. No se inventa actividad histórica.</p></div>)}
        {!loading && !error && <div className="directory-footer"><p>Página {query.page} de {totalPages} · {result.total} registros</p><nav className="pagination" aria-label="Paginación de auditoría"><button disabled={query.page <= 1} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page - 1 }); }}>Anterior</button><button disabled={query.page >= totalPages} onClick={() => { setLoading(true); setQuery({ ...query, page: query.page + 1 }); }}>Siguiente</button></nav></div>}
      </section>
      <footer className="workspace-footer"><span>Registro de solo lectura · No incluye contraseñas ni tokens</span><span>StudentHub · Gestión administrativa</span></footer>
    </main>
  </div></div>;
}
