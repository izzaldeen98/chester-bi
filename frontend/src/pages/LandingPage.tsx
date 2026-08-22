import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GiJesterHat } from "react-icons/gi";
import { MdDashboard, MdOutlineCloud } from "react-icons/md";
import { PiFileSqlFill } from "react-icons/pi";
import { FaArrowRight, FaGithub, FaStar } from "react-icons/fa";
import { GoPackage } from "react-icons/go";
import { FaTable } from "react-icons/fa";
import { HiSun, HiMoon } from "react-icons/hi";
import { IoBarChartSharp } from "react-icons/io5";
import { FiFilter, FiLock } from "react-icons/fi";
import { useTheme } from "../lib/theme";
import CButton from "../components/CButton";

const GITHUB_URL = "https://github.com/izzaldeen98/chester-bi";
const GITHUB_API  = "https://api.github.com/repos/izzaldeen98/chester-bi";

// ── Star count hook ─────────────────────────────────────────────────────────
function fmtStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function useGitHubStars(): string | null {
  const [stars, setStars] = useState<string | null>(null);
  useEffect(() => {
    fetch(GITHUB_API, { headers: { Accept: "application/vnd.github+json" } })
      .then((r) => r.json())
      .then((d) => { if (typeof d.stargazers_count === "number") setStars(fmtStars(d.stargazers_count)); })
      .catch(() => {/* silently ignore */});
  }, []);
  return stars;
}

// ── Features ───────────────────────────────────────────────────────────────
const features = [
  {
    icon: <MdDashboard size={22} />,
    title: "Drag-and-Drop Dashboards",
    description:
      "Build and share interactive dashboards with a fully resizable grid. No code required.",
  },
  {
    icon: <PiFileSqlFill size={22} />,
    title: "Visual Query Builder",
    description:
      "Build powerful Cube queries in the browser with a drag-and-drop field picker and live previews.",
  },
  {
    icon: <IoBarChartSharp size={22} />,
    title: "Rich Visualisations",
    description:
      "Bar, line, scatter, and more — chart types powered by ECharts that look great out of the box.",
  },
  {
    icon: <FiFilter size={22} />,
    title: "Live Dashboard Filters",
    description:
      "Add interactive filter widgets that slice chart queries in real time without rebuilding the dashboard.",
  },
  {
    icon: <MdOutlineCloud size={22} />,
    title: "Multi-Database Connections",
    description:
      "Connect to PostgreSQL, BigQuery, DuckDB, Snowflake, and more through a single encrypted config.",
  },
  {
    icon: <GoPackage size={22} />,
    title: "Cube Model Packages",
    description:
      "Organise and share reusable semantic models and query bundles across your whole organisation.",
  },
  {
    icon: <FaTable size={22} />,
    title: "File & Model Management",
    description:
      "Upload data files, manage Cube model files, and keep everything organised in one place.",
  },
  {
    icon: <FiLock size={22} />,
    title: "Role-Based Access Control",
    description:
      "Invite team members, assign roles, and control exactly who can view or edit what.",
  },
];

