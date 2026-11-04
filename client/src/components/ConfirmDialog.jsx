import { useEffect, useRef, useState } from "react";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { apiMessage } from "../services/api";
import FeedbackMessage from "./FeedbackMessage";

export default function ConfirmDialog({ title, children, confirmLabel = "Confirmar", onConfirm, onClose, returnFocusId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("[data-cancel]")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else {
        const fallback = returnFocusId && document.getElementById(returnFocusId);
        if (fallback) { fallback.tabIndex = -1; fallback.focus(); }
      }
    };
  }, [returnFocusId]);
  function keydown(event) {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const elements = Array.from(ref.current.querySelectorAll("button")).filter(item => !item.disabled);
    if (!elements.length) { event.preventDefault(); ref.current.focus(); return; }
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className="form-overlay"><section ref={ref} tabIndex={-1} className="student-form-card confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description" aria-busy={busy} onKeyDown={keydown}>
    <span className="confirm-icon"><TriangleAlert size={25} /></span><h2 id="confirm-title">{title}</h2><p id="confirm-description">{children}</p>
    {error && <FeedbackMessage type="error" title="No se pudo confirmar la eliminación">{error}</FeedbackMessage>}
    <div className="form-actions"><button type="button" data-cancel className="cancel-btn" disabled={busy} onClick={onClose}>Cancelar</button><button type="button" className="danger-btn" disabled={busy} onClick={async () => {
      if (busy) return; setBusy(true); setError("");
      ref.current?.focus();
      try { await onConfirm(); onClose(); } catch (err) { setError(apiMessage(err)); }
      finally { setBusy(false); }
    }}>{busy ? <><LoaderCircle size={17} className="spin" />Eliminando…</> : confirmLabel}</button></div>
    {busy && <p className="field-hint" role="status">Espera la confirmación antes de cerrar o repetir la acción.</p>}
  </section></div>;
}
