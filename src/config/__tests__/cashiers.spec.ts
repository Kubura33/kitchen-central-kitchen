import { describe, expect, it } from 'vitest'
import { CASHIER_EMAILS, isCashierEmail } from '../cashiers'

const [firstCashier] = CASHIER_EMAILS

describe('isCashierEmail', () => {
  it('matches a configured address regardless of case or padding', () => {
    expect(isCashierEmail(firstCashier)).toBe(true)
    expect(isCashierEmail(`  ${firstCashier.toUpperCase()}  `)).toBe(true)
  })

  it('rejects unknown addresses and missing values', () => {
    expect(isCashierEmail('kuhinja@centralkitchen.rs')).toBe(false)
    expect(isCashierEmail('')).toBe(false)
    expect(isCashierEmail(null)).toBe(false)
    expect(isCashierEmail(undefined)).toBe(false)
  })

  it('keeps every configured entry lowercase so the lookup can match it', () => {
    for (const email of CASHIER_EMAILS) {
      expect(email).toBe(email.toLowerCase())
    }
  })
})
