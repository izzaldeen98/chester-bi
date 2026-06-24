import { Navigate, Outlet } from "react-router-dom";
import { isAuthenticated } from "./auth";

export default function FullscreenLayout() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--bg)" }}>
      <Outlet />
    </div>
  );
}
