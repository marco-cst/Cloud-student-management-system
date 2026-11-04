import { beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import ConfirmDialog from "../components/ConfirmDialog";
import FeedbackMessage from "../components/FeedbackMessage";
import StudentForm from "../components/StudentForm";
import NotificationProvider from "../contexts/NotificationProvider";
import { useNotifications } from "../contexts/notifications";
import { api, apiMessage } from "../services/api";
import { academicCareers } from "./academicFixtures";
import AuditAction from "../components/AuditAction";

vi.mock("../services/api", async importOriginal => ({ ...(await importOriginal()), api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }, setCsrfToken: vi.fn() }));
const admin = { _id: "admin", nombre: "Admin Ficticio", rol: "administrador" };
const sample = { _id: "student", studentId: "UX001", name: "Alumno Ficticio", email: "student@example.test", phone: "+593999999999", careerId: academicCareers[0]._id, career: academicCareers[0], nivelAcademico: 1 };
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

test("feedback communicates success/error/info/warning using text, icons and live semantics", () => {
  render(<><FeedbackMessage type="success">Guardado</FeedbackMessage><FeedbackMessage type="error">No se pudo guardar</FeedbackMessage><FeedbackMessage type="info">Orientación</FeedbackMessage><FeedbackMessage type="warning">Revisar datos</FeedbackMessage></>);
  expect(screen.getByRole("alert")).toHaveClass("feedback-error");
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo completar");
  expect(screen.getAllByRole("status")).toHaveLength(3);
  expect(screen.getByText("Guardado").closest("[role=status]")).toHaveClass("feedback-success");
});

test("audit actions retain meaningful text and icons across semantic colors and unknown actions", () => {
  const { container } = render(<>
    <AuditAction action="LOGIN_SUCCESS" label="Inicio de sesión" />
    <AuditAction action="LOGIN_FAILURE" label="Intento rechazado" />
    <AuditAction action="STUDENT_UPDATE" label="Estudiante actualizado" />
    <AuditAction action="PASSWORD_RESET" label="Clave temporal emitida" />
    <AuditAction action="LOGOUT" label="Cierre de sesión" />
    <AuditAction action="FUTURE_ACTION" />
    <AuditAction action="USER_CREATE" label="Creación denegada" denied />
  </>);
  expect(screen.getByText("Inicio de sesión").closest(".audit-action")).toHaveClass("audit-action-success");
  expect(screen.getByText("Intento rechazado").closest(".audit-action")).toHaveClass("audit-action-danger");
  expect(screen.getByText("Estudiante actualizado").closest(".audit-action")).toHaveClass("audit-action-info");
  expect(screen.getByText("Clave temporal emitida").closest(".audit-action")).toHaveClass("audit-action-warning");
  expect(screen.getByText("Cierre de sesión").closest(".audit-action")).toHaveClass("audit-action-neutral");
  expect(screen.getByText("FUTURE_ACTION").closest(".audit-action")).toHaveClass("audit-action-neutral");
  expect(screen.getByText("Creación denegada").closest(".audit-action")).toHaveClass("audit-action-danger");
  expect(container.querySelectorAll('.audit-action svg[aria-hidden="true"]')).toHaveLength(7);
});

test("notifications can be dismissed with fade without moving keyboard focus", async () => {
  function Trigger() { const { notify } = useNotifications(); return <button onClick={() => notify({ type: "success", title: "Listo", message: "Registro guardado" })}>Mostrar aviso</button>; }
  render(<NotificationProvider><Trigger /></NotificationProvider>);
  await userEvent.click(screen.getByRole("button", { name: "Mostrar aviso" }));
  expect(screen.getByRole("status")).toHaveTextContent("Registro guardado");
  expect(screen.getByRole("button", { name: "Mostrar aviso" })).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Cerrar notificación: Listo" }));
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
});

