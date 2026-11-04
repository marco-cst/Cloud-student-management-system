import { beforeEach, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import StudentDirectory from "../components/StudentDirectory";
import StudentForm from "../components/StudentForm";
import { api, setCsrfToken } from "../services/api";
import { academicCareers, sampleStudent as sample } from "./academicFixtures";

vi.mock("../services/api", async importOriginal => {
  const original = await importOriginal();
  return { ...original, api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }, setCsrfToken: vi.fn() };
});
const coordinator = { _id: "coordinator", nombre: "Coordinador Ficticio", rol: "coordinador" };
const admin = { _id: "admin", nombre: "Admin Ficticio", rol: "administrador" };

beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({}, "", "/"); });

test("visitor is redirected to login; wrong credentials display an error", async () => {
  api.get.mockRejectedValue({ response: { status: 401 } });
  api.post.mockRejectedValue({ response: { status: 401 } });
  render(<App />);
  await screen.findByRole("button", { name: "Iniciar sesión" });
  expect(window.location.pathname).toBe("/login");
  await userEvent.type(screen.getByLabelText("Email"), "wrong@example.test");
  await userEvent.type(screen.getByLabelText("Contraseña"), "wrong");
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas");
});

test("login opens dashboard, real name and role are shown, logout removes access", async () => {
  api.get.mockImplementation(url => url === "/auth/me" ? Promise.reject({ response: { status: 401 } }) : Promise.resolve({ data: url === "/careers" ? academicCareers : [sample] }));
  api.post.mockImplementation(url => Promise.resolve(url === "/auth/login" ? { data: { user: coordinator, csrfToken: "csrf-test" } } : {}));
  render(<App />);
  await screen.findByRole("button", { name: "Iniciar sesión" });
  await userEvent.type(screen.getByLabelText("Email"), "coordinator@example.test");
  await userEvent.type(screen.getByLabelText("Contraseña"), "Fictitious-password!");
  await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  expect(await screen.findByRole("heading", { name: /Bienvenido\/a, Coordinador Ficticio/ })).toBeInTheDocument();
  expect(setCsrfToken).toHaveBeenCalledWith("csrf-test");
  expect(screen.getAllByRole("button", { name: /Agregar estudiante/ })).toHaveLength(2);
  expect(await screen.findByTitle("Editar estudiante")).toBeInTheDocument();
  expect(screen.queryByTitle("Eliminar estudiante")).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Usuarios" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
  expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  expect(screen.queryByText(sample.name)).not.toBeInTheDocument();
});

test("admin sees write controls; expired session removes dashboard and student data", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: admin, csrfToken: "csrf-test" } : url === "/careers" ? academicCareers : [sample] }));
  render(<App />);
  await screen.findByText(sample.name);
  expect(screen.getByRole("link", { name: "Usuarios" })).toBeInTheDocument();
  expect(screen.getByTitle("Editar estudiante")).toBeInTheDocument();
  expect(screen.getByTitle("Eliminar estudiante")).toBeInTheDocument();
  window.dispatchEvent(new Event("session-expired"));
  expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  expect(screen.queryByText(sample.name)).not.toBeInTheDocument();
});

test("coordinator cannot open users route", async () => {
  window.history.replaceState({}, "", "/users");
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: coordinator, csrfToken: "csrf-test" } : [] }));
  render(<App />);
  await screen.findByRole("heading", { name: /Bienvenido\/a/ });
  expect(window.location.pathname).toBe("/");
  expect(api.get).not.toHaveBeenCalledWith("/users");
});

