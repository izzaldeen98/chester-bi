import { useState } from 'react'
import { Button, Link } from '@heroui/react'
import { AppInput } from '../components/ui/AppInput'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, LogIn } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { setPassword } from '../lib/api'

// ── Tab type ──────────────────────────────────────────────────────────────────
type Tab = 'login' | 'set-password'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [tab, setTab] = useState<Tab>('login')

  // Login form
  const [username, setUsername] = useState('')
  const [password, setPassword_] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  // Set password form
  const [spUsername, setSpUsername]           = useState('')
  const [spAccountName, setSpAccountName]     = useState('')
  const [spPassword, setSpPassword]           = useState('')
  const [spConfirm, setSpConfirm]             = useState('')
  const [spLoading, setSpLoading]             = useState(false)
  const [spError, setSpError]                 = useState('')
  const [spSuccess, setSpSuccess]             = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await login(username, password)
      navigate('/home')
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally { setLoginLoading(false) }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setSpError('')
    if (spPassword !== spConfirm) { setSpError('Passwords do not match'); return }
    if (spPassword.length < 6)    { setSpError('Password must be at least 6 characters'); return }
    setSpLoading(true)
    try {
      await setPassword(spUsername, spAccountName, spPassword)
      setSpSuccess(true)
    } catch (err: unknown) {
      setSpError(err instanceof Error ? err.message : 'Failed to set password')
    } finally { setSpLoading(false) }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setLoginError('')
    setSpError('')
    setSpSuccess(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-yellow-600/10 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-start justify-end p-16">
          <div className="mb-8">
            <div className="flex items-center gap-1 mb-6">
              <span className="text-yellow-400 text-3xl font-black">chester</span>
              <span className="text-white text-3xl font-black">-bi</span>
            </div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4">
              Turn data into<br />
              <span className="text-yellow-400">decisions</span>
            </h2>
            <p className="text-white/50 text-lg max-w-sm leading-relaxed">
              Your modern business intelligence platform for teams that move fast.
            </p>
          </div>
          <div className="flex gap-4">
            {['247 Dashboards', '18K+ Users', '99.9% Uptime'].map((stat) => (
              <div key={stat} className="px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                <p className="text-yellow-400 text-sm font-semibold">{stat}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-1 mb-10 lg:hidden">
            <span className="text-yellow-400 text-2xl font-black">chester</span>
            <span className="text-white text-2xl font-black">-bi</span>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/8 mb-8">
            {([
              { id: 'login',        label: 'Sign In',      icon: <LogIn className="w-3.5 h-3.5" /> },
              { id: 'set-password', label: 'Set Password', icon: <KeyRound className="w-3.5 h-3.5" /> },
            ] as { id: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  tab === t.id
                    ? 'bg-yellow-400 text-black shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ── Sign In ─────────────────────────────────────────────────── */}
            {tab === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-black text-white mb-2">Welcome back</h1>
                  <p className="text-white/40">Sign in to your chester-bi account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                  <AppInput label="Username" placeholder="Enter your username"
                    value={username} onValueChange={setUsername} isRequired />
                  <AppInput label="Password" placeholder="Enter your password" password
                    value={password} onValueChange={setPassword_} isRequired />

                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {loginError}
                    </motion.div>
                  )}

                  <Button type="submit"
                    className="w-full bg-yellow-400 text-black font-bold text-base h-12 hover:bg-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.2)]"
                    isLoading={loginLoading}
                  >
                    Sign In
                  </Button>
                </form>

                <p className="text-center text-white/40 mt-6 text-sm">
                  Don&apos;t have an account?{' '}
                  <Link className="text-yellow-400 hover:text-yellow-300 cursor-pointer font-medium" onPress={() => navigate('/register')}>
                    Create one
                  </Link>
                </p>

                <p className="text-center text-white/30 mt-3 text-sm">
                  First time login?{' '}
                  <button onClick={() => switchTab('set-password')} className="text-yellow-400/70 hover:text-yellow-400 transition-colors font-medium">
                    Set your password
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── Set Password ─────────────────────────────────────────────── */}
            {tab === 'set-password' && (
              <motion.div
                key="set-password"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-8">
                  <h1 className="text-3xl font-black text-white mb-2">Set Password</h1>
                  <p className="text-white/40">Create a password for your account</p>
                </div>

                {spSuccess ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8 space-y-4"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-green-400/10 border border-green-400/20 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">Password set!</p>
                      <p className="text-white/40 text-sm mt-1">You can now sign in with your new password.</p>
                    </div>
                    <Button
                      className="bg-yellow-400 text-black font-bold hover:bg-yellow-300"
                      onPress={() => switchTab('login')}
                    >
                      Go to Sign In
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSetPassword} className="space-y-5">
                    <AppInput label="Username" placeholder="Your username"
                      value={spUsername} onValueChange={setSpUsername} isRequired />
                    <AppInput label="Account Name" placeholder="Your organization / account name"
                      value={spAccountName} onValueChange={setSpAccountName} isRequired />
                    <AppInput label="New Password" password placeholder="Choose a strong password"
                      value={spPassword} onValueChange={setSpPassword} isRequired />
                    <AppInput label="Confirm Password" password placeholder="Repeat your password"
                      value={spConfirm} onValueChange={setSpConfirm} isRequired />

                    {spError && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                      >
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {spError}
                      </motion.div>
                    )}

                    <Button type="submit"
                      className="w-full bg-yellow-400 text-black font-bold text-base h-12 hover:bg-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.2)]"
                      isLoading={spLoading}
                    >
                      Set Password
                    </Button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 mt-8 text-white/30 hover:text-white/60 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
        </motion.div>
      </div>
    </div>
  )
}
