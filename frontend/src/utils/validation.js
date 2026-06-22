export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateLoginForm(email, password) {
  if (!email) return 'Email is required'
  if (!validateEmail(email)) return 'Invalid email format'
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function validateRegisterForm(email, password, confirm) {
  if (!email) return 'Email is required'
  if (!validateEmail(email)) return 'Invalid email format'
  if (!password) return 'Password is required'
  if (password.length < 8) return 'Password must be at least 8 characters'
  if (password !== confirm) return 'Passwords do not match'
  return null
}