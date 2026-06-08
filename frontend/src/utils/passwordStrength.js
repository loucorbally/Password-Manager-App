// Password Strength Analyser
// Evaluates passwords based on NIST SP 800-63B guidelines

const COMMON_PATTERNS = [
  // Sequential numbers
  '0123', '1234', '2345', '3456', '4567', '5678', '6789', '7890',
  // Keyboard patterns
  'qwerty', 'qwert', 'werty', 'asdf', 'zxcv', 'qazwsx', 'dvorak',
  // Common words
  'password', 'passwd', 'letmein', 'welcome', 'admin', 'login',
  'monkey', 'dragon', 'master', 'sunshine', 'princess', 'football',
]

/**
 * Calculates approximate entropy bits based on character pool and length
 */
function calcEntropy(password) {
  let poolSize = 0
  if (/[a-z]/.test(password)) poolSize += 26
  if (/[A-Z]/.test(password)) poolSize += 26
  if (/[0-9]/.test(password)) poolSize += 10
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32
  if (poolSize === 0) return 0
  return Math.floor(password.length * Math.log2(poolSize))
}

/**
 * Checks for sequential characters (abc, 123, etc.)
 */
function hasSequentialChars(password) {
  const lower = password.toLowerCase()
  for (let i = 0; i < lower.length - 2; i++) {
    const a = lower.charCodeAt(i)
    const b = lower.charCodeAt(i + 1)
    const c = lower.charCodeAt(i + 2)
    if (b === a + 1 && c === b + 1) return true
  }
  return false
}

/**
 * Checks for repeated characters (aaa, 111, etc.)
 */
function hasRepeatedChars(password) {
  for (let i = 0; i < password.length - 2; i++) {
    if (password[i] === password[i + 1] && password[i + 1] === password[i + 2]) return true
  }
  return false
}

/**
 * Main analyser function — returns a full analysis object
 */
export function analysePassword(password) {
  if (!password) {
    return { tier: null, score: 0, entropy: 0, checks: [], tips: [] }
  }

  const lower = password.toLowerCase()

  // --- Individual checks ---
  const checks = [
    {
      id: 'length',
      label: 'At least 12 characters',
      passed: password.length >= 12,
      weight: 25,
    },
    {
      id: 'uppercase',
      label: 'Uppercase letter (A-Z)',
      passed: /[A-Z]/.test(password),
      weight: 15,
    },
    {
      id: 'lowercase',
      label: 'Lowercase letter (a-z)',
      passed: /[a-z]/.test(password),
      weight: 15,
    },
    {
      id: 'number',
      label: 'Number (0-9)',
      passed: /[0-9]/.test(password),
      weight: 15,
    },
    {
      id: 'symbol',
      label: 'Special character (!@#$...)',
      passed: /[^a-zA-Z0-9]/.test(password),
      weight: 20,
    },
    {
      id: 'noPattern',
      label: 'No common patterns',
      passed: !COMMON_PATTERNS.some(p => lower.includes(p)) && !hasSequentialChars(password),
      weight: 10,
    },
  ]

  // --- Score calculation ---
  const score = checks.reduce((acc, c) => acc + (c.passed ? c.weight : 0), 0)
  const entropy = calcEntropy(password)

  // --- Penalties ---
  let penalisedScore = score
  if (hasRepeatedChars(password)) penalisedScore -= 10
  if (password.length < 8) penalisedScore -= 20
  penalisedScore = Math.max(0, Math.min(100, penalisedScore))

  // --- Tier classification ---
  let tier
  if (penalisedScore >= 80 && entropy >= 50) {
    tier = 'strong'
  } else if (penalisedScore >= 50) {
    tier = 'moderate'
  } else {
    tier = 'weak'
  }

  // --- Actionable tips ---
  const tips = []
  if (!checks.find(c => c.id === 'length').passed) tips.push('Use at least 12 characters — length is the biggest factor in password strength.')
  if (!checks.find(c => c.id === 'symbol').passed) tips.push('Add special characters like !, @, #, $ to significantly increase complexity.')
  if (!checks.find(c => c.id === 'uppercase').passed || !checks.find(c => c.id === 'lowercase').passed) tips.push('Mix uppercase and lowercase letters.')
  if (!checks.find(c => c.id === 'number').passed) tips.push('Include at least one number.')
  if (!checks.find(c => c.id === 'noPattern').passed) tips.push('Avoid sequences like "1234" or "qwerty" — these are cracked instantly.')
  if (hasRepeatedChars(password)) tips.push('Avoid repeating the same character three or more times in a row.')

  return { tier, score: penalisedScore, entropy, checks, tips }
}

export const TIER_CONFIG = {
  strong: {
    label: 'Strong',
    color: 'text-emerald-400',
    barColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
    description: 'High entropy — exceeds all complexity requirements.',
  },
  moderate: {
    label: 'Moderate',
    color: 'text-amber-400',
    barColor: 'bg-amber-500',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    description: 'Basic requirements met, but vulnerable to advanced attacks.',
  },
  weak: {
    label: 'Weak',
    color: 'text-red-400',
    barColor: 'bg-red-500',
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/10',
    description: 'Fails minimum security thresholds — improvement required.',
  },
}
