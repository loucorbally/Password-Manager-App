import { useState } from 'react'

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const isStrongPassword = (pw) => {
    if (!pw || pw.length < 12) return false
    const hasLower = /[a-z]/.test(pw)
    const hasUpper = /[A-Z]/.test(pw)
    const hasDigit = /\d/.test(pw)
    const hasSymbol = /[^A-Za-z0-9]/.test(pw)
    return hasLower && hasUpper && hasDigit && hasSymbol
  }

  const handleSubmit = async (e) => {
  e.preventDefault()
  setError('')

  if (mode === 'register' && form.password !== form.confirm) {
    setError('Passwords do not match.')
    return
  }

  // match backend rules (12+ upper/lower/digit/symbol)
  if (!isStrongPassword(form.password)) {
    setError('Password must be 12+ chars and include upper/lower/digit/symbol.')
    return
  }

  setLoading(true)
  try {
    const endpoint =
      mode === 'login'
        ? 'http://127.0.0.1:5000/api/login'
        : 'http://127.0.0.1:5000/api/register'

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // keep flask-login cookie session
      body: JSON.stringify({
        email: form.email,
        password: form.password,
        confirm: form.confirm,
      }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data?.error || 'Authentication failed.')
      return
    }

    onAuth(data.user) // { email: ... }
  } catch (err) {
    setError('Network error. Is the backend running on port 5000?')
  } finally {
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      {/* Glow blob */}
      <div className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
            <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Capstone Password
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Your encrypted password vault</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/70 backdrop-blur border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          {/* Tab toggle */}
          <div className="flex bg-zinc-800/60 rounded-xl p-1 mb-8">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setForm({ email: '', password: '', confirm: '' }) }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  mode === m
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                Master Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required
                placeholder="••••••••••••"
                className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
              />
            </div>

            {/* Confirm password (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirm"
                  value={form.confirm}
                  onChange={handleChange}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-zinc-800/80 border border-zinc-700 rounded-xl px-4 py-3 text-white text-sm placeholder-zinc-600
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed
                text-white font-semibold py-3 rounded-xl transition-all duration-200 mt-2
                shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/35"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          {mode === 'login' && (
            <p className="text-center text-zinc-600 text-xs mt-6">
              Your vault is end-to-end encrypted. We never see your passwords.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
