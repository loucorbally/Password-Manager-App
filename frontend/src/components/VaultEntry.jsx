import { useState } from 'react'

const SITE_COLORS = {
  GitHub: 'bg-zinc-700',
  Google: 'bg-blue-600',
  Figma: 'bg-purple-600',
  Notion: 'bg-zinc-600',
  Netflix: 'bg-red-600',
}

const API = 'http://127.0.0.1:5000'

export default function VaultEntry({ entry, masterPassword, onEdit, onDelete }) {
  const [revealed, setRevealed] = useState(false)
  const [revealedPassword, setRevealedPassword] = useState(null)
  const [revealing, setRevealing] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchPassword = async () => {
    if (revealedPassword) return revealedPassword
    const res = await fetch(`${API}/api/credentials/${entry.id}/reveal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ master_password: masterPassword }),
    })
    if (!res.ok) throw new Error('Decrypt failed')
    const data = await res.json()
    setRevealedPassword(data.password)
    return data.password
  }

  const handleReveal = async () => {
    if (revealed) { setRevealed(false); return }
    if (revealedPassword) { setRevealed(true); return }
    setRevealing(true)
    try {
      await fetchPassword()
      setRevealed(true)
    } catch {
      // silently ignore — user sees dots
    } finally {
      setRevealing(false)
    }
  }

  const copyPassword = async () => {
    try {
      const pw = await fetchPassword()
      await navigator.clipboard.writeText(pw)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // silently ignore
    }
  }

  const initials = entry.site.slice(0, 2).toUpperCase()
  const color = SITE_COLORS[entry.site] || 'bg-indigo-700'

  return (
    <div className="group flex items-center gap-4 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700
      rounded-2xl px-5 py-4 transition-all duration-200">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
        {initials}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white text-sm">{entry.site}</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
            {entry.category}
          </span>
        </div>
        <p className="text-zinc-500 text-xs mt-0.5 truncate">{entry.username}</p>
      </div>

      <div className="hidden sm:flex items-center gap-2 font-mono text-sm text-zinc-400 min-w-[140px]">
        <span className="truncate max-w-[120px]">
          {revealed && revealedPassword ? revealedPassword : '••••••••••••'}
        </span>
        <button
          onClick={handleReveal}
          disabled={revealing}
          className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0 disabled:opacity-40"
          title={revealed ? 'Hide' : 'Reveal'}
        >
          {revealing ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : revealed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={copyPassword}
          title="Copy password"
          className={`p-2 rounded-lg transition-all ${
            copied ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
          }`}
        >
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        <button
          onClick={() => onEdit(entry)}
          title="Edit"
          className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>

        <button
          onClick={() => onDelete(entry.id)}
          title="Delete"
          className="p-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  )
}
