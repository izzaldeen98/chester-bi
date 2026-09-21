import { NavLink, useNavigate } from "react-router-dom";
import { RiHomeLine, RiLogoutBoxLine } from "react-icons/ri";
import { MdOutlineCloud, MdAutoAwesome } from "react-icons/md";
import { FaFileAlt, FaUser, FaKey, FaBars } from "react-icons/fa";
import { GoPackage } from "react-icons/go";
import { HiSun, HiMoon } from "react-icons/hi";
import { clearToken, getUser } from "../lib/auth";
import { useTheme } from "../lib/theme";
import CLogo from "./CLogo";

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

/* Ordered as the work runs, so the product's one path is legible from the
   navigation alone: connect a source, model it, then ask. */
const pipeline: NavItem[] = [
  { label: "Overview", path: "/home", icon: <RiHomeLine size={15} /> },
  { label: "Connections", path: "/connections", icon: <MdOutlineCloud size={15} /> },
  { label: "Models", path: "/models", icon: <GoPackage size={14} /> },
  { label: "Artifacts", path: "/artifacts", icon: <MdAutoAwesome size={15} /> },
];

const workspace: NavItem[] = [
  { label: "Files", path: "/files", icon: <FaFileAlt size={13} /> },
  { label: "AI Providers", path: "/settings/ai-providers", icon: <FaKey size={12} /> },
  { label: "Users", path: "/users", icon: <FaUser size={12} /> },
];

const NARROW = "(max-width: 900px)";

export default function CSiderBar({
  onOpenPalette,
  collapsed,
  setCollapsed,
}: {
  onOpenPalette?: () => void;
  collapsed: boolean;
  setCollapsed: (fn: (c: boolean) => boolean) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const user = getUser();

  function renderItem(item: NavItem) {
    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        onClick={() => {
          if (window.matchMedia(NARROW).matches) setCollapsed(() => true);
        }}
        className="mx-2 flex items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-[7px] text-[13.5px] transition-colors"
        style={({ isActive }) => ({
          background: isActive ? "var(--surface-3)" : "transparent",
          color: isActive ? "var(--text)" : "var(--text-2)",
          fontWeight: isActive ? 500 : 400,
        })}
      >
        {({ isActive }) => (
          <>
            <span className="shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--text-3)" }}>
              {item.icon}
            </span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </>
        )}
      </NavLink>
    );
  }

  return (
    <aside
      className={`relative flex shrink-0 flex-col transition-[width] duration-200 ${
        collapsed ? "rail-collapsed" : "rail-overlay"
      }`}
      style={{
        width: collapsed ? 56 : 208,
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
      }}
    >
      <div className="flex shrink-0 items-center gap-2 px-3 py-3.5">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="shrink-0 rounded-[var(--r-sm)] p-1.5 transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: "var(--text-3)" }}
        >
          <FaBars size={13} />
        </button>
        {!collapsed && (
          <>
            <CLogo size={18} />
            <span className="text-[14px] font-semibold tracking-[-0.02em]" style={{ color: "var(--text)" }}>
              Chester
            </span>
          </>
        )}
      </div>

      {/* Search doubles as the palette trigger — the fastest way around. */}
      {!collapsed && onOpenPalette && (
        <button
          type="button"
          onClick={onOpenPalette}
          className="mx-2 mb-2 flex items-center gap-2 rounded-[var(--r-sm)] px-2.5 py-[7px] text-[13px] transition-colors hover:bg-[var(--surface-2)]"
          style={{ background: "var(--surface-2)", color: "var(--text-3)", border: "1px solid var(--border)" }}
        >
          <span className="flex-1 text-left">Search…</span>
          <kbd
            className="mono rounded-[4px] px-1 py-0.5 text-[10px]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-3)" }}
          >
            ⌘K
          </kbd>
        </button>
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-2">
        {pipeline.map(renderItem)}
        <div className="mx-4 my-2.5 h-px shrink-0" style={{ background: "var(--border)" }} />
        {workspace.map(renderItem)}
      </nav>

      <div className="shrink-0 px-2 py-2" style={{ borderTop: "1px solid var(--border)" }}>
        {!collapsed && user && (
          <div className="mb-1 flex items-center gap-2 px-2.5 py-1.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              {(user.first_name?.[0] ?? user.username?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px]" style={{ color: "var(--text-2)" }}>
              {user.first_name ?? user.username}
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-[7px] text-[13px] transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: "var(--text-2)" }}
          aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}
        >
          <span className="shrink-0" style={{ color: "var(--text-3)" }}>
            {theme === "dark" ? <HiSun size={15} /> : <HiMoon size={15} />}
          </span>
          {!collapsed && <span>{theme === "dark" ? "Light" : "Dark"}</span>}
        </button>

        <button
          type="button"
          onClick={() => {
            clearToken();
            navigate("/login");
          }}
          className="flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-2.5 py-[7px] text-[13px] transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: "var(--text-2)" }}
        >
          <span className="shrink-0" style={{ color: "var(--text-3)" }}>
            <RiLogoutBoxLine size={15} />
          </span>
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
