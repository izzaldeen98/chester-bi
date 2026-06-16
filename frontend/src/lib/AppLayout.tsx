import { Navigate, Outlet } from "react-router-dom";
import CSiderBar from "../components/CSiderBar";
import { isAuthenticated } from "./auth";

export default function AppLayout() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <CSiderBar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
