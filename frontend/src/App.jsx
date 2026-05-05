import { useState } from 'react'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [masterPassword, setMasterPassword] = useState(null)

  const handleAuth = (userFromBackend, password) => {
    setUser(userFromBackend)
    setMasterPassword(password)
  }

  const handleLogout = async () => {
    try {
      await fetch('http://127.0.0.1:5000/api/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore network errors on logout
    }
    setUser(null)
    setMasterPassword(null)
  }

  if (!user) return <AuthPage onAuth={handleAuth} />

  return <Dashboard user={user} masterPassword={masterPassword} onLogout={handleLogout} />
}