test("directory search, combined filters and pagination preserve behavior", async () => {
  const students = Array.from({ length: 7 }, (_, index) => ({ ...sample, _id: String(index), studentId: `TEST${index}`, name: `Ficticio ${index}`, nivelAcademico: index === 6 ? 2 : 1, careerId: academicCareers[index === 6 ? 1 : 0]._id, career: academicCareers[index === 6 ? 1 : 0] }));
  const { container } = render(<StudentDirectory students={students} careers={academicCareers} />);
  expect(screen.getAllByRole("row")).toHaveLength(6);
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  expect(screen.getByText("Ficticio 6")).toBeInTheDocument();
  const search = screen.getByRole("textbox", { name: "Buscar en el directorio" });
  await userEvent.type(search, "Ficticio 6");
  await userEvent.keyboard("{Enter}");
  expect(screen.getAllByRole("row")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
  await userEvent.clear(search);
  await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
  const [course, year] = within(container).getAllByRole("combobox");
  await userEvent.selectOptions(course, academicCareers[1]._id);
  await userEvent.selectOptions(year, "2");
  expect(screen.getByText("Ficticio 6")).toBeInTheDocument();
  expect(screen.queryByText("Ficticio 0")).not.toBeInTheDocument();
  await userEvent.selectOptions(year, "1");
  expect(screen.getByText("No se encontraron estudiantes")).toBeInTheDocument();
});

test("edit submits only allowed student fields and shows forbidden errors", async () => {
  api.put.mockRejectedValue({ response: { status: 403, data: { message: "Permiso denegado" } } });
  render(<StudentForm editingStudent={sample} careers={academicCareers} onClose={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  expect(api.put.mock.calls[0][1]).not.toHaveProperty("_id");
  expect(api.put.mock.calls[0][1]).not.toHaveProperty("createdAt");
  expect(await screen.findByRole("alert")).toHaveTextContent("Permiso denegado");
});

test("top search and Ctrl+K are functional", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: coordinator, csrfToken: "csrf-test" } : url === "/careers" ? academicCareers : [sample] }));
  render(<App />);
  await screen.findByText(sample.name);
  await userEvent.keyboard("{Control>}k{/Control}");
  const search = screen.getByRole("textbox", { name: "Buscar en todos los estudiantes" });
  expect(search).toHaveFocus();
  await userEvent.type(search, "nonexistent");
  expect(screen.getByText("No se encontraron estudiantes")).toBeInTheDocument();
  await userEvent.clear(search);
  expect(screen.getByText(sample.name)).toBeInTheDocument();
});

test("academic login toggles password visibility and explains institutional access", async () => {
  api.get.mockRejectedValue({ response: { status: 401 } });
  render(<App />);
  await screen.findByRole("heading", { name: "Bienvenido de nuevo." });
  expect(screen.getByRole("heading", { name: /Menos gestión/ })).toBeInTheDocument();
  const password = screen.getByLabelText("Contraseña");
  await userEvent.type(password, "No-se-comparte-123");
  expect(password).toHaveAttribute("type", "password");
  await userEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
  expect(password).toHaveAttribute("type", "text");
  expect(password).toHaveValue("No-se-comparte-123");
  await userEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
  expect(password).toHaveAttribute("type", "password");
  await userEvent.click(screen.getByRole("button", { name: "¿Necesitas ayuda para ingresar?" }));
  expect(screen.getByText(/Contacta al administrador de tu institución/)).toBeVisible();
  expect(screen.getByRole("dialog", { name: "Ayuda para ingresar" })).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "¿Necesitas ayuda para ingresar?" })).toHaveFocus();
});

test("clear filters resets both directory filters and the top search", async () => {
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: coordinator, csrfToken: "csrf-test" } : url === "/careers" ? academicCareers : [sample] }));
  render(<App />);
  await screen.findByText(sample.name);
  await userEvent.type(screen.getByRole("textbox", { name: "Buscar en todos los estudiantes" }), "missing");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filtrar por carrera" }), academicCareers[1]._id);
  await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
  expect(screen.getByText(sample.name)).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Buscar en todos los estudiantes" })).toHaveValue("");
  expect(screen.getByRole("combobox", { name: "Filtrar por carrera" })).toHaveValue("");
});

