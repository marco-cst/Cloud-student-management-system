import { createContext, useContext } from "react";
export const NotificationContext = createContext({ notify: () => {}, dismiss: () => {} });
export function useNotifications() { return useContext(NotificationContext); }
