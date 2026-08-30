import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdDashboard, MdOutlineCloud, MdOpenInNew } from "react-icons/md";
import { GoPackage } from "react-icons/go";
import { FaUser } from "react-icons/fa";
import { FaArrowRight, FaPlus } from "react-icons/fa6";
import CLogo from "../components/CLogo";
import {
  getDashboards,
  getConnections,
  getModels,
  getUsers,
  type DashboardPublicResponse,
  type ConnectionPublicResponse,
} from "../lib/Api";
import { getUser } from "../lib/auth";

// ── Helpers ────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "var(--border)" }}
    />
  );
}

// ── Metric card ───────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  href: string;
  loading: boolean;
  accent?: boolean;
}

function MetricCard({ label, value, icon, href, loading, accent }: MetricCardProps) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(href)}
      className="group flex w-full flex-col gap-3 rounded-2xl p-5 text-left transition-all"
      style={{
        background: accent ? "var(--accent-muted)" : "var(--bg-subtle)",
        border: `1px solid ${accent ? "var(--accent-ring)" : "var(--border)"}`,
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-ring)";
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = accent ? "var(--accent-ring)" : "var(--border)";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
        >
          {icon}
        </span>
        <FaArrowRight
          size={12}
          className="opacity-0 transition-opacity group-hover:opacity-60"
          style={{ color: "var(--accent)" }}
        />
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <p className="text-3xl font-extrabold tabular-nums" style={{ color: "var(--text-h)" }}>
          {value ?? 0}
        </p>
      )}
      <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
        {label}
      </p>
    </button>
  );
}

// ── Connection badge ───────────────────────────────────────────────────────
function ConnectionRow({ conn }: { conn: ConnectionPublicResponse }) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase"
        style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
      >
        {conn.type?.slice(0, 2) ?? "DB"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" style={{ color: "var(--text-h)" }}>{conn.name}</p>
        <p className="truncate text-xs capitalize" style={{ color: "var(--text)" }}>{conn.type}</p>
      </div>
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
      >
        active
      </span>
    </div>
  );
}

// ── Dashboard row ──────────────────────────────────────────────────────────
function DashboardRow({ d, onView }: { d: DashboardPublicResponse; onView: () => void }) {
  return (
    <li
      className="group flex items-center gap-3 py-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-ring)" }}
      >
        <MdDashboard size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--text-h)" }}>{d.name}</p>
        <p className="truncate text-xs" style={{ color: "var(--text)" }}>{d.description || "No description"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-xs sm:block" style={{ color: "var(--text)" }}>
          {timeAgo(d.updated_at)}
        </span>
        <button
          onClick={onView}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
        >
          View <MdOpenInNew size={11} />
        </button>
      </div>
    </li>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const user = getUser();

  const [dashboards, setDashboards] = useState<DashboardPublicResponse[] | null>(null);
  const [connections, setConnections] = useState<ConnectionPublicResponse[] | null>(null);
  const [modelCount, setModelCount] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const results = await Promise.allSettled([
        getDashboards(),
        getConnections(),
        getModels(),
        getUsers(),
      ]);

      if (cancelled) return;

      const errs: string[] = [];

      if (results[0].status === "fulfilled") setDashboards(results[0].value);
      else errs.push("dashboards");

      if (results[1].status === "fulfilled") setConnections(results[1].value);
      else setConnections([]);

      if (results[2].status === "fulfilled") setModelCount(results[2].value.length);
      else setModelCount(0);

      if (results[3].status === "fulfilled") setUserCount(results[3].value.length);
      else setUserCount(0);

      setErrors(errs);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []);

  const sortedDashboards = dashboards
    ? [...dashboards].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    : [];

  const firstName = user?.first_name ?? user?.username ?? "back";

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>
            Welcome back, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
            {user?.account_name
              ? `${user.account_name} · ${user.role}`
              : "Chester BI workspace"}
          </p>
        </div>

        <button
          onClick={() => navigate("/workspace")}
          className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={{
            background: "var(--accent)",
            color: "var(--bg)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <FaPlus size={12} /> New Dashboard
        </button>
      </div>

      {/* Error banner */}
      {errors.length > 0 && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--error-muted, #fee2e2)", color: "var(--error, #ef4444)", border: "1px solid var(--error-ring, #fca5a5)" }}
        >
          Could not load some data: {errors.join(", ")}. Check your connection.
        </div>
      )}

      {/* Metric cards */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Dashboards"
          value={dashboards?.length ?? null}
          icon={<MdDashboard size={20} />}
          href="/dashboard"
          loading={loading}
        />
        <MetricCard
          label="Connections"
          value={connections?.length ?? null}
          icon={<MdOutlineCloud size={20} />}
          href="/connections"
          loading={loading}
        />
        <MetricCard
          label="Models"
          value={modelCount}
          icon={<GoPackage size={19} />}
          href="/models"
          loading={loading}
        />
        <MetricCard
          label="Team Members"
          value={userCount}
          icon={<FaUser size={17} />}
          href="/users"
          loading={loading}
        />
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Recent dashboards */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--text-h)" }}>
              Recent Dashboards
            </h2>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              View all <FaArrowRight size={10} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : sortedDashboards.length === 0 ? (
            <div
              className="flex flex-col items-center gap-3 rounded-xl py-12 text-center"
              style={{ border: "1px dashed var(--border)" }}
            >
              <CLogo size={32} style={{ opacity: 0.4 }} />
              <p className="text-sm" style={{ color: "var(--text)" }}>
                No dashboards yet.{" "}
                <button
                  onClick={() => navigate("/workspace")}
                  className="font-semibold transition-opacity hover:opacity-70"
                  style={{ color: "var(--accent)" }}
                >
                  Create one →
                </button>
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {sortedDashboards.slice(0, 6).map((d) => (
                <DashboardRow
                  key={d.id}
                  d={d}
                  onView={() => navigate(`/view/${d.id}`)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Connections & Quick Actions */}
        <div className="flex flex-col gap-6">

          {/* Active connections */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: "var(--text-h)" }}>
                Active Connections
              </h2>
              <button
                onClick={() => navigate("/connections")}
                className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Manage <FaArrowRight size={10} />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !connections || connections.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text)" }}>
                No connections configured.{" "}
                <button
                  onClick={() => navigate("/connections")}
                  className="font-semibold transition-opacity hover:opacity-70"
                  style={{ color: "var(--accent)" }}
                >
                  Add one →
                </button>
              </p>
            ) : (
              <div>
                {connections.slice(0, 4).map((c) => (
                  <ConnectionRow key={c.id} conn={c} />
                ))}
                {connections.length > 4 && (
                  <p className="mt-2 text-xs" style={{ color: "var(--text)" }}>
                    +{connections.length - 4} more
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div
            className="rounded-2xl p-6"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <h2 className="mb-4 font-semibold" style={{ color: "var(--text-h)" }}>
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "New Dashboard",   icon: <MdDashboard size={16} />,   href: "/workspace" },
                { label: "New Connection",  icon: <MdOutlineCloud size={16} />, href: "/connections" },
                { label: "Browse Models", icon: <GoPackage size={15} />,      href: "/models" },
                { label: "Manage Users",    icon: <FaUser size={14} />,         href: "/users" },
              ].map((a) => (
                <button
                  key={a.label}
                  onClick={() => navigate(a.href)}
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-h)" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent-ring)";
                    e.currentTarget.style.background = "var(--accent-muted)";
                    e.currentTarget.style.color = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-h)";
                  }}
                >
                  <span style={{ color: "var(--accent)" }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
