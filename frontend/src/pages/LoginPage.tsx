import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GiJesterHat } from "react-icons/gi";
import { IoMdMail } from "react-icons/io";
import { RiLockPasswordFill } from "react-icons/ri";
import { HiSun, HiMoon } from "react-icons/hi";
import CTextInput from "../components/CTextInput";
import CButton from "../components/CButton";
import CAlert from "../components/CAlert";
import { login } from "../lib/Api";
import { setToken } from "../lib/auth";
import { useTheme } from "../lib/theme";


export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

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
      console.log("Login success", data);
      setToken(data.access_token);
      navigate("/home", { replace: true });
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      {/* Theme toggle — top right */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute right-5 top-5 rounded-lg p-2 transition-colors hover:bg-[var(--bg-subtle)]"
        style={{ color: "var(--text)" }}
      >
        {theme === "dark" ? <HiSun size={20} /> : <HiMoon size={20} />}
      </button>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: "var(--accent-muted)",
              border: "1px solid var(--accent-ring)",
            }}
          >
            <GiJesterHat size={30} style={{ color: "var(--accent)" }} />
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "var(--text-h)" }}
          >
            Chester <span style={{ color: "var(--accent)" }}>BI</span>
          </h1>
          <p className="text-sm" style={{ color: "var(--text)" }}>
            Sign in to your account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && <CAlert variant="error" message={error} />}

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
          style={{ color: "var(--text)" }}
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
  );
}
