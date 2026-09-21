import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { IoMdMail } from "react-icons/io";
import { RiLockPasswordFill } from "react-icons/ri";
import { HiSun, HiMoon } from "react-icons/hi";
import CTextInput from "../components/CTextInput";
import CButton from "../components/CButton";
import CAlert from "../components/CAlert";
import CLogo from "../components/CLogo";
import { login } from "../lib/Api";
import { setToken, setUser } from "../lib/auth";
import { useTheme } from "../lib/theme";


export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const justRegistered = (location.state as any)?.registered === true;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setError("");
    setLoading(true);
    try {
      const data = await login(username.trim(), password);
      setToken(data.access_token);
      if (data.user) setUser(data.user);
      navigate("/home", { replace: true });
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
          <p className="font-medium mb-6 text-[17px] leading-none">Sign in</p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <CAlert variant="error" message={error} />}
          {justRegistered && !error && (
            <CAlert variant="success" message="Account created! Sign in to continue." />
          )}

          <CTextInput
            label="Username or Email"
            type="text"
            value={username}
            onChange={setUsername}
            placeholder="Username or Email"
            icon={<IoMdMail size={16} />}
            required
            autoComplete="username"
          />

          <CTextInput
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            icon={<RiLockPasswordFill size={16} />}
            required
            autoComplete="current-password"
          />

          <CButton
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!username.trim() || !password}
            fullWidth
            className="mt-2 py-3"
          >
            {loading ? "Signing in…" : "Sign In"}
          </CButton>
        </form>

        {/* Footer link */}
        <p
          className="mt-6 text-center text-sm"
          style={{ color: "var(--text-2)" }}
        >
          Don't have an account?{" "}
          <a
            href="/register"
            className="font-semibold transition-colors"
            style={{ color: "var(--accent)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.opacity = "0.8")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.opacity = "1")
            }
          >
            Register
          </a>
        </p>
      </div>
      </div>
    </div>
  );
}
