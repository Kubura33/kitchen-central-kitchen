import type { Order, OrderLine } from '../api/types'

export interface Progress {
  done: number
  total: number
}

/**
 * Finished portions of one line. Once an order has left the kitchen every
 * portion counts as done, whatever the line says: that is what the API
 * guarantees, and it keeps orders from before portions were tracked tidy.
 */
export function lineProgress(line: OrderLine, order: Order): Progress {
  const total = line.quantity
  if (order.status !== 'preparing') return { done: total, total }
  return { done: Math.min(line.prepared_quantity ?? 0, total), total }
}

/** Finished portions across every line of an order. */
export function orderProgress(order: Order): Progress {
  return order.lines.reduce<Progress>(
    (sum, line) => {
      const { done, total } = lineProgress(line, order)
      return { done: sum.done + done, total: sum.total + total }
    },
    { done: 0, total: 0 },
  )
}
