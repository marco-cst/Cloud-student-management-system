import { useState } from "react";
import {
  Users,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  LoaderCircle,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog";
import { careerLevels, levelLabel } from "../utils/academic";

function StudentDirectory({
  students = [],
  careers = [],
  onStudentDeleted,
  onEditStudent,
  canEdit = false,
  canDelete = false,
  globalSearch = "",
  onClearGlobalSearch,
  loading = false,
}) {
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingStudent, setDeletingStudent] = useState(null);

  const studentsPerPage = 5;
  const chosenCareer = careers.find(career => career._id === selectedCourse);
  const availableLevels = chosenCareer ? careerLevels(chosenCareer) : [...new Set(students.map(student => student.nivelAcademico).filter(Boolean))].sort((a, b) => a - b);

  const filteredStudents = students.filter((student) => {
    const search = searchTerm.trim().toLowerCase();

    const studentId = String(student.studentId || "").toLowerCase();
    const name = String(student.name || "").toLowerCase();
    const email = String(student.email || "").toLowerCase();
    const careerName = String(student.career?.nombre || "").toLowerCase();

    const fields = [studentId, name, email, careerName];
    const matchesSearch = (!search || fields.some(field => field.includes(search))) &&
      (!globalSearch.trim() || fields.some(field => field.includes(globalSearch.trim().toLowerCase())));

    const matchesCourse =
      !selectedCourse ||
      student.careerId === selectedCourse;

    const matchesYear =
      !selectedYear ||
      String(student.nivelAcademico || "") === selectedYear;

    return matchesSearch && matchesCourse && matchesYear;
  });

  const totalPages = Math.max(
    1,
    Math.ceil(filteredStudents.length / studentsPerPage)
  );

  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * studentsPerPage;

  const displayedStudents = filteredStudents.slice(
    startIndex,
    startIndex + studentsPerPage
  );

  const handleSearch = () => {
    setSearchTerm(searchInput);
    setCurrentPage(1);
  };

  const handleCourseChange = (e) => {
    setSelectedCourse(e.target.value);
    setSelectedYear("");
    setCurrentPage(1);
  };

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
    setCurrentPage(1);
  };

  const handleDelete = (student) => {
    const id = student._id || student.id || student.studentId;

    if (!id) return;

    if (onStudentDeleted) setDeletingStudent(student);
  };

  return (
    <section className="student-directory" aria-labelledby="directory-heading" aria-busy={loading}>
      <div className="directory-header">
        <div className="directory-title">
          <div className="directory-icon">
            <Users size={22} strokeWidth={1.8} />
          </div>

          <div>
            <div className="directory-heading-line"><h2 id="directory-heading">Directorio de estudiantes</h2><span className="count-badge">{loading ? "…" : students.length}</span></div>
            <p>Los datos de tu comunidad, organizados y al día.</p>
          </div>
        </div>

        <div className="directory-filters">
          <SlidersHorizontal size={16} className="filter-icon" aria-hidden="true" />
          <div className="select-wrapper">
            <select
              value={selectedCourse}
              aria-label="Filtrar por carrera"
              onChange={handleCourseChange}
            >
              <option value="">Todas las carreras</option>
              {careers.filter(career => career.activa || students.some(student => student.careerId === career._id)).map(career => <option key={career._id} value={career._id}>{career.nombre}{!career.activa ? " (inactiva)" : ""}</option>)}
            </select>

            <ChevronDown size={16} />
          </div>

          <div className="select-wrapper">
            <select
              value={selectedYear}
              aria-label="Filtrar por nivel"
              onChange={handleYearChange}
            >
              <option value="">Todos los niveles</option>
              {availableLevels.map(level => <option key={level} value={level}>{chosenCareer ? levelLabel(chosenCareer, level) : `Nivel ${level}`}</option>)}
            </select>

            <ChevronDown size={16} />
          </div>
        </div>
      </div>

      <div className="directory-search">
        <div className="directory-search-input">
          <Search size={19} />

          <input
            type="text"
            placeholder="Buscar por nombre, ID, email o carrera..."
            aria-label="Buscar en el directorio"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
          />
        </div>

        <button
          className="directory-search-btn"
          onClick={handleSearch}
        >
          Buscar
        </button>
      </div>

      {(searchTerm || selectedCourse || selectedYear || globalSearch) && <div className="active-filters"><span>{filteredStudents.length} {filteredStudents.length === 1 ? "resultado encontrado" : "resultados encontrados"}</span>
        <button type="button" className="text-btn" onClick={() => {
          setSearchInput(""); setSearchTerm(""); setSelectedCourse(""); setSelectedYear(""); setCurrentPage(1); onClearGlobalSearch?.();
        }}><RotateCcw size={13} />Limpiar filtros</button></div>}

      <p className="table-scroll-hint" id="student-scroll-help">Desliza la tabla para ver todos los datos y acciones. También puedes enfocarla y usar las flechas del teclado.</p>
      <div className="student-table-wrapper" tabIndex={0} role="region" aria-label="Tabla de estudiantes desplazable" aria-describedby="student-scroll-help">
        <table className="student-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>NOMBRE</th>
              <th>EMAIL</th>
              <th>CARRERA</th>
              <th>NIVEL</th>
              <th>TELÉFONO</th>
              {(canEdit || canDelete) && <th>ACCIONES</th>}
            </tr>
          </thead>

          <tbody>
            {loading ? <tr><td colSpan={canEdit || canDelete ? 7 : 6} className="empty-students"><span role="status"><LoaderCircle size={26} className="spin" />Cargando estudiantes…</span></td></tr> : displayedStudents.length > 0 ? (
              displayedStudents.map((student, index) => (
                <tr
                  key={
                    student._id ||
                    student.id ||
                    student.studentId ||
                    index
                  }
                >
                  <td className="student-id">
                    {student.studentId || "—"}
                  </td>

                  <td className="student-name">
                    <span className="student-identity"><span className="student-avatar" aria-hidden="true">{(student.name || "?").trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase()}</span><span>{student.name || "—"}</span></span>
                  </td>

                  <td className="student-email">
                    {student.email || "—"}
                  </td>

                  <td>
                    <span className="career-full-name">{student.career?.nombre || "Pendiente de asignación"}</span>
                    {student.career && !student.career.activa && <small className="field-hint">Carrera inactiva · historial</small>}
                  </td>

                  <td>{levelLabel(student.career, student.nivelAcademico)}</td>

                  <td>{student.phone || "—"}</td>

                  {(canEdit || canDelete) && <td>
                    <div className="table-actions">
                      {canEdit && <button
                        className="edit-btn"
                        title="Editar estudiante"
                        aria-label={`Editar a ${student.name}`}
                        onClick={() => {
                          if (onEditStudent) {
                            onEditStudent(student);
                          }
                        }}
                      >
                        <Pencil size={17} />
                      </button>}

                      {canDelete && <button
                        className="delete-btn"
                        title="Eliminar estudiante"
                        aria-label={`Eliminar a ${student.name}`}
                        onClick={() => handleDelete(student)}
                      >
                        <Trash2 size={17} />
                      </button>}
                    </div>
                  </td>}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={canEdit || canDelete ? 7 : 6}
                  className="empty-students"
                >
                  <Users size={32} />
                  <strong>No se encontraron estudiantes</strong>
                  <span>
                    {students.length ? "Prueba con otro nombre o ajusta los filtros." : "Agrega tu primer estudiante para empezar a construir el directorio."}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="directory-footer">
        <p>
          Mostrando{" "}
          <strong>
            {displayedStudents.length}
          </strong>{" "}
          de{" "}
          <strong>
            {filteredStudents.length}
          </strong>{" "}
          estudiantes
        </p>

        <nav className="pagination" aria-label="Paginación de estudiantes">
          <button
            disabled={safePage === 1}
            onClick={() =>
              setCurrentPage((page) => Math.max(1, page - 1))
            }
          >
            Anterior
          </button>

          {Array.from(
            { length: totalPages },
            (_, index) => index + 1
          ).map((page) => (
            <button
              key={page}
              className={safePage === page ? "active" : ""}
              aria-label={`Página ${page}`}
              aria-current={safePage === page ? "page" : undefined}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}

          <button
            disabled={safePage === totalPages}
            onClick={() =>
              setCurrentPage((page) =>
                Math.min(totalPages, page + 1)
              )
            }
          >
            Siguiente
          </button>
        </nav>
      </div>
      {deletingStudent && <ConfirmDialog title="¿Eliminar este estudiante?" confirmLabel="Eliminar definitivamente" returnFocusId="directory-heading" onClose={() => setDeletingStudent(null)} onConfirm={() => onStudentDeleted(deletingStudent._id || deletingStudent.id || deletingStudent.studentId)}>
        Se eliminará a {deletingStudent.name} (ID: {deletingStudent.studentId}). Esta acción no se puede deshacer desde la plataforma. Si solo deseas corregir información, cancela y utiliza Editar.
      </ConfirmDialog>}
    </section>
  );
}

export default StudentDirectory;
