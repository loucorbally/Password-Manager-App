import { useState } from 'react'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [user, setUser] = useState(null)

  if (!user) return <AuthPage onAuth={setUser} />
  return <Dashboard user={user} onLogout={() => setUser(null)} />
}