test("failed delete keeps the dialog open, permits retry and starts on the safe action", async () => {
  const confirm = vi.fn().mockRejectedValueOnce({ response: { status: 503, data: { message: "Servicio temporalmente no disponible" } } }).mockResolvedValueOnce();
  const close = vi.fn();
  render(<ConfirmDialog title="¿Eliminar registro?" onConfirm={confirm} onClose={close}>Esta acción no se puede deshacer.</ConfirmDialog>);
  expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Servicio temporalmente no disponible");
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledOnce();
});

test("validation associates errors with fields and retains values for correction", async () => {
  api.put.mockRejectedValue({ response: { status: 400, data: { fields: ["phone"] } } });
  render(<StudentForm editingStudent={sample} careers={academicCareers} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("teléfono");
  expect(screen.getByLabelText("Teléfono")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByLabelText("Teléfono")).toHaveAttribute("aria-describedby", "student-save-error");
  expect(screen.getByLabelText("Teléfono")).toHaveValue(sample.phone);
  expect(screen.getByLabelText("Nombre completo")).toHaveValue(sample.name);
});

test("audit supports admin filtering, local times, pagination and empty state", async () => {
  window.history.replaceState({}, "", "/audit");
  const event = { _id: "event", accion: "LOGIN_SUCCESS", actorNombre: "Persona registrada", actorRol: "administrador", actorTipo: "usuario", fecha: "2026-11-02T12:30:00.000Z", recurso: "sesion", resultado: "exito" };
  api.get.mockImplementation((url, options) => Promise.resolve({ data: url === "/auth/me" ? { user: admin, csrfToken: "csrf" } : { items: options?.params?.actor ? [] : [event], total: options?.params?.actor ? 0 : 21, actions: { LOGIN_SUCCESS: "Inicio de sesión" } } }));
  render(<App />);
  const table = await screen.findByRole("table");
  expect(within(table).getByText("Persona registrada")).toBeInTheDocument();
  expect(table.querySelector("time")).toHaveAttribute("datetime", event.fecha);
  expect(screen.getByText(/Los filtros Desde\/Hasta usan días UTC/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(api.get).toHaveBeenLastCalledWith("/audit-events", { params: { page: 2, limit: 20 } });
  await screen.findByRole("table");
  await userEvent.type(screen.getByLabelText("Nombre del usuario"), "Sin coincidencias");
  await userEvent.click(screen.getByRole("button", { name: "Buscar actividad" }));
  expect(await screen.findByText("No hay eventos para estos filtros")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Desde (UTC)"), { target: { value: "2026-12-31" } });
  fireEvent.change(screen.getByLabelText("Hasta (UTC)"), { target: { value: "2026-01-01" } });
  await userEvent.click(screen.getByRole("button", { name: "Buscar actividad" }));
  expect(screen.getByRole("alert")).toHaveTextContent("no puede ser posterior");
});

test("coordinator cannot see or open audit administration", async () => {
  window.history.replaceState({}, "", "/audit");
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: { ...admin, rol: "coordinador" }, csrfToken: "csrf" } : [] }));
  render(<App />);
  await screen.findByRole("heading", { name: /Bienvenido\/a/ });
  expect(screen.queryByRole("link", { name: "Auditoría" })).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith("/audit-events", expect.anything());
});

test("API explanations distinguish rate limits, validation and uncertain network results", () => {
  expect(apiMessage({ response: { status: 429, headers: { "retry-after": "90" } } })).toContain("2 minutos");
  expect(apiMessage({ response: { status: 400, data: { fields: ["email"] } } })).toContain("email válido");
  expect(apiMessage({})).toContain("No recibimos confirmación");
});

test("saving disables fields and repeated submission until the server confirms", async () => {
  let complete;
  api.put.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const close = vi.fn();
  render(<StudentForm editingStudent={sample} careers={academicCareers} onClose={close} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
  expect(screen.getByLabelText("Nombre completo")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  expect(close).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Guardando…" }));
  expect(api.put).toHaveBeenCalledTimes(1);
  await act(async () => { complete({ data: sample }); });
  expect(close).toHaveBeenCalledOnce();
});
