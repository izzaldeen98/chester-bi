import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { GiJesterHat } from "react-icons/gi";
import { RiHomeLine, RiLogoutBoxLine } from "react-icons/ri";
import { MdDashboard, MdOutlineCloud } from "react-icons/md";
import { PiFileSqlFill } from "react-icons/pi";
import { FaFileAlt, FaUser, FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { GoPackage } from "react-icons/go";
import { clearToken } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { HiSun, HiMoon } from "react-icons/hi";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: "Home",        path: "/home",        icon: <RiHomeLine size={18} /> },
  { label: "Dashboards",   path: "/dashboard",   icon: <MdDashboard size={18} /> },
  { label: "Queries",       path: "/queries",       icon: <PiFileSqlFill size={18} /> },
  { label: "Files",       path: "/files",       icon: <FaFileAlt size={17} /> },
  { label: "Connections", path: "/connections", icon: <MdOutlineCloud size={18} /> },
  { label: "Packages",    path: "/packages",    icon: <GoPackage size={18} /> },
  { label: "Users",       path: "/users",       icon: <FaUser size={16} /> },
  { label: "Workspace",   path: "/workspace",   icon: <FaUser size={16} /> },
];

export default function CSiderBar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    clearToken();
    navigate("/login");
  }
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="relative flex h-screen flex-shrink-0 flex-col transition-all duration-200"
      style={{
        width: collapsed ? 64 : 220,
        background: "var(--bg-subtle)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <GiJesterHat
          size={26}
          className="shrink-0"
          style={{ color: "var(--accent)" }}
        />
        {!collapsed && (
          <span
            className="truncate text-base font-bold tracking-tight"
            style={{ color: "var(--text-h)" }}
          >
            Chester <span style={{ color: "var(--accent)" }}>BI</span>
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text)] hover:bg-[var(--accent-muted)] hover:text-[var(--accent)]"
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 mx-3 my-2">
        <span className={`text-xs font-medium ${collapsed ? "sr-only" : ""}`}>
          {theme === "dark" ? "Dark mode" : "Light mode"}
        </span>
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="rounded-full p-2"
        >
          {theme === "dark" ? <HiSun size={20} /> : <HiMoon size={20} />}
        </button>
      </div>
 
   
      <div style={{ borderTop: "1px solid var(--border)" }} className="py-3">
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          style={{ color: "var(--text)" }}
        >
          <RiLogoutBoxLine size={18} className="shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:brightness-105"
        style={{
          background: "var(--accent)",
          color: "var(--accent-fg)",
          border: "2px solid var(--bg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {collapsed ? <FaArrowRight size={9} /> : <FaArrowLeft size={9} />}
      </button>
    </aside>
  );
}
