import { describe, expect, it } from 'vitest'
import { lineProgress, orderProgress } from '../order-progress'
import type { Order, OrderLine } from '../../api/types'

function line(id: number, quantity: number, prepared: number): OrderLine {
  return {
    id,
    meal_id: id,
    meal_name: `Jelo ${id}`,
    quantity,
    prepared_quantity: prepared,
    unit_price: '500.00',
    line_total: '500.00',
    side_dishes: null,
    note: null,
  }
}

function order(status: Order['status'], lines: OrderLine[]): Order {
  return {
    id: 1,
    customer_first_name: 'Marko',
    customer_last_name: 'Markovic',
    customer_phone: '0641234567',
    arrival_time: null,
    note: null,
    payment_method: 'cash',
    payment_status: 'not_required',
    paid_at: null,
    total_price: '500.00',
    company_id: null,
    pickup_code: '100001',
    status,
    ready_at: null,
    picked_up_at: null,
    lines,
    created_at: null,
    updated_at: null,
  }
}

describe('order progress', () => {
  it('sums finished portions over all lines of a preparing order', () => {
    const preparing = order('preparing', [line(1, 3, 2), line(2, 2, 0)])

    expect(orderProgress(preparing)).toEqual({ done: 2, total: 5 })
    expect(lineProgress(preparing.lines[0], preparing)).toEqual({
      done: 2,
      total: 3,
    })
  })

  it('counts every portion as done once the order is ready', () => {
    const ready = order('ready', [line(1, 3, 0), line(2, 1, 0)])

    expect(orderProgress(ready)).toEqual({ done: 4, total: 4 })
  })

  it('never reports more done than ordered', () => {
    const preparing = order('preparing', [line(1, 2, 5)])

    expect(orderProgress(preparing)).toEqual({ done: 2, total: 2 })
  })

  it('treats a missing count from an older API as nothing done', () => {
    const legacy = line(1, 2, 0)
    delete (legacy as Partial<OrderLine>).prepared_quantity

    expect(orderProgress(order('preparing', [legacy]))).toEqual({
      done: 0,
      total: 2,
    })
  })
})
