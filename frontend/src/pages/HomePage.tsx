import { MdDashboard, MdOutlineCloud } from "react-icons/md";
import { PiFileSqlFill } from "react-icons/pi";
import { FaFileAlt, FaUser } from "react-icons/fa";
import { GoPackage } from "react-icons/go";
import { IoBarChartSharp } from "react-icons/io5";
import { FaArrowRight } from "react-icons/fa6";
import CMetricCard from "../components/CMetricCard";

// ── Metric card data (dummy) ───────────────────────────────────────────────
const metrics = [
  {
    label: "Dashboards",
    value: "12",
    trend: "+3 this week",
    up: true,
    icon: <MdDashboard size={22} />,
  },
  {
    label: "Active Connections",
    value: "4",
    trend: "All healthy",
    up: true,
    icon: <MdOutlineCloud size={22} />,
  },
  {
    label: "Query Runs",
    value: "248",
    trend: "+41 today",
    up: true,
    icon: <PiFileSqlFill size={22} />,
  },
  {
    label: "Packages",
    value: "3",
    trend: "1 updated",
    up: null,
    icon: <GoPackage size={22} />,
  },
  {
    label: "Semantic Models",
    value: "18",
    trend: "+2 this week",
    up: true,
    icon: <FaFileAlt size={20} />,
  },
  {
    label: "Active Users",
    value: "7",
    trend: "2 online now",
    up: null,
    icon: <FaUser size={19} />,
  },
];

// ── Recent activity (dummy) ────────────────────────────────────────────────
const activity = [
  { action: "Dashboard created",  detail: "Sales Overview Q2",         time: "2 min ago",  icon: <MdDashboard size={15} /> },
  { action: "Query executed",     detail: "SELECT * FROM orders LIMIT 100", time: "14 min ago", icon: <PiFileSqlFill size={15} /> },
  { action: "Model uploaded",     detail: "revenue_model.malloy",      time: "1 hr ago",   icon: <FaFileAlt size={14} /> },
  { action: "Connection tested",  detail: "PostgreSQL · prod_db",      time: "3 hr ago",   icon: <MdOutlineCloud size={15} /> },
  { action: "Package loaded",     detail: "analytics_v2",              time: "Yesterday",  icon: <GoPackage size={15} /> },
];


// ── Page ───────────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <div className="flex-1 overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold tracking-tight"
          style={{ color: "var(--text-h)" }}
        >
          Welcome back 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text)" }}>
          Here's what's happening in your Chester BI workspace.
        </p>
      </div>

      {/* Metrics grid */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <CMetricCard key={m.label} {...m} />
        ))}
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent activity */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: "var(--text-h)" }}>
              Recent Activity
            </h2>
            <button
              className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--accent)" }}
            >
              View all <FaArrowRight size={10} />
            </button>
          </div>
          <ul className="flex flex-col gap-0">
            {activity.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-3 py-3"
                style={{
                  borderBottom:
                    i < activity.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: "var(--accent-muted)",
                    color: "var(--accent)",
                  }}
                >
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--text-h)" }}
                  >
                    {a.action}
                  </p>
                  <p
                    className="truncate text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {a.detail}
                  </p>
                </div>
                <span
                  className="shrink-0 text-xs"
                  style={{ color: "var(--text)" }}
                >
                  {a.time}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick stats panel */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <h2
            className="mb-5 font-semibold"
            style={{ color: "var(--text-h)" }}
          >
            At a Glance
          </h2>
          <div className="flex flex-col gap-4">
            {[
              { label: "Query success rate",  value: "98.4%",   bar: 98 },
              { label: "Avg. query time",     value: "142 ms",  bar: 28 },
              { label: "Storage used",        value: "3.2 GB",  bar: 42 },
              { label: "API uptime (30 d)",   value: "99.9%",   bar: 100 },
            ].map((s) => (
              <div key={s.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span style={{ color: "var(--text)" }}>{s.label}</span>
                  <span className="font-semibold" style={{ color: "var(--text-h)" }}>
                    {s.value}
                  </span>
                </div>
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--border)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${s.bar}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Charts placeholder */}
          <div
            className="mt-6 flex items-center justify-center rounded-xl py-8"
            style={{
              background: "var(--accent-muted)",
              border: "1px dashed var(--accent-ring)",
            }}
          >
            <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--accent)" }}>
              <IoBarChartSharp size={18} />
              Charts coming soon
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
