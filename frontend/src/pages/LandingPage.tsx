import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MdOutlineCloud, MdAutoAwesome } from "react-icons/md";
import { FaArrowRight, FaGithub, FaStar, FaLock } from "react-icons/fa";
import { GoPackage } from "react-icons/go";
import { HiSun, HiMoon } from "react-icons/hi";
import { useTheme } from "../lib/theme";
import CButton from "../components/CButton";
import CLogo from "../components/CLogo";

const GITHUB_URL = "https://github.com/izzaldeen98/chester-bi";
const GITHUB_API = "https://api.github.com/repos/izzaldeen98/chester-bi";

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
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3.5">
        <CLogo size={26} />
        <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-h)" }}>
          Chester BI
        </span>

        <div className="flex-1" />

        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden items-center gap-1.5 text-sm transition-opacity hover:opacity-70 sm:flex"
          style={{ color: "var(--text)" }}
        >
          <FaGithub size={16} />
          {stars && (
            <span className="flex items-center gap-1 tabular-nums">
              <FaStar size={10} style={{ color: "#eab308" }} /> {stars}
            </span>
          )}
        </a>

        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
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
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero({ stars }: { stars: string | null }) {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-28 text-center">
      {/* Field of data points — the measures and dimensions a semantic model exposes. */}
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
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 45% at 50% 0%, var(--accent-muted) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-3xl">
        <div className="mb-7 flex items-center justify-center gap-3">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="transition-opacity hover:opacity-80">
            <Badge>
              <FaGithub size={11} /> Open source · MIT
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
          className="mb-6 text-balance text-5xl font-extrabold leading-[1.05] tracking-[-0.035em] md:text-[4.25rem]"
          style={{ color: "var(--text-h)" }}
        >
          Stop building dashboards.
          <br />
          <span style={{ color: "var(--accent)" }}>Describe the analysis.</span>
        </h1>

        <p
          className="mx-auto mb-4 max-w-[62ch] text-lg leading-relaxed"
          style={{ color: "var(--text)" }}
        >
          Chester BI reads your Cube semantic model and writes the whole page — charts,
          written analysis, and working filters — from a sentence. Self-hosted, with your
          own LLM key.
        </p>
        <p className="mx-auto mb-10 max-w-[58ch] text-sm" style={{ color: "var(--text)" }}>
          The model never sees your data or your credentials. It writes queries against your
          semantic layer, and every one is validated before it runs.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <CButton variant="primary" onClick={() => navigate("/register")} className="px-7 py-3">
            Create Your Instance <FaArrowRight size={13} />
          </CButton>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <CButton variant="outline" className="px-7 py-3">
              <FaGithub size={16} /> View on GitHub
            </CButton>
          </a>
        </div>
      </div>
    </section>
  );
}

