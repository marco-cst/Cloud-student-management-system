import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
const icons = { success: CheckCircle2, error: AlertCircle, info: Info, warning: TriangleAlert };
const titles = { success: "Operación completada", error: "No se pudo completar", info: "Información", warning: "Revisa antes de continuar" };

export default function FeedbackMessage({ type = "info", title, children, onRetry, id }) {
  const Icon = icons[type] || Info;
  return <div id={id} className={`feedback-message feedback-${type}`} role={type === "error" ? "alert" : "status"} aria-atomic="true">
    <Icon size={20} aria-hidden="true" /><div><strong>{title || titles[type]}</strong><p>{children}</p>{onRetry && <button type="button" className="text-btn" onClick={onRetry}>Volver a intentar</button>}</div>
  </div>;
}
