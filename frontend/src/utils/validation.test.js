import { describe, it, expect } from 'vitest'
import { validateEmail, validateLoginForm, validateRegisterForm } from '../utils/validation'

describe('validateEmail', () => {
  it('returns true for a valid email', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('returns true for email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true)
  })

  it('returns false for email missing @ symbol', () => {
    expect(validateEmail('notanemail.com')).toBe(false)
  })

  it('returns false for email missing domain', () => {
    expect(validateEmail('test@')).toBe(false)
  })

  it('returns false for email missing username', () => {
    expect(validateEmail('@example.com')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateEmail('')).toBe(false)
  })

  it('returns false for email with spaces', () => {
    expect(validateEmail('test @example.com')).toBe(false)
  })

  it('returns false for email missing top level domain', () => {
    expect(validateEmail('test@example')).toBe(false)
  })
})

describe('validateLoginForm', () => {
  it('returns null for valid email and password', () => {
    expect(validateLoginForm('test@example.com', 'password123')).toBeNull()
  })

  it('returns error for empty email', () => {
    expect(validateLoginForm('', 'password123')).toBe('Email is required')
  })

  it('returns error for invalid email format', () => {
    expect(validateLoginForm('notanemail', 'password123')).toBe('Invalid email format')
  })

  it('returns error for empty password', () => {
    expect(validateLoginForm('test@example.com', '')).toBe('Password is required')
  })

  it('returns error for password under 8 characters', () => {
    expect(validateLoginForm('test@example.com', 'abc')).toBe('Password must be at least 8 characters')
  })

  it('returns null for password of exactly 8 characters', () => {
    expect(validateLoginForm('test@example.com', 'abcd1234')).toBeNull()
  })

  it('checks email before password — returns email error first', () => {
    expect(validateLoginForm('', '')).toBe('Email is required')
  })
})

describe('validateRegisterForm', () => {
  it('returns null for valid inputs', () => {
    expect(validateRegisterForm('test@example.com', 'password123', 'password123')).toBeNull()
  })

  it('returns error for empty email', () => {
    expect(validateRegisterForm('', 'password123', 'password123')).toBe('Email is required')
  })

  it('returns error for invalid email format', () => {
    expect(validateRegisterForm('bademail', 'password123', 'password123')).toBe('Invalid email format')
  })

  it('returns error for empty password', () => {
    expect(validateRegisterForm('test@example.com', '', '')).toBe('Password is required')
  })

  it('returns error for password under 8 characters', () => {
    expect(validateRegisterForm('test@example.com', 'abc', 'abc')).toBe('Password must be at least 8 characters')
  })

  it('returns error when passwords do not match', () => {
    expect(validateRegisterForm('test@example.com', 'password123', 'different123')).toBe('Passwords do not match')
  })

  it('returns null when passwords match exactly', () => {
    expect(validateRegisterForm('test@example.com', 'password123', 'password123')).toBeNull()
  })

  it('checks email errors before password mismatch', () => {
    expect(validateRegisterForm('bademail', 'password123', 'different123')).toBe('Invalid email format')
  })

  it('checks password length before mismatch', () => {
    expect(validateRegisterForm('test@example.com', 'abc', 'different')).toBe('Password must be at least 8 characters')
  })
})