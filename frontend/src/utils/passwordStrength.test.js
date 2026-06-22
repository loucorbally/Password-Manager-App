import { describe, it, expect } from 'vitest'
import { analysePassword } from '../utils/passwordStrength'

// ─────────────────────────────────────────────
// Empty / null input
// ─────────────────────────────────────────────
describe('analysePassword — empty input', () => {
  it('returns null tier for empty string', () => {
    expect(analysePassword('').tier).toBeNull()
  })

  it('returns score of 0 for empty string', () => {
    expect(analysePassword('').score).toBe(0)
  })

  it('returns empty checks array for empty string', () => {
    expect(analysePassword('').checks).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────
// Tier classification
// ─────────────────────────────────────────────
describe('analysePassword — tier classification', () => {
  it('classifies a very weak password as weak', () => {
    expect(analysePassword('123456').tier).toBe('weak')
  })

  it('classifies a short common word as weak', () => {
    expect(analysePassword('password').tier).toBe('weak')
  })

it('classifies a moderate password correctly', () => {
  // 12+ chars, has upper/lower/number but no symbol — scores moderate
  expect(analysePassword('HelloWorldAbc1').tier).toBe('moderate')
})

  it('classifies a strong password correctly', () => {
    expect(analysePassword('X#9kL$mP2qRt!nWv').tier).toBe('strong')
  })

  it('classifies a long complex password as strong', () => {
    expect(analysePassword('Tr0ub4dor&3HorseBattery!').tier).toBe('strong')
  })
})

// ─────────────────────────────────────────────
// Individual checks
// ─────────────────────────────────────────────
describe('analysePassword — length check', () => {
  it('fails length check for password under 12 characters', () => {
    const result = analysePassword('Short1!')
    const lengthCheck = result.checks.find(c => c.id === 'length')
    expect(lengthCheck.passed).toBe(false)
  })

  it('passes length check for password of exactly 12 characters', () => {
    const result = analysePassword('Abcdef1!ghij')
    const lengthCheck = result.checks.find(c => c.id === 'length')
    expect(lengthCheck.passed).toBe(true)
  })

  it('passes length check for password over 12 characters', () => {
    const result = analysePassword('MyLongPassword1!')
    const lengthCheck = result.checks.find(c => c.id === 'length')
    expect(lengthCheck.passed).toBe(true)
  })
})

describe('analysePassword — character diversity checks', () => {
  it('fails uppercase check when no uppercase letters present', () => {
    const result = analysePassword('nouppercase123!')
    const check = result.checks.find(c => c.id === 'uppercase')
    expect(check.passed).toBe(false)
  })

  it('passes uppercase check when uppercase letters present', () => {
    const result = analysePassword('HasUpperCase1!')
    const check = result.checks.find(c => c.id === 'uppercase')
    expect(check.passed).toBe(true)
  })

  it('fails lowercase check when no lowercase letters present', () => {
    const result = analysePassword('NOLOWERCASE123!')
    const check = result.checks.find(c => c.id === 'lowercase')
    expect(check.passed).toBe(false)
  })

  it('passes lowercase check when lowercase letters present', () => {
    const result = analysePassword('HasLowercase1!')
    const check = result.checks.find(c => c.id === 'lowercase')
    expect(check.passed).toBe(true)
  })

  it('fails number check when no digits present', () => {
    const result = analysePassword('NoNumbers!Here')
    const check = result.checks.find(c => c.id === 'number')
    expect(check.passed).toBe(false)
  })

  it('passes number check when digits present', () => {
    const result = analysePassword('HasNumbers123!')
    const check = result.checks.find(c => c.id === 'number')
    expect(check.passed).toBe(true)
  })

  it('fails symbol check when no special characters present', () => {
    const result = analysePassword('NoSymbolsHere123')
    const check = result.checks.find(c => c.id === 'symbol')
    expect(check.passed).toBe(false)
  })

  it('passes symbol check when special characters present', () => {
    const result = analysePassword('HasSymbol!123Ab')
    const check = result.checks.find(c => c.id === 'symbol')
    expect(check.passed).toBe(true)
  })
})

// ─────────────────────────────────────────────
// Pattern detection
// ─────────────────────────────────────────────
describe('analysePassword — pattern detection', () => {
  it('fails pattern check for sequential numbers', () => {
    const result = analysePassword('MyPass1234!')
    const check = result.checks.find(c => c.id === 'noPattern')
    expect(check.passed).toBe(false)
  })

  it('fails pattern check for keyboard pattern qwerty', () => {
    const result = analysePassword('Qwerty123!Ab')
    const check = result.checks.find(c => c.id === 'noPattern')
    expect(check.passed).toBe(false)
  })

  it('fails pattern check for common word "password"', () => {
    const result = analysePassword('Password123!')
    const check = result.checks.find(c => c.id === 'noPattern')
    expect(check.passed).toBe(false)
  })

  it('passes pattern check for random string with no patterns', () => {
    const result = analysePassword('X#9kL$mP2qRt!nWv')
    const check = result.checks.find(c => c.id === 'noPattern')
    expect(check.passed).toBe(true)
  })

  it('is case insensitive when detecting common patterns', () => {
    const result = analysePassword('QWERTY123!Ab')
    const check = result.checks.find(c => c.id === 'noPattern')
    expect(check.passed).toBe(false)
  })
})

// ─────────────────────────────────────────────
// Score and entropy
// ─────────────────────────────────────────────
describe('analysePassword — score and entropy', () => {
  it('returns a score between 0 and 100', () => {
    const passwords = ['123', 'Hello1!', 'X#9kL$mP2qRt!nWv', '']
    passwords.forEach(pw => {
      const { score } = analysePassword(pw)
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    })
  })

  it('strong password scores higher than weak password', () => {
    const weak = analysePassword('123456')
    const strong = analysePassword('X#9kL$mP2qRt!nWv')
    expect(strong.score).toBeGreaterThan(weak.score)
  })

  it('returns higher entropy for longer passwords', () => {
    const short = analysePassword('Abc1!')
    const long = analysePassword('Abc1!Abc1!Abc1!Abc1!')
    expect(long.entropy).toBeGreaterThan(short.entropy)
  })

  it('returns entropy of 0 for empty password', () => {
    expect(analysePassword('').entropy).toBe(0)
  })
})

// ─────────────────────────────────────────────
// Tips
// ─────────────────────────────────────────────
describe('analysePassword — tips', () => {
  it('returns no tips for a strong password', () => {
    const result = analysePassword('X#9kL$mP2qRt!nWv')
    expect(result.tips).toHaveLength(0)
  })

  it('returns a tip about length when password is too short', () => {
    const result = analysePassword('Hi1!')
    expect(result.tips.some(t => t.toLowerCase().includes('12 characters'))).toBe(true)
  })

  it('returns a tip about symbols when none are present', () => {
    const result = analysePassword('NoSymbolsHere123')
    expect(result.tips.some(t => t.toLowerCase().includes('special'))).toBe(true)
  })

  it('returns a tip about patterns when sequential chars detected', () => {
    const result = analysePassword('MyPass1234!')
    expect(result.tips.some(t => t.toLowerCase().includes('sequences'))).toBe(true)
  })
})

// ─────────────────────────────────────────────
// Repeated characters penalty
// ─────────────────────────────────────────────
describe('analysePassword — repeated character penalty', () => {
  it('penalises passwords with three or more repeated characters', () => {
    const withRepeats = analysePassword('Aaaa1234!XyZ')
    const withoutRepeats = analysePassword('Abcd1234!XyZ')
    expect(withRepeats.score).toBeLessThan(withoutRepeats.score)
  })

  it('returns a tip about repeated characters', () => {
    const result = analysePassword('Aaaa1234!XyZqW')
    expect(result.tips.some(t => t.toLowerCase().includes('repeating'))).toBe(true)
  })
})