test("student dialog traps keyboard focus, closes with Escape and restores scroll", async () => {
  const close = vi.fn();
  const { unmount } = render(<StudentForm careers={academicCareers} onClose={close} />);
  expect(screen.getByRole("dialog")).toHaveAccessibleName("Un nuevo comienzo.");
  expect(screen.getByLabelText("ID del estudiante")).toHaveFocus();
  expect(document.body.style.overflow).toBe("hidden");
  screen.getByRole("button", { name: "Agregar estudiante" }).focus();
  await userEvent.tab();
  expect(screen.getByRole("button", { name: "Cerrar formulario" })).toHaveFocus();
  await userEvent.tab({ shift: true });
  expect(screen.getByRole("button", { name: "Agregar estudiante" })).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(close).toHaveBeenCalledOnce();
  unmount();
  expect(document.body.style.overflow).toBe("");
});

test("coordinator cannot access career administration even with a direct URL", async () => {
  window.history.replaceState({}, "", "/careers");
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: coordinator, csrfToken: "csrf-test" } : [] }));
  render(<App />);
  await screen.findByRole("heading", { name: /Bienvenido\/a/ });
  expect(window.location.pathname).toBe("/");
  expect(screen.queryByRole("link", { name: "Carreras" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Administración de carreras" })).not.toBeInTheDocument();
});

test("administrator creates, edits and deactivates a career without removing history", async () => {
  const career = { _id: "career-test", nombre: "Computación", codigo: "COM", totalNiveles: 8, unidadNivel: "semestre", activa: true };
  window.history.replaceState({}, "", "/careers");
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: admin, csrfToken: "csrf-test" } : [] }));
  api.post.mockResolvedValue({ data: career });
  render(<App />);
  await screen.findByRole("heading", { name: "Administración de carreras" });
  expect(await screen.findByText("Aún no hay carreras registradas")).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Nombre de la carrera"), "Computación");
  await userEvent.type(screen.getByLabelText("Código"), "COM");
  await userEvent.type(screen.getByLabelText("Total de niveles"), "8");
  await userEvent.click(screen.getByRole("button", { name: "Crear carrera" }));
  expect(api.post).toHaveBeenCalledWith("/careers", { nombre: "Computación", codigo: "COM", totalNiveles: 8, unidadNivel: "semestre" });
  const row = screen.getByRole("row", { name: /Computación/ });
  expect(row).toHaveTextContent("8 semestres");
  await userEvent.click(within(row).getByRole("button", { name: "Editar carrera" }));
  expect(screen.getByLabelText("Nombre de la carrera")).toHaveFocus();
  api.patch.mockResolvedValue({ data: { ...career, totalNiveles: 10 } });
  await userEvent.clear(screen.getByLabelText("Total de niveles"));
  await userEvent.type(screen.getByLabelText("Total de niveles"), "10");
  await userEvent.click(screen.getByRole("button", { name: "Guardar carrera" }));
  expect(await screen.findByText("10 semestres")).toBeInTheDocument();
  api.patch.mockResolvedValue({ data: { ...career, totalNiveles: 10, activa: false } });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
  await userEvent.click(within(row).getByRole("button", { name: "Desactivar" }));
  expect(api.patch).toHaveBeenLastCalledWith("/careers/career-test/status", { activa: false });
  expect(await within(row).findByText("Inactiva")).toBeInTheDocument();
  confirm.mockRestore();
});

test("student form uses full career names, configurable levels and clears level when career changes", async () => {
  render(<StudentForm careers={academicCareers} onClose={vi.fn()} />);
  expect(screen.getByRole("option", { name: "Computación" })).toHaveValue(academicCareers[0]._id);
  expect(screen.getByLabelText("Nivel académico")).toBeDisabled();
  await userEvent.selectOptions(screen.getByLabelText("Carrera"), academicCareers[0]._id);
  expect(within(screen.getByLabelText("Nivel académico")).getAllByRole("option")).toHaveLength(10);
  await userEvent.selectOptions(screen.getByLabelText("Nivel académico"), "9");
  await userEvent.selectOptions(screen.getByLabelText("Carrera"), academicCareers[1]._id);
  expect(screen.getByLabelText("Nivel académico")).toHaveValue("");
  expect(within(screen.getByLabelText("Nivel académico")).getAllByRole("option")).toHaveLength(5);
  expect(screen.getByRole("option", { name: "Año 4" })).toBeInTheDocument();
});

