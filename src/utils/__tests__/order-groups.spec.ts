import { describe, expect, it } from 'vitest'
import type { Order } from '../../api/types'
import { groupOrdersByCompany } from '../order-groups'

function order(
  id: number,
  company: Order['company'] = null,
): Order {
  return {
    id,
    customer_first_name: 'Marko',
    customer_last_name: 'Markovic',
    customer_phone: '0641234567',
    arrival_time: null,
    note: null,
    payment_method: 'cash',
    total_price: '500.00',
    company_id: company?.id ?? null,
    company,
    pickup_code: String(100000 + id),
    status: 'preparing',
    ready_at: null,
    picked_up_at: null,
    lines: [],
    created_at: `2026-07-04T1${id}:00:00Z`,
    updated_at: null,
  }
}

describe('groupOrdersByCompany', () => {
  it('groups company orders by code and leaves individual orders unlabelled', () => {
    const groups = groupOrdersByCompany([
      order(1, { id: 10, name: 'Penguin Codes', code: 'PGC12345' }),
      order(2),
      order(3, { id: 10, name: 'Penguin Codes', code: 'PGC12345' }),
      order(4, { id: 11, name: 'Acme', code: 'ACME1234' }),
    ])

    expect(groups.map((group) => group.key)).toEqual([
      'company:PGC12345',
      'individual',
      'company:ACME1234',
    ])
    expect(groups[0]?.orders.map(({ id }) => id)).toEqual([1, 3])
    expect(groups[1]?.company).toBeNull()
    expect(groups[1]?.orders.map(({ id }) => id)).toEqual([2])
  })

  it('does not group an order when the backend omits the company code', () => {
    const groups = groupOrdersByCompany([
      order(1, { id: 10, name: 'Incomplete company', code: '' }),
      order(2),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.company).toBeNull()
    expect(groups[0]?.orders.map(({ id }) => id)).toEqual([1, 2])
  })
})
