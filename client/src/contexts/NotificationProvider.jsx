import { useCallback, useMemo, useRef, useState } from "react";
import { NotificationContext } from "./notifications";
import ToastItem from "../components/ToastItem";

export default function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);
  const sequence = useRef(0);
  const notify = useCallback(({ type = "info", title, message, durationMs }) => {
    const id = ++sequence.current;
    const readingTime = Math.max(6000, Math.min(12000, `${title || ""} ${message}`.length * 40));
    const duration = Math.max(1000, Math.min(60000, durationMs ?? readingTime));
    setItems(current => [...current.filter(item => item.message !== message), { id, type, title, message, durationMs: duration }].slice(-3));
    return id;
  }, []);
  const dismiss = useCallback(id => setItems(current => current.filter(item => item.id !== id)), []);
  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);
  return <NotificationContext.Provider value={value}>{children}
    <aside className="notification-stack" aria-label="Notificaciones">
      {items.map(item => <ToastItem key={item.id} item={item} onRemove={dismiss} />)}
    </aside>
  </NotificationContext.Provider>;
}
