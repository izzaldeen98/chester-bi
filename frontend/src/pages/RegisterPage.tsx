import { useState } from 'react'
import { Button, Link } from '@heroui/react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, PartyPopper } from '../lib/icons'
import { GiJesterHat } from 'react-icons/gi'
import { useAuth } from '../contexts/AuthContext'
import { AppInput } from '../components/ui/AppInput'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
  })

  function update(field: string) {
    return (value: string) => setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-2/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-yellow-600/10 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-start justify-center p-16">
          <div className="flex items-center gap-1 mb-8">
            <GiJesterHat className="text-yellow-400 text-4xl flex-shrink-0" />
            <span className="text-yellow-400 text-3xl font-black">chester</span>
            <span className="text-white text-3xl font-black">BI</span>
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-4">
            Start your<br />
            <span className="text-yellow-400">BI journey</span><br />
            today
          </h2>
          <p className="text-white/50 text-base max-w-xs leading-relaxed mb-10">
            Create your organization account and invite your team to start building dashboards.
          </p>
          <div className="space-y-3">
            {[
              '✓ Unlimited dashboards',
              '✓ Semantic model builder',
              '✓ Role-based access control',
              '✓ Real-time collaboration',
            ].map((item) => (
              <p key={item} className="text-white/60 text-sm">{item}</p>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-3/5 flex items-center justify-center p-8 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg py-8"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-1 mb-8 lg:hidden">
            <GiJesterHat className="text-yellow-400 text-3xl flex-shrink-0" />
            <span className="text-yellow-400 text-2xl font-black">chester</span>
            <span className="text-gray-900 dark:text-white text-2xl font-black">BI</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Create your account</h1>
            <p className="text-gray-500 dark:text-white/40">Set up your organization on chesterBI</p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center mx-auto mb-4">
                <PartyPopper className="w-7 h-7 text-yellow-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Account created!</h3>
              <p className="text-gray-500 dark:text-white/40">Redirecting you to sign in…</p>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest mb-3">
                  Organization
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <AppInput
                    label="Organization Name"
                    placeholder="Acme Corp"
                    value={form.name}
                    onValueChange={update('name')}
                    isRequired
                  />
                  <AppInput
                    label="Description"
                    placeholder="What does your org do?"
                    value={form.description}
                    onValueChange={update('description')}
                    isRequired
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              <div>
                <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest mb-3">
                  Your Profile
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <AppInput
                    label="First Name"
                    placeholder="John"
                    value={form.first_name}
                    onValueChange={update('first_name')}
                    isRequired
                  />
                  <AppInput
                    label="Last Name"
                    placeholder="Doe"
                    value={form.last_name}
                    onValueChange={update('last_name')}
                    isRequired
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              <div>
                <p className="text-xs font-semibold text-yellow-400/80 uppercase tracking-widest mb-3">
                  Account Credentials
                </p>
                <div className="space-y-4">
                  <AppInput
                    label="Username"
                    placeholder="johndoe"
                    value={form.username}
                    onValueChange={update('username')}
                    isRequired
                  />
                  <AppInput
                    label="Email"
                    placeholder="john@acme.com"
                    type="email"
                    value={form.email}
                    onValueChange={update('email')}
                    isRequired
                  />
                  <AppInput
                    label="Password"
                    placeholder="Create a strong password"
                    password
                    value={form.password}
                    onValueChange={update('password')}
                    isRequired
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                className="w-full bg-yellow-400 text-black font-bold text-base h-12 hover:bg-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.2)]"
                isLoading={loading}
              >
                Create Account
              </Button>
            </form>
          )}

          <p className="text-center text-gray-500 dark:text-white/40 mt-6 text-sm">
            Already have an account?{' '}
            <Link
              className="text-yellow-400 hover:text-yellow-300 cursor-pointer font-medium"
              onPress={() => navigate('/login')}
            >
              Sign in
            </Link>
          </p>

          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 mt-6 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
        </motion.div>
      </div>
    </div>
  )
}
