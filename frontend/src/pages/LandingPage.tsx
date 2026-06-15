import { useNavigate } from "react-router-dom";
import { GiJesterHat } from "react-icons/gi";
import { MdDashboard, MdOutlineCloud } from "react-icons/md";
import { PiFileSqlFill } from "react-icons/pi";
import { FaFileAlt, FaArrowRight, FaUser } from "react-icons/fa";
import { GoPackage } from "react-icons/go";
import { FaTable } from "react-icons/fa";
import { HiSun, HiMoon } from "react-icons/hi";
import { IoBarChartSharp } from "react-icons/io5";
import { useTheme } from "../lib/theme";
import CButton from "../components/CButton";

// ── Data ───────────────────────────────────────────────────────────────────
const features = [
  {
    icon: <MdDashboard size={24} />,
    title: "Interactive Dashboards",
    description:
      "Build rich, real-time dashboards that surface the metrics that matter most to your team.",
  },
  {
    icon: <PiFileSqlFill size={24} />,
    title: "SQL Query Builder",
    description:
      "Write and run SQL queries directly in the browser with syntax highlighting and autocomplete.",
  },
  {
    icon: <IoBarChartSharp size={24} />,
    title: "Visual Analytics",
    description:
      "Drag-and-drop chart builder turns raw data into beautiful, shareable visualisations.",
  },
  {
    icon: <FaTable size={24} />,
    title: "Smart Data Tables",
    description:
      "Paginate, filter, and sort millions of rows without breaking a sweat.",
  },
  {
    icon: <MdOutlineCloud size={24} />,
    title: "Cloud Connections",
    description:
      "Connect to PostgreSQL, BigQuery, Snowflake, and more in just a few clicks.",
  },
  {
    icon: <GoPackage size={24} />,
    title: "Package Management",
    description:
      "Bundle and share reusable query logic and dashboards across your organisation.",
  },
];

const stats = [
  { value: "10×", label: "Faster insights" },
  { value: "50+", label: "Data sources" },
  { value: "99.9%", label: "Uptime SLA" },
];

const navLinks = ["Features", "Docs", "About"];
const footerLinks = ["Privacy", "Terms", "Contact"];

// ── Badge ──────────────────────────────────────────────────────────────────
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{
        background: "var(--accent-muted)",
        color: "var(--accent)",
        border: "1px solid var(--accent-ring)",
      }}
    >
      {children}
    </span>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--bg) 85%, transparent)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <GiJesterHat size={30} style={{ color: "var(--accent)" }} />
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: "var(--text-h)" }}
          >
            Chester{" "}
            <span style={{ color: "var(--accent)" }}>BI</span>
          </span>
        </div>

        {/* Nav links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link}
              href="#"
              className="text-sm font-medium transition-colors"
              style={{ color: "var(--text)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text)")
              }
            >
              {link}
            </a>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg p-2 transition-colors"
            style={{ color: "var(--text)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-muted)";
              e.currentTarget.style.color = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text)";
            }}
          >
            {theme === "dark" ? <HiSun size={20} /> : <HiMoon size={20} />}
          </button>

          <CButton
            variant="outline"
            onClick={() => navigate("/login")}
            className="hidden md:inline-flex"
          >
            Sign In
          </CButton>

          <CButton
            variant="primary"
            onClick={() => navigate("/login")}
          >
            Get Started
            <FaArrowRight size={12} />
          </CButton>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden px-6 py-28 text-center">
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 45% at 50% 0%, var(--accent-muted) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex justify-center">
          <Badge>
            <GiJesterHat size={13} />
            Business Intelligence, Reimagined
          </Badge>
        </div>

        <h1
          className="mb-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl lg:text-7xl"
          style={{ color: "var(--text-h)" }}
        >
          Turn Data Into{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #d97706 0%, #eab308 40%, #facc15 100%)",
            }}
          >
            Insights
          </span>{" "}
          Instantly
        </h1>

        <p
          className="mx-auto mb-10 max-w-2xl text-lg md:text-xl"
          style={{ color: "var(--text)" }}
        >
          Chester BI connects to your data sources, lets you query with SQL,
          and transforms results into stunning dashboards — all in one place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <CButton
            variant="primary"
            onClick={() => navigate("/login")}
            className="px-7 py-3"
          >
            Get Started Free
            <FaArrowRight size={13} />
          </CButton>
          <CButton variant="outline" className="px-7 py-3">
            View Demo
          </CButton>
        </div>
      </div>

      {/* Stats */}
      <div className="mx-auto mt-20 flex max-w-sm flex-wrap justify-center gap-10">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p
              className="text-3xl font-extrabold"
              style={{ color: "var(--accent)" }}
            >
              {s.value}
            </p>
            <p className="text-sm" style={{ color: "var(--text)" }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
function Features() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="mb-4 flex justify-center">
            <Badge>Everything you need</Badge>
          </div>
          <h2
            className="text-4xl font-bold tracking-tight"
            style={{ color: "var(--text-h)" }}
          >
            Powerful features,{" "}
            <span style={{ color: "var(--accent)" }}>zero complexity</span>
          </h2>
          <p
            className="mx-auto mt-4 max-w-xl"
            style={{ color: "var(--text)" }}
          >
            From raw queries to polished dashboards, Chester BI gives every
            analyst and engineer the tools they need.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl p-6 transition-all"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-ring)";
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-ring)",
                }}
              >
                {f.icon}
              </div>
              <h3
                className="mb-1 font-semibold"
                style={{ color: "var(--text-h)" }}
              >
                {f.title}
              </h3>
              <p className="text-sm" style={{ color: "var(--text)" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────
function CTABanner() {
  const navigate = useNavigate();
  return (
    <section className="px-6 py-20">
      <div
        className="mx-auto max-w-4xl overflow-hidden rounded-3xl p-12 text-center"
        style={{
          background:
            "linear-gradient(135deg, #d97706 0%, #eab308 45%, #facc15 100%)",
        }}
      >
        <GiJesterHat size={48} className="mx-auto mb-4" style={{ color: "rgba(0,0,0,0.6)" }} />
        <h2 className="mb-4 text-4xl font-extrabold tracking-tight text-black">
          Ready to unlock your data?
        </h2>
        <p className="mx-auto mb-8 max-w-lg text-black/70">
          Join thousands of analysts who trust Chester BI to power their most
          critical business decisions.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <CButton
            variant="primary"
            onClick={() => navigate("/login")}
            className="bg-black! px-7 py-3 text-yellow-400 hover:bg-stone-900!"
          >
            Start for Free
            <FaArrowRight size={13} />
          </CButton>
          <CButton
            variant="outline"
            className="border-black/30! px-7 py-3 text-black! hover:bg-black/10!"
          >
            Request a Demo
            <FaUser size={13} />
          </CButton>
        </div>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)" }} className="px-6 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <GiJesterHat size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold" style={{ color: "var(--text-h)" }}>
            Chester BI
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--text)" }}>
          © {new Date().getFullYear()} Chester BI. All rights reserved.
        </p>
        <div className="flex gap-6 text-sm">
          {footerLinks.map((item) => (
            <a
              key={item}
              href="#"
              className="transition-colors"
              style={{ color: "var(--text)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--accent)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text)")
              }
            >
              {item}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
