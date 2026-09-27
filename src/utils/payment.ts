import type { Order } from '../api/types'

/**
 * Whether the kitchen should prepare the order: cash orders, and card orders
 * the bank has confirmed. The API already leaves unpaid card orders out of
 * the staff list; this is the client-side guard in case it ever does not.
 */
export function isPreparable(order: Order): boolean {
  return (
    order.payment_status === 'not_required' || order.payment_status === 'paid'
  )
}

/** Whether the money is already in: the cashier must not charge again. */
export function isPaidByCard(order: Order): boolean {
  return order.payment_status === 'paid'
}
