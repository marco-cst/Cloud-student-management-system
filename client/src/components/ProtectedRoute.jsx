import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/auth";
import SessionLoading from "./SessionLoading";
import { roles } from "../utils/permissions";

export default function ProtectedRoute({ adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoading />;
  if (!user || !roles.includes(user.rol)) return <Navigate to="/login" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  if (adminOnly && user.rol !== "administrador") return <Navigate to="/" replace />;
  return <Outlet />;
}
