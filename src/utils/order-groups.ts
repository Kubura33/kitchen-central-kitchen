import type { Order, OrderCompany } from '../api/types'

export interface OrderGroup {
  key: string
  company: OrderCompany | null
  orders: Order[]
}

/**
 * Groups only orders that carry a company code. Orders without one stay in a
 * single unlabelled bucket so they continue to render as individual cards.
 * The first-seen order of groups is preserved because the input is already
 * sorted by the order list's display priority.
 */
export function groupOrdersByCompany(orders: Order[]): OrderGroup[] {
  const groups = new Map<string, OrderGroup>()

  for (const order of orders) {
    const company = order.company
    const companyCode = company?.code.trim()
    const hasCompanyCode = companyCode !== undefined && companyCode !== ''
    const key = hasCompanyCode ? `company:${companyCode}` : 'individual'

    let group = groups.get(key)
    if (group === undefined) {
      group = {
        key,
        company: hasCompanyCode ? company ?? null : null,
        orders: [],
      }
      groups.set(key, group)
    }

    group.orders.push(order)
  }

  return [...groups.values()]
}
