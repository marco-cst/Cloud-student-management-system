import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthProvider from "./contexts/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./Dashboard";
import Users from "./pages/Users";
import Careers from "./pages/Careers";
import Audit from "./pages/Audit";
import NotificationProvider from "./contexts/NotificationProvider";
import ChangePassword from "./pages/ChangePassword";

export default function App() {
  return <NotificationProvider><BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/change-password" element={<ChangePassword />} />
    <Route element={<ProtectedRoute />}><Route path="/" element={<Dashboard />} /></Route>
    <Route element={<ProtectedRoute adminOnly />}><Route path="/users" element={<Users />} /><Route path="/careers" element={<Careers />} /><Route path="/audit" element={<Audit />} /></Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter></NotificationProvider>;
}
