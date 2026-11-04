import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import NotificationProvider from "../contexts/NotificationProvider";
import { useNotifications } from "../contexts/notifications";

function Trigger() {
  const { notify } = useNotifications();
  return <button onClick={() => notify({ type: "success", title: "Listo", message: "Registro guardado", durationMs: 1000 })}>Notificar</button>;
}
function start() { render(<NotificationProvider><Trigger /></NotificationProvider>); fireEvent.click(screen.getByRole("button", { name: "Notificar" })); }
function advance(ms) { act(() => vi.advanceTimersByTime(ms)); }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "performance"] });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("notices auto-expire through fade and then leave the DOM", () => {
  start(); advance(999);
  expect(screen.getByRole("status").closest(".notification-item")).not.toHaveClass("notification-exit");
  advance(1);
  expect(screen.getByRole("status").closest(".notification-item")).toHaveClass("notification-exit");
  advance(239); expect(screen.getByRole("status")).toBeInTheDocument();
  advance(1); expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("notices have no pause toolbar and still expire when the pointer rests on them", () => {
  start(); advance(400);
  expect(screen.queryByRole("button", { name: /Pausar|Reanudar/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("button")).toHaveLength(2);
  fireEvent.mouseEnter(screen.getByRole("status").closest(".notification-item"));
  advance(600); expect(screen.getByRole("status").closest(".notification-item")).toHaveClass("notification-exit");
  advance(240); expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("keyboard focus and hidden tabs pause automatic dismissal", () => {
  let hidden = false;
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  start(); advance(200);
  hidden = true; fireEvent(document, new Event("visibilitychange"));
  advance(5000); expect(screen.getByRole("status")).toBeInTheDocument();
  hidden = false; fireEvent(document, new Event("visibilitychange"));
  act(() => screen.getByRole("button", { name: "Cerrar notificación: Listo" }).focus());
  advance(5000); expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => screen.getByRole("button", { name: "Notificar" }).focus());
  advance(800); advance(240);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("reduced motion removes without waiting for the animated transition", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  start(); advance(1000); advance(1);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("default reading time is six seconds for a short notice and twelve for a long one", () => {
  function Defaults() {
    const { notify } = useNotifications();
    return <><button onClick={() => notify({ title: "Listo", message: "Guardado" })}>Corto</button><button onClick={() => notify({ title: "Información", message: "Detalle de la operación. ".repeat(30) })}>Largo</button></>;
  }
  render(<NotificationProvider><Defaults /></NotificationProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Corto" }));
  fireEvent.click(screen.getByRole("button", { name: "Largo" }));
  advance(5999); expect(screen.getAllByRole("status")).toHaveLength(2);
  advance(1); advance(240);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  advance(5760); advance(240);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