test("no active careers blocks creation and inactive historical assignment remains available only to its owner", () => {
  const inactive = academicCareers.map(career => ({ ...career, activa: false }));
  const { unmount } = render(<StudentForm careers={inactive} onClose={vi.fn()} />);
  expect(screen.getByText("Sin carreras activas")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Agregar estudiante" })).toBeDisabled();
  unmount();
  render(<StudentForm careers={inactive} editingStudent={sample} onClose={vi.fn()} />);
  expect(screen.getByText("Asignación histórica")).toBeInTheDocument();
  expect(screen.getByLabelText("Carrera")).toHaveValue(sample.careerId);
  expect(screen.queryByRole("option", { name: /Gestión administrativa/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar cambios" })).not.toBeDisabled();
});

test("temporary session is redirected from an admin route and cannot navigate the workspace", async () => {
  window.history.replaceState({}, "", "/users");
  api.get.mockResolvedValue({ data: { user: { ...admin, must_change_password: true }, csrfToken: "csrf-test" } });
  render(<App />);
  expect(await screen.findByRole("heading", { name: "Crea tu nueva contraseña" })).toBeInTheDocument();
  expect(window.location.pathname).toBe("/change-password");
  expect(api.get).not.toHaveBeenCalledWith("/users");
  expect(screen.queryByRole("link", { name: "Resumen" })).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Clave temporal"), "Temporary-password-123!");
  await userEvent.type(screen.getByLabelText("Nueva contraseña", { exact: true }), "Private-new-password-456!");
  await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "Does-not-match-789!");
  await userEvent.click(screen.getByRole("button", { name: "Guardar nueva contraseña" }));
  expect(screen.getByRole("alert")).toHaveTextContent("no coinciden");
  expect(api.post).not.toHaveBeenCalled();
});

test("successful password change clears the session and returns to login", async () => {
  window.history.replaceState({}, "", "/change-password");
  api.get.mockResolvedValue({ data: { user: { ...coordinator, must_change_password: true }, csrfToken: "csrf-test" } });
  api.post.mockResolvedValue({ status: 204 });
  render(<App />);
  await screen.findByRole("heading", { name: "Crea tu nueva contraseña" });
  await userEvent.type(screen.getByLabelText("Clave temporal"), "Temporary-password-123!");
  await userEvent.type(screen.getByLabelText("Nueva contraseña", { exact: true }), "Private-new-password-456!");
  await userEvent.type(screen.getByLabelText("Confirmar nueva contraseña"), "Private-new-password-456!");
  await userEvent.click(screen.getByRole("button", { name: "Guardar nueva contraseña" }));
  expect(await screen.findByRole("heading", { name: "Bienvenido de nuevo." })).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith("/auth/change-password", { currentPassword: "Temporary-password-123!", newPassword: "Private-new-password-456!" });
  expect(setCsrfToken).toHaveBeenLastCalledWith("");
});

test("admin reset confirms identity and forgets the displayed temporary key on close", async () => {
  window.history.replaceState({}, "", "/users");
  const target = { ...coordinator, activo: true, email: "coord@example.test" };
  api.get.mockImplementation(url => Promise.resolve({ data: url === "/auth/me" ? { user: admin, csrfToken: "csrf-test" } : [target] }));
  api.post.mockResolvedValue({ data: { user: { ...target, must_change_password: true }, temporaryPassword: "Fictitious-temporary-password-123!", expiresAt: "2026-11-04T12:00:00Z" } });
  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: "Restablecer clave" }));
  expect(screen.getByRole("dialog", { name: "Restablecer clave" })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Tu contraseña de administrador"), "Admin-password-123!");
  await userEvent.click(screen.getByRole("button", { name: "Generar clave temporal" }));
  expect(await screen.findByLabelText("Clave temporal")).toHaveValue("Fictitious-temporary-password-123!");
  expect(api.post).toHaveBeenCalledWith(`/users/${target._id}/reset-password`, { adminPassword: "Admin-password-123!" });
  await userEvent.click(screen.getByRole("button", { name: "Ya la entregué, cerrar" }));
  expect(screen.queryByDisplayValue("Fictitious-temporary-password-123!")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restablecer clave" })).toHaveFocus();
});
