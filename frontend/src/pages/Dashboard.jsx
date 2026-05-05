import { useState, useEffect } from 'react'
import VaultEntry from '../components/VaultEntry'
import AddEditModal from '../components/AddEditModal'

const CATEGORIES = ['All', 'Personal', 'Work', 'Dev', 'Uni']
const API = 'http://127.0.0.1:5000'

export default function Dashboard({ user, masterPassword, onLogout }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/api/credentials`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        setEntries(data.items.map(item => ({
          id: item.id,
          site: item.service,
          username: item.login,
          url: item.url || '',
          category: item.category || 'Personal',
        })))
      })
      .catch(() => setError('Failed to load vault. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = entries.filter((e) => {
    const matchCat = category === 'All' || e.category === category
    const matchSearch =
      e.site.toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleSave = async (entry) => {
    setError('')
    const body = {
      site: entry.site,
      username: entry.username,
      url: entry.url || '',
      category: entry.category,
      master_password: masterPassword,
    }
    if (entry.password) body.password = entry.password

    try {
      if (entry.id) {
        const res = await fetch(`${API}/api/credentials/${entry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const d = await res.json()
          setError(d.error || 'Failed to update credential.')
          return
        }
        setEntries(entries.map(e =>
          e.id === entry.id
            ? { ...e, site: entry.site, username: entry.username, url: entry.url || '', category: entry.category }
            : e
        ))
      } else {
        if (!entry.password) { setError('Password is required.'); return }
        const res = await fetch(`${API}/api/credentials`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const d = await res.json()
          setError(d.error || 'Failed to add credential.')
          return
        }
        const data = await res.json()
        setEntries([
          { id: data.id, site: entry.site, username: entry.username, url: entry.url || '', category: entry.category },
          ...entries,
        ])
      }
    } catch {
      setError('Network error. Is the backend running?')
      return
    }

    setModalOpen(false)
    setEditEntry(null)
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`${API}/api/credentials/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setEntries(entries.filter(e => e.id !== id))
    } catch {
      setError('Failed to delete credential.')
    }
  }

  const handleEdit = (entry) => {
    setEditEntry(entry)
    setModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px] pointer-events-none" />

      <header className="relative border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight">Capstone Password</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500 text-sm hidden sm:block">{user.email}</span>
            <button
              onClick={onLogout}
              className="text-zinc-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="relative max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 text-xs shrink-0">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Passwords', value: entries.length, icon: '🔑' },
            { label: 'Categories', value: CATEGORIES.length - 1, icon: '📁' },
            { label: 'Vault Status', value: 'Encrypted', icon: '🔒' },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-2xl px-5 py-4">
              <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">{s.label}</p>
              <p className="text-white text-2xl font-bold">{s.icon} {s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search passwords..."
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm
                placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/40 transition-all"
            />
          </div>

          <div className="flex gap-1.5 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  category === c ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setEditEntry(null); setModalOpen(true) }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold
              px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Password
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-zinc-500">
            <svg className="w-6 h-6 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm">Loading vault...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-600">
            <p className="text-5xl mb-3">🔍</p>
            <p className="text-lg font-medium text-zinc-400">No passwords found</p>
            <p className="text-sm mt-1">Try adjusting your search or category filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((entry) => (
              <VaultEntry
                key={entry.id}
                entry={entry}
                masterPassword={masterPassword}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {modalOpen && (
        <AddEditModal
          entry={editEntry}
          categories={CATEGORIES.filter(c => c !== 'All')}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditEntry(null) }}
        />
      )}
    </div>
  )
}
