import { useEffect, useState } from "react";
import { FaBars } from "react-icons/fa";
import { Navigate, Outlet } from "react-router-dom";
import CSiderBar from "../components/CSiderBar";
import CommandPalette from "../components/CommandPalette";
import { isAuthenticated } from "./auth";

const NARROW = "(max-width: 900px)";

export default function AppLayout() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // ⌘K / Ctrl-K anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Narrow screens hide the rail entirely, so the way back has to live
          outside it. */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(() => false)}
          aria-label="Open navigation"
          className="fixed left-3 top-3 z-50 hidden rounded-[var(--r-sm)] p-2 max-[900px]:block"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text-2)",
            boxShadow: "var(--shadow-2)",
          }}
        >
          <FaBars size={14} />
        </button>
      )}

      {!collapsed && (
        <div
          aria-hidden
          onClick={() => setCollapsed(() => true)}
          className="fixed inset-0 z-30 hidden max-[900px]:block"
          style={{ background: "rgba(23,22,20,0.35)" }}
        />
      )}

      <CSiderBar
        onOpenPalette={() => setPaletteOpen(true)}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
