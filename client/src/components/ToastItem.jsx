import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import FeedbackMessage from "./FeedbackMessage";

export default function ToastItem({ item, onRemove }) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(document.hidden);
  const [exiting, setExiting] = useState(false);
  const remaining = useRef(item.durationMs);
  useEffect(() => {
    const change = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    if (focused || hidden || exiting) return;
    const start = performance.now();
    const timer = setTimeout(() => { remaining.current = 0; setExiting(true); }, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (performance.now() - start));
    };
  }, [focused, hidden, exiting]);
  useEffect(() => {
    if (!exiting) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(() => onRemove(item.id), reduced ? 0 : 240);
    return () => clearTimeout(timer);
  }, [exiting, item.id, onRemove]);
  return <div className={`notification-item${exiting ? " notification-exit" : ""}`} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <FeedbackMessage type={item.type} title={item.title}>{item.message}</FeedbackMessage>
    <button type="button" className="notification-close" aria-label={`Cerrar notificación: ${item.title || "Información"}`} onClick={() => setExiting(true)}><X size={16} /></button>
  </div>;
}
