import { Button } from '@heroui/react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart2, BrainCircuit, Link2, Users } from 'lucide-react'

const features = [
  {
    icon: <BarChart2 className="w-6 h-6" />,
    title: 'Interactive Dashboards',
    description: 'Build stunning, real-time dashboards that turn raw data into actionable insights.',
  },
  {
    icon: <BrainCircuit className="w-6 h-6" />,
    title: 'Semantic Models',
    description: 'Define business logic once and reuse across all your queries and visualizations.',
  },
  {
    icon: <Link2 className="w-6 h-6" />,
    title: 'Multiple Connections',
    description: 'Connect to any database — PostgreSQL, MySQL, BigQuery, and more.',
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: 'Team Collaboration',
    description: 'Manage roles and permissions, share dashboards with your entire organization.',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-black/60 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-1">
          <span className="text-yellow-400 text-2xl font-black tracking-tight">chester</span>
          <span className="text-white text-2xl font-black tracking-tight">-bi</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-white/80 hover:text-white" onPress={() => navigate('/login')}>
            Sign In
          </Button>
          <Button className="bg-yellow-400 text-black font-semibold hover:bg-yellow-300" onPress={() => navigate('/register')}>
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-yellow-400/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-yellow-500/5 blur-[100px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              Open-source Business Intelligence
            </div>

            <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight">
              Data Intelligence,{' '}
              <span className="text-yellow-400">Reimagined</span>
            </h1>

            <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
              chester-bi gives your team a unified platform to explore, visualize, and share data —
              fast, flexible, and beautifully designed.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-yellow-400 text-black font-bold text-base px-8 hover:bg-yellow-300 shadow-[0_0_40px_rgba(250,204,21,0.3)]"
                onPress={() => navigate('/register')}
              >
                Start for Free
              </Button>
              <Button
                size="lg"
                variant="bordered"
                className="border-white/20 text-white/80 hover:border-yellow-400/50 hover:text-white text-base px-8"
                onPress={() => navigate('/login')}
              >
                Sign In
              </Button>
            </div>
          </motion.div>

          {/* Dashboard preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
            className="mt-20"
          >
            <div className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 px-4 py-3 bg-white/5 border-b border-white/10">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <span className="w-3 h-3 rounded-full bg-green-500/70" />
                <span className="ml-4 text-white/30 text-xs font-mono">chester-bi — Dashboard</span>
              </div>
              <div className="p-6 grid grid-cols-3 gap-4">
                {[
                  { label: 'Total Revenue', value: '$2.4M', trend: '+12.5%' },
                  { label: 'Active Users', value: '18,432', trend: '+8.1%' },
                  { label: 'Dashboards', value: '247', trend: '+3' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-white/40 text-xs mb-1">{stat.label}</p>
                    <p className="text-white text-2xl font-bold">{stat.value}</p>
                    <p className="text-yellow-400 text-xs mt-1">{stat.trend}</p>
                  </div>
                ))}
              </div>
              <div className="px-6 pb-6">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/40 text-xs mb-3">Revenue Trend</p>
                  <div className="flex items-end gap-2 h-16">
                    {[40, 65, 45, 80, 55, 90, 70, 95, 60, 100, 75, 88].map((h, i) => (
                      <div key={i} className="flex-1 rounded-sm bg-yellow-400/30" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-black mb-4">
            Everything you need to{' '}
            <span className="text-yellow-400">understand your data</span>
          </h2>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            A complete BI platform built for modern data teams.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-yellow-400/30 hover:bg-yellow-400/5 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 mb-4">
                {f.icon}
              </div>
              <h3 className="text-xl font-bold mb-2 group-hover:text-yellow-400 transition-colors">
                {f.title}
              </h3>
              <p className="text-white/40 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center rounded-3xl bg-yellow-400/10 border border-yellow-400/20 p-16"
        >
          <h2 className="text-4xl font-black mb-4">Ready to get started?</h2>
          <p className="text-white/50 mb-8 text-lg">
            Join thousands of data teams already using chester-bi.
          </p>
          <Button
            size="lg"
            className="bg-yellow-400 text-black font-bold text-base px-10 hover:bg-yellow-300 shadow-[0_0_40px_rgba(250,204,21,0.4)]"
            onPress={() => navigate('/register')}
          >
            Create Free Account
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <span className="text-yellow-400 font-black">chester</span>
            <span className="font-black">-bi</span>
          </div>
          <p className="text-white/30 text-sm">© 2026 chester-bi. Open-source BI platform.</p>
        </div>
      </footer>
    </div>
  )
}
