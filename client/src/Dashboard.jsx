import { useEffect, useRef, useState } from "react";
import { api, apiMessage } from "./services/api";
import { useAuth } from "./contexts/auth";

import {
  Search,
  Users,
  UserCheck,
  BookOpen,
  UserPlus,
  UserRoundPlus,
  ArrowUpRight,
  GraduationCap,
} from "lucide-react";

import Sidebar from "./components/Sidebar";
import StatCard from "./components/StatCard";
import StudentDirectory from "./components/StudentDirectory";
import StudentForm from "./components/StudentForm";
import { studentStats } from "./utils/studentStats";
import WorkspaceHeader from "./components/WorkspaceHeader";
import CampusIllustration from "./components/CampusIllustration";
import { canEditStudents, canManageAdministration } from "./utils/permissions";
import { useNotifications } from "./contexts/notifications";
import FeedbackMessage from "./components/FeedbackMessage";

const API_URL = "/students";

function Dashboard() {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const canEdit = canEditStudents(user);
  const canDelete = canManageAdministration(user);
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [students, setStudents] = useState([]);
  const [careers, setCareers] = useState([]);
  const [editingStudent, setEditingStudent] = useState(null);
  const [topSearch, setTopSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadRevision, setLoadRevision] = useState(0);
  const searchRef = useRef(null);
  useEffect(() => {
    const focusSearch = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!document.querySelector('[role="dialog"], [role="alertdialog"]')) searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchStudents = async () => {
      try {
        const [response, catalog] = await Promise.all([api.get(API_URL), api.get("/careers")]);
        if (active) { setStudents(response.data); setCareers(catalog.data); setError(""); }
      } catch (err) {
        if (active) setError(apiMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchStudents();
    return () => { active = false; };
  }, [loadRevision]);

  const handleStudentAdded = (student) => {
    setStudents((currentStudents) => [
      ...currentStudents,
      student,
    ]);

    setError("");
    notify({ type: "success", title: "Estudiante registrado", message: `${student.name} se agregó al directorio. Su información quedó guardada.` });
  };

  const handleStudentDeleted = async (id) => {
    await api.delete(`${API_URL}/${id}`);
    setStudents(currentStudents => currentStudents.filter(student =>
      student._id !== id && student.id !== id && student.studentId !== id
    ));
    setError("");
    notify({ type: "success", title: "Estudiante eliminado", message: "El registro se eliminó correctamente del directorio y la acción quedó auditada." });
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setShowStudentForm(true);
  };

  const handleStudentUpdated = (updatedStudent) => {
    setStudents((currentStudents) =>
      currentStudents.map((student) => {
        const studentId =
          student._id ||
          student.id ||
          student.studentId;

        const updatedId =
          updatedStudent._id ||
          updatedStudent.id ||
          updatedStudent.studentId;

        return studentId === updatedId
          ? updatedStudent
          : student;
      })
    );

    setEditingStudent(null);
    setError("");
    notify({ type: "success", title: "Cambios guardados", message: `La información de ${updatedStudent.name} se actualizó correctamente.` });
  };

  const handleCloseForm = () => {
    setShowStudentForm(false);
    setEditingStudent(null);
  };

  const { total: totalStudents, levels, activeCareers, newThisMonth } = studentStats(students, careers);

  const handleTopSearch = (e) => {
    setTopSearch(e.target.value);
  };

  return (
    <div className="app-shell">
      <Sidebar onAddStudent={() => { setEditingStudent(null); setShowStudentForm(true); }} />

      <div className="main-content">
        <WorkspaceHeader onError={setError}>
          <div className="top-search">
            <Search size={20} />

            <input
              type="text"
              ref={searchRef}
              aria-label="Buscar en todos los estudiantes"
              placeholder="Buscar un estudiante..."
              value={topSearch}
              onChange={handleTopSearch}
            />

            <div className="shortcut">
              <span>Ctrl</span>
              <span>K</span>
            </div>
          </div>
        </WorkspaceHeader>

        <main className="dashboard-content">
          <div className="page-heading"><span className="eyebrow">TU ESPACIO DE TRABAJO</span><span className="workspace-breadcrumb">Gestión estudiantil <span>/</span> <strong>Resumen</strong></span></div>
          <section className="welcome-section">
            <div className="welcome-text">
              <span className="hero-kicker"><GraduationCap size={16} /> CADA ESTUDIANTE CUENTA</span>
              <h1>
                Bienvenido/a, {user.nombre}
              </h1>

              <p>
                Una comunidad mejor organizada empieza aquí. Registra estudiantes y mantén su información al día.
              </p>
            {canEdit && <button
              className="add-student-btn"
              onClick={() => {
                setEditingStudent(null);
                setShowStudentForm(true);
              }}
            >
              <UserRoundPlus size={19} />
              Agregar estudiante <ArrowUpRight size={17} />
            </button>}
            </div>
            <CampusIllustration className="hero-campus" />
          </section>

          {error && (
            <FeedbackMessage type="error" title="No pudimos completar la consulta" onRetry={() => { setLoading(true); setError(""); setLoadRevision(value => value + 1); }}>{error}</FeedbackMessage>
          )}

          <section className="stats-grid" aria-label="Resumen del directorio">
            <StatCard
              icon={<Users size={23} />}
              title="Estudiantes"
              value={loading ? "..." : totalStudents}
              subtitle="En el directorio"
              variant="pink"
            />

            <StatCard
              icon={<UserCheck size={23} />}
              title="Niveles en uso"
              value={loading ? "..." : levels}
              subtitle="Combinaciones de carrera y nivel"
              variant="gold"
            />

            <StatCard
              icon={<BookOpen size={23} />}
              title="Carreras activas"
              value={loading ? "..." : activeCareers}
              subtitle="Disponibles en el catálogo"
              variant="gold"
            />

            <StatCard
              icon={<UserPlus size={23} />}
              title="Nuevos este mes"
              value={loading ? "..." : newThisMonth}
              subtitle="Según la fecha de registro"
              variant="pink"
            />
          </section>

          <StudentDirectory
            students={students}
            careers={careers}
            onStudentDeleted={handleStudentDeleted}
            onEditStudent={handleEditStudent}
            canEdit={canEdit}
            canDelete={canDelete}
            globalSearch={topSearch}
            onClearGlobalSearch={() => setTopSearch("")}
            loading={loading}
          />
          {!loading && !error && students.length > 0 && <section className="course-overview" aria-labelledby="courses-heading">
            <div className="section-heading"><div><span className="eyebrow">PANORAMA ACADÉMICO</span><h2 id="courses-heading">Una comunidad, distintas carreras.</h2></div><span>Distribución del directorio</span></div>
            <div className="course-overview-grid">{careers.filter(career => career.activa || students.some(student => student.careerId === career._id)).map(career => {
              const count = students.filter(student => student.careerId === career._id).length;
              return <div className="course-summary" key={career._id}>
                <div><span className="career-full-name">{career.nombre}{!career.activa ? " (inactiva)" : ""}</span><strong>{count} <small>{count === 1 ? "estudiante" : "estudiantes"}</small></strong></div>
                <meter min={0} max={students.length} value={count} aria-label={`Estudiantes de ${career.nombre}`} />
              </div>;
            })}</div>
          </section>}
          <footer className="workspace-footer"><span>StudentHub · Gestión estudiantil</span><span>Conecta. Organiza. Acompaña.</span></footer>
        </main>

        {showStudentForm && canEdit && (
          <StudentForm
            onClose={handleCloseForm}
            careers={careers}
            careersLoading={loading}
            onStudentAdded={handleStudentAdded}
            editingStudent={editingStudent}
            onStudentUpdated={handleStudentUpdated}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;