// ── Steps ──────────────────────────────────────────────────────────────────
const steps = [
  { n: "01", title: "Clone & configure", body: "Clone the repo, copy .example.env to .env, and fill in your secret keys and database credentials." },
  { n: "02", title: "docker compose up", body: "One command starts Postgres, Redis, Cube Core, the FastAPI backend, and the React frontend." },
  { n: "03", title: "Create your account", body: "Register your organisation owner account and start connecting data sources immediately." },
];

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
function Navbar({ stars }: { stars: string | null }) {
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
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{ background: "linear-gradient(90deg, #d97706 0%, #eab308 45%, #facc15 100%)" }}
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <GiJesterHat size={28} style={{ color: "var(--accent)" }} />
          <span className="text-xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>
            Chester <span style={{ color: "var(--accent)" }}>BI</span>
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* GitHub + star count */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text)" }}
          >
            <FaGithub size={17} />
            <span className="hidden sm:inline">GitHub</span>
            {stars && (
              <span
                className="hidden items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-bold sm:flex"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
              >
                <FaStar size={9} />
                {stars}
              </span>
            )}
          </a>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
            style={{ color: "var(--text)" }}
          >
            {theme === "dark" ? <HiSun size={19} /> : <HiMoon size={19} />}
          </button>

          <CButton variant="outline" onClick={() => navigate("/login")} className="hidden sm:inline-flex">
            Sign In
          </CButton>
          <CButton variant="primary" onClick={() => navigate("/register")}>
            Get Started <FaArrowRight size={11} />
          </CButton>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero({ stars }: { stars: string | null }) {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden px-6 py-28 text-center">
      {/* Dashboard-grid motif, echoing the product's own workspace canvas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in srgb, var(--accent) 45%, transparent) 1.5px, transparent 1.5px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 70% 55% at 50% 10%, black 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 50% 10%, black 0%, transparent 75%)",
        }}
      />
      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 45% at 50% 0%, var(--accent-muted) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
            <Badge>
              <FaGithub size={11} /> Open Source · MIT License
            </Badge>
          </a>
          {stars && (
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
              <Badge>
                <FaStar size={10} style={{ color: "#eab308" }} /> {stars} stars
              </Badge>
            </a>
          )}
        </div>

        <h1
          className="mb-6 text-5xl font-extrabold leading-tight tracking-tight md:text-6xl"
          style={{ color: "var(--text-h)" }}
        >
          Self-Hosted{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #d97706 0%, #eab308 40%, #facc15 100%)",
            }}
          >
            Business Intelligence
          </span>
          <br />for Your Team
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg" style={{ color: "var(--text)" }}>
          Chester BI is a free, open-source BI platform you run on your own infrastructure.
          Connect your databases, build Cube queries, build dashboards, and share insights —
          with full control over your data.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <CButton variant="primary" onClick={() => navigate("/register")} className="px-7 py-3">
            Create Your Instance <FaArrowRight size={13} />
          </CButton>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <CButton variant="outline" className="px-7 py-3">
              <FaGithub size={16} /> View on GitHub
            </CButton>
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Features ───────────────────────────────────────────────────────────────
function Features() {
  return (
    <section className="px-6 py-20" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="mb-4 flex justify-center">
            <Badge>What's included</Badge>
          </div>
          <h2 className="text-4xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>
            Everything you need,{" "}
            <span style={{ color: "var(--accent)" }}>nothing you don't</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base" style={{ color: "var(--text)" }}>
            Chester BI ships with a complete analytics stack. No plugins, no paywalled features,
            no usage caps.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl p-5 shadow-sm border-[var(--border)] transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent-ring)] hover:shadow-lg"
              style={{
                background: "var(--bg-subtle)",
                borderWidth: 1,
                borderStyle: "solid",
              }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110"
                style={{
                  background: "var(--accent-muted)",
                  color: "var(--accent)",
                  border: "1px solid var(--accent-ring)",
                }}
              >
                {f.icon}
              </div>
              <h3 className="mb-1 text-sm font-semibold" style={{ color: "var(--text-h)" }}>
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Quick-start steps ──────────────────────────────────────────────────────
function QuickStart() {
  return (
    <section className="px-6 py-20" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <div className="mb-4 flex justify-center">
            <Badge>Quick start</Badge>
          </div>
          <h2 className="text-4xl font-bold tracking-tight" style={{ color: "var(--text-h)" }}>
            Up and running in{" "}
            <span style={{ color: "var(--accent)" }}>minutes</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-3">
              <span
                className="text-4xl font-black tabular-nums"
                style={{ color: "var(--accent)", opacity: 0.25 }}
              >
                {s.n}
              </span>
              <h3 className="text-base font-semibold" style={{ color: "var(--text-h)" }}>
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>

        {/* Code block */}
        <div
          className="mt-12 overflow-hidden rounded-2xl"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          <div
            className="flex items-center gap-1.5 px-4 py-2.5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#ef4444" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#eab308" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#22c55e" }} />
          </div>
          <div className="overflow-x-auto p-5 text-sm font-mono" style={{ color: "var(--text-h)" }}>
            <p><span style={{ color: "var(--accent)", opacity: 0.7 }}># 1. Clone the repo</span></p>
            <p>git clone https://github.com/chester-bi/chester-bi.git && cd chester-bi</p>
            <p className="mt-2"><span style={{ color: "var(--accent)", opacity: 0.7 }}># 2. Configure environment</span></p>
            <p>cp .example.env .env  <span style={{ color: "var(--accent)", opacity: 0.5 }}># fill in SECRET_KEY & FERNET_KEY</span></p>
            <p className="mt-2"><span style={{ color: "var(--accent)", opacity: 0.7 }}># 3. Launch everything</span></p>
            <p>docker compose up --build</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── CTA Banner ─────────────────────────────────────────────────────────────
function CTABanner() {
  const navigate = useNavigate();
  return (
    <section className="px-6 py-20" style={{ borderTop: "1px solid var(--border)" }}>
      <div
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl p-12 text-center shadow-2xl"
        style={{
          background:
            "linear-gradient(135deg, #d97706 0%, #eab308 45%, #facc15 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle 220px at 15% 15%, rgba(255,255,255,0.35) 0%, transparent 70%), radial-gradient(circle 260px at 90% 100%, rgba(0,0,0,0.18) 0%, transparent 70%)",
          }}
        />
        <GiJesterHat size={44} className="relative mx-auto mb-4" style={{ color: "rgba(0,0,0,0.55)" }} />
        <h2 className="relative mb-3 text-4xl font-extrabold tracking-tight text-black">
          Ready to own your data?
        </h2>
        <p className="relative mx-auto mb-8 max-w-lg text-black/70">
          Deploy Chester BI on your own server in minutes. No vendor lock-in,
          no per-seat pricing, no data leaving your infrastructure.
        </p>
        <div className="relative flex flex-wrap items-center justify-center gap-4">
          <CButton
            variant="primary"
            onClick={() => navigate("/register")}
            className="bg-black! px-7 py-3 text-yellow-400 hover:bg-stone-900!"
          >
            Create Your Account <FaArrowRight size={13} />
          </CButton>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <CButton
              variant="outline"
              className="border-black/30! px-7 py-3 text-black! hover:bg-black/10!"
            >
              <FaGithub size={15} /> Star on GitHub
            </CButton>
          </a>
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
          <GiJesterHat size={20} style={{ color: "var(--accent)" }} />
          <span className="font-semibold" style={{ color: "var(--text-h)" }}>Chester BI</span>
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            MIT
          </span>
        </div>
        <p className="text-sm" style={{ color: "var(--text)" }}>
          Free and open source. Self-host with confidence.
        </p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text)" }}
        >
          <FaGithub size={16} /> GitHub
        </a>
      </div>
    </footer>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const stars = useGitHubStars();
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Navbar stars={stars} />
      <main>
        <Hero stars={stars} />
        <Features />
        <QuickStart />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
