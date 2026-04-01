import { useState } from 'react'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

export default function App() {
  // stores the currently logged in user
  // null means no user is logged in
  const [user, setUser] = useState(null)

  //if no user is logged in, dislay the login / register page
  if (!user) return <AuthPage onAuth={setUser} />

  //if user is logged in, display the dashboard
  return <Dashboard user={user} onLogout={() => setUser(null)} />
}

