import { useEffect, useRef, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { api, apiMessage } from "../services/api";
import FeedbackMessage from "./FeedbackMessage";
import { careerLevels, levelLabel } from "../utils/academic";

const API_URL = "/students";

function StudentForm({
  onClose,
  onStudentAdded,
  editingStudent = null,
  onStudentUpdated,
  careers = [],
  careersLoading = false,
}) {
  const [student, setStudent] = useState(
    editingStudent ? Object.fromEntries(["studentId", "name", "email", "phone", "careerId", "nivelAcademico"].map(key => [key, editingStudent[key] ?? ""])) : {
      studentId: "",
      name: "",
      email: "",
      phone: "",
      careerId: "",
      nivelAcademico: "",
    }
  );

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalidFields, setInvalidFields] = useState([]);
  const dialogRef = useRef(null);
  const selectedCareer = careers.find(career => career._id === student.careerId);
  const availableCareers = careers.filter(career => career.activa || career._id === editingStudent?.careerId);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector("input")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  function handleDialogKey(event) {
    if (event.key === "Escape" && !saving) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll("*") || [])
      .filter(control => ["BUTTON", "INPUT", "SELECT"].includes(control.tagName) && !control.disabled && !control.matches(":disabled"));
    if (!controls.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  const handleChange = (e) => {
    setStudent(current => ({ ...current, [e.target.name]: e.target.value,
      ...(e.target.name === "careerId" ? { nivelAcademico: "" } : {}),
    }));

    setError("");
    setInvalidFields(current => current.filter(field => field !== e.target.name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    if (
      !student.studentId ||
      !student.name ||
      !student.email ||
      !student.phone ||
      !student.careerId ||
      !student.nivelAcademico
    ) {
      setError("Completa todos los campos para continuar.");
      return;
    }

    setSaving(true);
    dialogRef.current?.focus();
    setError(""); setInvalidFields([]);
    try {
      const payload = { ...student, nivelAcademico: Number(student.nivelAcademico) };
      if (editingStudent) {
        const id =
          editingStudent._id ||
          editingStudent.id ||
          editingStudent.studentId;

        const response = await api.put(
          `${API_URL}/${id}`,
          payload
        );

        if (onStudentUpdated) {
          onStudentUpdated(response.data);
        }
      } else {
        const response = await api.post(
          API_URL,
          payload
        );

        if (onStudentAdded) {
          onStudentAdded(response.data);
        }
      }

      onClose();
    } catch (err) {
      setError(apiMessage(err));
      setInvalidFields(err.response?.data?.fields || []);
    } finally { setSaving(false); }
  };

  return (
    <div className="form-overlay">
      <section ref={dialogRef} tabIndex={-1} onKeyDown={handleDialogKey} className="student-form-card" role="dialog" aria-modal="true" aria-labelledby="student-form-title">
        <div className="form-header">
          <div>
            <span className="form-eyebrow">
              {editingStudent ? "INFORMACIÓN ESTUDIANTIL" : "NUEVO INGRESO"}
            </span>

            <h2 id="student-form-title">
              {editingStudent
                ? "Editar estudiante"
                : "Un nuevo comienzo."}
            </h2>

            <p>
              {editingStudent
                ? "Mantén los datos de tu estudiante actualizados."
                : "Completa los datos para agregar un estudiante a tu comunidad."}
            </p>
          </div>

          <button
            type="button"
            className="form-close-btn"
            aria-label="Cerrar formulario"
            disabled={saving}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <FeedbackMessage id="student-save-error" type="error" title="No se pudo confirmar el guardado">{error}</FeedbackMessage>
        )}
        {careersLoading ? <FeedbackMessage type="info" title="Consultando carreras">Espera a que termine de cargar el catálogo para seleccionar la carrera y su nivel.</FeedbackMessage> : !availableCareers.length && <FeedbackMessage type="warning" title="Sin carreras activas">El administrador debe crear o activar una carrera antes de registrar estudiantes. No se guardará un estudiante sin carrera válida.</FeedbackMessage>}
        {selectedCareer && !selectedCareer.activa && <FeedbackMessage type="info" title="Asignación histórica">Esta carrera está inactiva. Puedes conservar la asignación existente, pero no asignarla a nuevos estudiantes.</FeedbackMessage>}

        <p className="field-hint" id="student-form-help">Todos los campos son obligatorios. Revisa el ID antes de guardar: debe ser único. Si hay un error, conservaremos tus datos para corregirlos.</p>
        <form onSubmit={handleSubmit} aria-busy={saving} aria-describedby="student-form-help">
          <fieldset disabled={saving} className="form-fieldset">
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="student-id">ID del estudiante</label>

              <input
                type="text"
                name="studentId"
                aria-invalid={invalidFields.includes("studentId")}
                aria-describedby={invalidFields.includes("studentId") ? "student-save-error" : undefined}
                id="student-id" required maxLength={50}
                placeholder="Ej. EST001"
                value={student.studentId}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-name">Nombre completo</label>

              <input
                type="text"
                name="name"
                aria-invalid={invalidFields.includes("name")}
                aria-describedby={invalidFields.includes("name") ? "student-save-error" : undefined}
                id="student-name" required maxLength={120}
                placeholder="Nombres y apellidos"
                value={student.name}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-email">Email</label>

              <input
                type="email"
                name="email"
                aria-invalid={invalidFields.includes("email")}
                aria-describedby={invalidFields.includes("email") ? "student-save-error" : undefined}
                id="student-email" required maxLength={254}
                placeholder="student@example.com"
                value={student.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-phone">Teléfono</label>

              <input
                type="tel"
                name="phone"
                aria-invalid={invalidFields.includes("phone")}
                aria-describedby={invalidFields.includes("phone") ? "student-save-error" : undefined}
                id="student-phone" required minLength={7} maxLength={25}
                placeholder="Ej. +593 999 999 999"
                value={student.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-field">
              <label htmlFor="student-career">Carrera</label>

              <select
                name="careerId"
                aria-invalid={invalidFields.includes("careerId")}
                aria-describedby={invalidFields.includes("careerId") ? "student-save-error" : "career-duration-help"}
                id="student-career" required
                value={student.careerId}
                onChange={handleChange}
              >
                <option value="">Selecciona una carrera</option>
                {availableCareers.map(career => <option key={career._id} value={career._id}>{career.nombre}{!career.activa ? " (inactiva, historial)" : ""}</option>)}
              </select>
              <small className="field-hint" id="career-duration-help">{selectedCareer ? `${selectedCareer.nombre}: ${selectedCareer.totalNiveles} ${selectedCareer.unidadNivel === "anio" ? "años" : "semestres"}.` : "Elige primero una carrera para ver sus niveles disponibles."}</small>
            </div>

            <div className="form-field">
              <label htmlFor="student-level">Nivel académico</label>

              <select
                name="nivelAcademico"
                aria-invalid={invalidFields.includes("nivelAcademico")}
                aria-describedby={invalidFields.includes("nivelAcademico") ? "student-save-error" : "career-duration-help"}
                id="student-level" required disabled={!selectedCareer}
                value={student.nivelAcademico}
                onChange={handleChange}
              >
                <option value="">{selectedCareer ? "Selecciona un nivel" : "Selecciona primero una carrera"}</option>
                {careerLevels(selectedCareer).map(level => <option key={level} value={level}>{levelLabel(selectedCareer, level)}</option>)}
              </select>
            </div>
          </div>

          </fieldset>
          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || careersLoading || !availableCareers.length}
              className="save-student-btn"
            >
              <UserPlus size={18} />

              {saving ? "Guardando…" : editingStudent
                ? "Guardar cambios"
                : "Agregar estudiante"}
            </button>
          </div>
          {saving && <p className="field-hint" role="status">Guardando en el servidor. Espera la confirmación; no cierres ni repitas el envío.</p>}
        </form>
      </section>
    </div>
  );
}

export default StudentForm;