// ── How an artifact is made ────────────────────────────────────────────────
// The product's actual mechanism, shown with real values rather than described
// in the abstract: a real brief, the Cube query the agent wrote from it, and
// what came back.
function Pipeline() {
  return (
    <section className="px-6 py-24" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 max-w-2xl">
          <h2
            className="text-balance text-4xl font-bold leading-tight tracking-[-0.03em]"
            style={{ color: "var(--text-h)" }}
          >
            You write one sentence.
            <br />
            Your semantic model decides what's answerable.
          </h2>
          <p className="mt-5 max-w-[65ch] text-base leading-relaxed" style={{ color: "var(--text)" }}>
            Most tools bolt a text-to-SQL box onto a dashboard and hope. Chester's agent is
            handed your compiled Cube schema and nothing else — no rows, no connection
            string, no SQL. Here is a real run, start to finish.
          </p>
        </div>

        <div className="relative">
          {/* Decorative rail; the stages beside it stand on their own. */}
          <span
            aria-hidden
            className="pipeline-rail absolute left-0 top-8 hidden w-px md:block"
            style={{ bottom: "2rem", background: "var(--accent)", opacity: 0.55 }}
          />

          <ol className="relative flex flex-col gap-px md:pl-8">
          {/* Stage 1 — the ask */}
            <li className="relative grid gap-6 py-8 md:grid-cols-[13rem_1fr]">
            <div>
              <span
                className="text-xs font-bold uppercase tracking-[0.12em]"
                style={{ color: "var(--accent)" }}
              >
                You ask
              </span>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                Plain language, against one semantic model you pick.
              </p>
            </div>
            <blockquote
              className="rounded-2xl px-6 py-5 text-lg leading-relaxed"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text-h)",
              }}
            >
              “Revenue by customer with the top five called out, a short written summary,
              and a filter to narrow by customer.”
            </blockquote>
          </li>

          {/* Stage 2 — the query */}
            <li
              className="relative grid gap-6 py-8 md:grid-cols-[13rem_1fr]"
              style={{ borderTop: "1px solid var(--border)" }}
            >
            <div>
              <span
                className="text-xs font-bold uppercase tracking-[0.12em]"
                style={{ color: "var(--accent)" }}
              >
                Chester writes the query
              </span>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                Against your measures and dimensions. Checked against the live schema before
                it is allowed to run — a measure used as a dimension, an operator that does
                not exist, a field you never defined: rejected and sent back.
              </p>
            </div>
            <pre
              className="overflow-x-auto rounded-2xl px-6 py-5 text-[13px] leading-relaxed"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text-h)",
              }}
            >
{`{
  "measures":   ["loads.total_revenue"],
  "dimensions": ["customers.customer_name"],
  "order":      { "loads.total_revenue": "desc" },
  "limit":      500
}`}
            </pre>
          </li>

          {/* Stage 3 — the page */}
            <li
              className="relative grid gap-6 py-8 md:grid-cols-[13rem_1fr]"
              style={{ borderTop: "1px solid var(--border)" }}
            >
            <div>
              <span
                className="text-xs font-bold uppercase tracking-[0.12em]"
                style={{ color: "var(--accent)" }}
              >
                You get a page
              </span>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                Not a widget in someone else's grid — a real page, written for this question.
              </p>
            </div>
            <div
              className="rounded-2xl px-6 py-5"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <ul className="flex flex-col gap-3 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                <li>
                  <strong style={{ color: "var(--text-h)" }}>Charts it chose</strong> — the
                  shape that fits the question, not the one you dragged in.
                </li>
                <li>
                  <strong style={{ color: "var(--text-h)" }}>Analysis in sentences</strong> —
                  totals, movers and outliers, computed from the rows that came back.
                </li>
                <li>
                  <strong style={{ color: "var(--text-h)" }}>Filters that work</strong> —
                  instant, because the data is already in the page.
                </li>
                <li>
                  <strong style={{ color: "var(--text-h)" }}>Live on every open</strong> — the
                  file stores no data; the queries run again each time you look.
                </li>
              </ul>
            </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── Keep asking ────────────────────────────────────────────────────────────
