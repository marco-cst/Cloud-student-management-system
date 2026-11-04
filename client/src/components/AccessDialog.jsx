import { useEffect, useRef } from "react";

export default function AccessDialog({ title, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="form-overlay"><section ref={ref} tabIndex={-1} className="student-form-card access-dialog" role="dialog" aria-modal="true" aria-labelledby="access-dialog-title" aria-busy={busy} onKeyDown={event => {
    if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); }
    if (event.key !== "Tab") return;
    const elements = [...ref.current.querySelectorAll("button, input, a[href], select, textarea")].filter(el => !el.disabled);
    const first = elements[0], last = elements.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  }}><h2 id="access-dialog-title">{title}</h2>{children}</section></div>;
}
