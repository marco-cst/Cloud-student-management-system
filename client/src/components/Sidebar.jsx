import { ArrowUpRight, BookOpen, History, LayoutDashboard, LibraryBig, UserPlus, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../contexts/auth";
import Brand from "./Brand";
import { canEditStudents, roleLabel } from "../utils/permissions";

export default function Sidebar({ onAddStudent }) {
  const { user } = useAuth();
  return <aside className="sidebar">
    <Brand compact />
    <span className="nav-section-label">ESPACIO ACADÉMICO</span>
    <nav className="sidebar-nav" aria-label="Navegación principal">
      <NavLink to="/" title="Resumen" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><LayoutDashboard size={19} /><span>Resumen</span><span className="nav-active-dot" /></NavLink>
      {canEditStudents(user) && onAddStudent && <button className="nav-item" title="Agregar estudiante" onClick={onAddStudent}><UserPlus size={19} /><span>Agregar estudiante</span></button>}
      {user.rol === "administrador" && <>
        <NavLink to="/users" title="Usuarios" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><Users size={19} /><span>Usuarios</span></NavLink>
        <NavLink to="/careers" title="Carreras" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><LibraryBig size={19} /><span>Carreras</span></NavLink>
        <NavLink to="/audit" title="Auditoría" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}><History size={19} /><span>Auditoría</span></NavLink>
      </>}
    </nav>
    <div className="sidebar-note"><BookOpen size={23} /><strong>La educación nos conecta.</strong><p>Todo empieza por conocer mejor a tus estudiantes.</p><span>StudentHub <ArrowUpRight size={15} /></span></div>
    <div className="sidebar-profile"><span className="profile-avatar">{user.nombre.charAt(0).toUpperCase()}</span><div><strong>{user.nombre}</strong><span>{roleLabel(user.rol)}</span></div><span className="status-dot" /></div>
  </aside>;
}