function Iterate() {
  return (
    <section className="px-6 py-24" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto grid max-w-5xl items-center gap-14 md:grid-cols-2">
        <div>
          <h2
            className="text-balance text-4xl font-bold leading-tight tracking-[-0.03em]"
            style={{ color: "var(--text-h)" }}
          >
            Wrong chart? Say so.
          </h2>
          <p className="mt-5 max-w-[60ch] text-base leading-relaxed" style={{ color: "var(--text)" }}>
            The page opens with a chat floating over it. Ask for a change and Chester replans
            the queries and rewrites the page — so “add a breakdown by region” pulls data the
            page never had, instead of rearranging what it did.
          </p>
          <p className="mt-4 max-w-[60ch] text-base leading-relaxed" style={{ color: "var(--text)" }}>
            Every prompt saves a version. Scroll back through what you asked, reopen any
            earlier page, restore it if the new one was worse.
          </p>
        </div>

        {/* A prompt thread: what you asked, and the version it produced. */}
        <div
          className="flex flex-col gap-4 rounded-2xl p-6"
          style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        >
          {[
            { v: 1, text: "Revenue by customer, top five called out, with a summary." },
            { v: 2, text: "Use the customer name instead of the id." },
            { v: 3, text: "Add pieces shipped by month as a trend." },
          ].map((turn) => (
            <div key={turn.v} className="flex flex-col items-end gap-1.5">
              <p
                className="max-w-[92%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed"
                style={{ background: "var(--accent)", color: "var(--accent-fg, #1c1917)" }}
              >
                {turn.text}
              </p>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums"
                style={{
                  background: "var(--bg)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              >
                v{turn.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── What it runs on ────────────────────────────────────────────────────────
function Foundation() {
  const pillars = [
    {
      icon: <MdOutlineCloud size={20} />,
      title: "Your databases",
      body: "PostgreSQL, MySQL, BigQuery, Snowflake, or an uploaded file. Credentials are encrypted at rest and never leave your server.",
    },
    {
      icon: <GoPackage size={20} />,
      title: "Your semantic model",
      body: "Define cubes, measures, dimensions and joins in a visual builder or straight in Cube YAML. This is the contract the agent works within.",
    },
    {
      icon: <MdAutoAwesome size={20} />,
      title: "Your LLM key",
      body: "OpenAI, Anthropic, Gemini, DeepSeek or Qwen. Pick the provider and model once; every prompt uses it.",
    },
    {
      icon: <FaLock size={20} />,
      title: "Your infrastructure",
      body: "One docker compose command. Generated pages run sandboxed with no access to your session, and nothing phones home.",
    },
  ];

  return (
    <section className="px-6 py-24" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-5xl">
        <h2
          className="mb-14 max-w-2xl text-balance text-4xl font-bold leading-tight tracking-[-0.03em]"
          style={{ color: "var(--text-h)" }}
        >
          Four things stay yours.
        </h2>

        <dl className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {pillars.map((p) => (
            <div key={p.title} className="flex gap-4">
              <span className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} aria-hidden>
                {p.icon}
              </span>
              <div>
                <dt className="text-base font-semibold" style={{ color: "var(--text-h)" }}>
                  {p.title}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                  {p.body}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// ── Quick start ────────────────────────────────────────────────────────────
// Numbered because the sequence is load-bearing: each command depends on the
// one before it.
const steps = [
  { n: "01", title: "Clone & configure", body: "Copy .example.env to .env and generate the two required secrets." },
  { n: "02", title: "docker compose up", body: "Starts Postgres, Redis, Cube Core, the FastAPI backend and the React frontend." },
  { n: "03", title: "Model, then ask", body: "Register, connect a database, define a cube — then describe what you want to know." },
];

function QuickStart() {
  return (
    <section className="px-6 py-24" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="mx-auto max-w-4xl">
        <h2
          className="mb-12 text-balance text-4xl font-bold tracking-[-0.03em]"
          style={{ color: "var(--text-h)" }}
        >
          Running in minutes.
        </h2>

        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-2.5">
              <span
                className="text-3xl font-black tabular-nums"
                style={{ color: "var(--accent)", opacity: 0.3 }}
                aria-hidden
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

        <div
          className="mt-14 overflow-hidden rounded-2xl"
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
          <div
            className="overflow-x-auto p-5 font-mono text-sm [&>p]:whitespace-pre"
            style={{ color: "var(--text-h)" }}
          >
            <p><span style={{ color: "var(--accent)", opacity: 0.75 }}># 1. Clone the repo</span></p>
            <p>git clone https://github.com/izzaldeen98/chester-bi.git && cd chester-bi</p>
            <p className="mt-2.5"><span style={{ color: "var(--accent)", opacity: 0.75 }}># 2. Configure environment</span></p>
            <p>cp .example.env .env  <span style={{ color: "var(--accent)", opacity: 0.55 }}># fill in SECRET_KEY & FERNET_KEY</span></p>
            <p className="mt-2.5"><span style={{ color: "var(--accent)", opacity: 0.75 }}># 3. Launch everything</span></p>
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
    <section className="px-6 py-24" style={{ borderTop: "1px solid var(--border)" }}>
      <div
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl p-12 text-center"
        style={{
          background: "linear-gradient(135deg, #d97706 0%, #eab308 45%, #facc15 100%)",
          boxShadow: "0 24px 60px -20px rgba(180, 120, 10, 0.45)",
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
        <CLogo size={44} color="rgba(0,0,0,0.55)" className="relative mx-auto mb-4" />
        <h2 className="relative mb-3 text-balance text-4xl font-extrabold tracking-[-0.03em] text-black">
          Your data. Your model. Your key.
        </h2>
        <p className="relative mx-auto mb-8 max-w-lg leading-relaxed text-black/75">
          Deploy Chester BI on your own server in minutes. No vendor lock-in, no per-seat
          pricing, and nothing leaving your infrastructure.
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
          <CLogo size={20} />
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
        <Pipeline />
        <Iterate />
        <Foundation />
        <QuickStart />
        <CTABanner />
      </main>
      <Footer />
    </div>
  );
}
