import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IoMdMail } from "react-icons/io";
import { RiLockPasswordFill } from "react-icons/ri";
import { FiUser, FiUsers, FiFileText } from "react-icons/fi";
import { HiSun, HiMoon } from "react-icons/hi";
import { MdBadge } from "react-icons/md";
import CTextInput from "../components/CTextInput";
import CButton from "../components/CButton";
import CAlert from "../components/CAlert";
import CLogo from "../components/CLogo";
import { register } from "../lib/Api";
import { useTheme } from "../lib/theme";

// ── Section heading ────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 mt-5 text-[11px] font-bold uppercase tracking-widest first:mt-0"
      style={{ color: "var(--accent)" }}>
      {children}
    </p>
  );
}

// ── Dummy examples (for quick testing) ──────────────────────────────────
const EXAMPLES = [
  {
    label: "Ecommerce",
    value: "ecommerce",
    description: "A worldwide ecommerce company",

  },
  {
    label: "Logistics",
    value: "logistics",
    description: "A worldwide logistics company",
  }
];

const STEPS = ["Account", "Owner", "Password" , "Examples"] as const;

export default function RegisterPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // Account (organisation)
    name: "",
    description: "",
    // Personal
    first_name: "",
    last_name: "",
    // Credentials
    username: "",
    email: "",
    password: "",
    confirm_password: "",
    examples: [] as string[],
  });

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleExample = (value: string) =>
    setForm((prev) => ({
      ...prev,
      examples: prev.examples.includes(value)
        ? prev.examples.filter((v) => v !== value)
        : [...prev.examples, value],
    }));

  // ── Validation ─────────────────────────────────────────────────────────
  const passwordMismatch =
    form.confirm_password.length > 0 && form.password !== form.confirm_password;

  const stepValid = [
    form.name.trim().length >= 3 && form.description.trim().length >= 3,
    form.first_name.trim().length >= 3 &&
      form.last_name.trim().length >= 3 &&
      form.username.trim().length >= 3 &&
      form.email.trim().length >= 3,
    form.password.length >= 8 && form.password === form.confirm_password,
  ];

  const isValid = stepValid.every(Boolean);

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!stepValid[step]) return;
    setStep((s) => s + 1);
  }

  // ── Submit ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setError("");
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        description: form.description.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        examples: form.examples,
      });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <button
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to daylight" : "Switch to night hall"}
        className="absolute right-5 top-5 p-2 transition-colors hover:text-[var(--accent)]"
        style={{ color: "var(--text-2)" }}
      >
        {theme === "dark" ? <HiSun size={18} /> : <HiMoon size={18} />}
      </button>

      <div
        className="w-full max-w-sm"
        style={{ border: "1px solid var(--border)", boxShadow: "0 24px 56px -16px rgba(0,0,0,0.7)" }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <CLogo size={18} />
          <div className="min-w-0">
            <p className="font-medium text-[13px] leading-none">Chester BI</p>
            <p className="label mt-1 leading-none" style={{ color: "var(--accent)" }}>
              Semantic BI
            </p>
          </div>
        </div>

        <div className="px-6 py-7">
          <p className="font-medium mb-6 text-[17px] leading-none">Open an account</p>
          <form
          onSubmit={step < STEPS.length - 1 ? handleNext : handleSubmit}
          className="flex flex-col gap-0"
          noValidate
        >
          {error && <CAlert variant="error" message={error} className="mb-4" />}

          {step === 0 && (
            <>
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <FiUsers size={10} /> Organisation
                </span>
              </SectionLabel>
              <div className="flex flex-col gap-3">
                <CTextInput
                  label="Organisation Name"
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  placeholder="Acme Corp"
                  icon={<FiUsers size={15} />}
                  required
                  autoComplete="organization"
                />
                <CTextInput
                  label="Description"
                  type="text"
                  value={form.description}
                  onChange={set("description")}
                  placeholder="A short description of your organisation"
                  icon={<FiFileText size={15} />}
                  required
                />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <FiUser size={10} /> Owner details
                </span>
              </SectionLabel>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <CTextInput
                    label="First Name"
                    type="text"
                    value={form.first_name}
                    onChange={set("first_name")}
                    placeholder="Jane"
                    icon={<FiUser size={15} />}
                    required
                    autoComplete="given-name"
                  />
                  <CTextInput
                    label="Last Name"
                    type="text"
                    value={form.last_name}
                    onChange={set("last_name")}
                    placeholder="Doe"
                    icon={<FiUser size={15} />}
                    required
                    autoComplete="family-name"
                  />
                </div>
                <CTextInput
                  label="Username"
                  type="text"
                  value={form.username}
                  onChange={set("username")}
                  placeholder="janedoe"
                  icon={<MdBadge size={16} />}
                  required
                  autoComplete="username"
                />
                <CTextInput
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  placeholder="jane@acme.com"
                  icon={<IoMdMail size={16} />}
                  required
                  autoComplete="email"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <RiLockPasswordFill size={10} /> Password
                </span>
              </SectionLabel>
              <div className="flex flex-col gap-3">
                <CTextInput
                  label="Password"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="At least 8 characters"
                  icon={<RiLockPasswordFill size={16} />}
                  required
                  autoComplete="new-password"
                />
                <div>
                  <CTextInput
                    label="Confirm Password"
                    type="password"
                    value={form.confirm_password}
                    onChange={set("confirm_password")}
                    placeholder="Repeat your password"
                    icon={<RiLockPasswordFill size={16} />}
                    required
                    autoComplete="new-password"
                  />
                  {passwordMismatch && (
                    <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>
                      Passwords do not match.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <SectionLabel>
                <span className="flex items-center gap-1.5">
                  <FiFileText size={10} /> Examples
                </span>
              </SectionLabel>
              <div className="flex flex-col gap-2">
                {EXAMPLES.map((ex) => {
                  const selected = form.examples.includes(ex.value);
                  return (
                    <div
                      key={ex.value}
                      className="flex items-center justify-between gap-3 rounded-[var(--r-sm)] px-4 py-3"
                      style={{ border: "1px solid var(--border)" }}
                    >
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                          {ex.label}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-2)" }}>
                          {ex.description}
                        </p>
                      </div>
                      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={selected}
                          onChange={() => toggleExample(ex.value)}
                        />
                        <div className="h-6 w-11 rounded-[var(--r-sm)] bg-[var(--border)] transition-colors peer-checked:bg-[var(--accent)]" />
                        <div className="absolute left-1 h-4 w-4 rounded-[var(--r-sm)] bg-white transition-transform peer-checked:translate-x-5" />
                      </label>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <CButton
                type="button"
                variant="outline"
                onClick={() => setStep((s) => s - 1)}
                className="py-3"
              >
                Back
              </CButton>
            )}
            {step < STEPS.length - 1 ? (
              <CButton type="submit" variant="primary" disabled={!stepValid[step]} fullWidth className="py-3">
                Next
              </CButton>
            ) : (
              <CButton
                type="submit"
                variant="primary"
                loading={loading}
                disabled={!isValid || loading}
                fullWidth
                className="py-3"
              >
                {loading ? "Creating account…" : "Create Account"}
              </CButton>
            )}
          </div>
        </form>

        {/* Footer */}
        <p
          className="mt-5 text-center text-sm"
          style={{ color: "var(--text-2)" }}
        >
          Already have an account?{" "}
          <a
            href="/login"
            className="font-semibold transition-opacity hover:opacity-75"
            style={{ color: "var(--accent)" }}
          >
            Sign In
          </a>
        </p>
      </div>
      </div>
    </div>
  );
}
