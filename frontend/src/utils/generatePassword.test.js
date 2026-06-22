import { describe, it, expect } from 'vitest'
import { generatePassword } from '../utils/generatePassword'
import { analysePassword } from '../utils/passwordStrength'

// ─────────────────────────────────────────────
// Length
// ─────────────────────────────────────────────
describe('generatePassword — length', () => {
  it('generates a password of the default length (18)', () => {
    expect(generatePassword()).toHaveLength(18)
  })

  it('generates a password of a custom length', () => {
    expect(generatePassword(24)).toHaveLength(24)
  })

  it('generates a password of minimum length 1', () => {
    expect(generatePassword(1)).toHaveLength(1)
  })

  it('generates a password of length 32', () => {
    expect(generatePassword(32)).toHaveLength(32)
  })
})

// ─────────────────────────────────────────────
// Randomness
// ─────────────────────────────────────────────
describe('generatePassword — randomness', () => {
  it('generates a different password each time', () => {
    const first = generatePassword()
    const second = generatePassword()
    expect(first).not.toBe(second)
  })

  it('generates unique passwords across 10 runs', () => {
    const passwords = Array.from({ length: 10 }, () => generatePassword())
    const unique = new Set(passwords)
    expect(unique.size).toBe(10)
  })
})

// ─────────────────────────────────────────────
// Character set
// ─────────────────────────────────────────────
describe('generatePassword — character set', () => {
  it('only contains valid characters', () => {
    const validChars = /^[A-Za-z0-9!@#$%^&*]+$/
    // Run multiple times to increase confidence
    for (let i = 0; i < 20; i++) {
      expect(generatePassword()).toMatch(validChars)
    }
  })

  it('returns a string', () => {
    expect(typeof generatePassword()).toBe('string')
  })

  it('does not contain spaces', () => {
    for (let i = 0; i < 10; i++) {
      expect(generatePassword()).not.toContain(' ')
    }
  })
})

// ─────────────────────────────────────────────
// Security strength
// ─────────────────────────────────────────────
describe('generatePassword — security strength', () => {
  it('never generates a weak password', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword()
      expect(analysePassword(pw).tier).not.toBe('weak')
    }
  })

  it('generates passwords that are mostly strong', () => {
    const results = Array.from({ length: 20 }, () => analysePassword(generatePassword()).tier)
    const strongCount = results.filter(t => t === 'strong').length
    // At least 15 out of 20 should be strong
    expect(strongCount).toBeGreaterThanOrEqual(15)
  })

  it('generates passwords with a score above 50', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword()
      expect(analysePassword(pw).score).toBeGreaterThan(50)
    }
  })

  it('generates passwords with entropy above 80 bits', () => {
    for (let i = 0; i < 10; i++) {
      const pw = generatePassword()
      expect(analysePassword(pw).entropy).toBeGreaterThan(80)
    }
  })
})