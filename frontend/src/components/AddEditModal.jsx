import { useState, useEffect } from 'react'

export default function AddEditModal({ entry, categories, onSave, onClose }) {
  const [form, setForm] = useState({
    site: '',
    username: '',
    password: '',
    url: '',
    category: categories[0],
  })
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    if (entry) setForm(entry)
  }, [entry])

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const arr = new Uint32Array(18)
    crypto.getRandomValues(arr)
    const pw = Array.from(arr, (n) => chars[n % chars.length]).join('')
    setForm({ ...form, password: pw })
    setShowPass(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-bold text-lg">{entry ? 'Edit Password' : 'Add Password'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Site Name', name: 'site', type: 'text', placeholder: 'e.g. GitHub' },
            { label: 'Username / Email', name: 'username', type: 'text', placeholder: 'you@example.com' },
            { label: 'Website URL', name: 'url', type: 'text', placeholder: 'github.com' },
          ].map((f) => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">{f.label}</label>
              <input
                type={f.type}
                name={f.name}
                value={form[f.name]}
                onChange={handleChange}
                required={f.name !== 'url'}
                placeholder={f.placeholder}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm
                  placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
              />
            </div>
          ))}

          {/* Password field */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
              Password{entry && <span className="normal-case text-zinc-600 ml-1">(leave blank to keep current)</span>}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required={!entry}
                  placeholder={entry ? 'Leave blank to keep current' : '••••••••••••'}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 pr-10 text-white text-sm font-mono
                    placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPass
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M3 3l18 18" />
                      : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                    }
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={generatePassword}
                title="Generate strong password"
                className="px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-white text-sm
                focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 rounded-xl transition-all">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20">
              {entry ? 'Save Changes' : 'Add Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

