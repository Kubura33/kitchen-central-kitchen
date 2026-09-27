import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderGroup from '../OrderGroup.vue'
import type { Order } from '../../api/types'

function companyOrder(arrivalTime: string): Order {
  return {
    id: 1,
    customer_first_name: 'Jelena',
    customer_last_name: 'V',
    customer_phone: '0641234567',
    arrival_time: arrivalTime,
    note: null,
    payment_method: 'cash',
    total_price: '500.00',
    company_id: 3,
    company: { id: 3, name: '3Lateral', code: 'LATERAL3' },
    pickup_code: '100001',
    status: 'preparing',
    ready_at: null,
    picked_up_at: null,
    lines: [],
    created_at: '2026-10-04T19:00:00Z',
    updated_at: null,
  }
}

describe('OrderGroup', () => {
  it('shows the company and the day its meals are due', () => {
    // Local noon, so the date is the same in any test timezone.
    const arrival = new Date(2026, 9, 5, 12, 30).toISOString()
    const wrapper = mount(OrderGroup, {
      props: {
        orders: [companyOrder(arrival)],
        company: { id: 3, name: '3Lateral', code: 'LATERAL3' },
        variant: 'preparing',
        markingIds: new Set<number>(),
      },
    })

    expect(wrapper.find('.order-group-name').text()).toBe('3Lateral')
    expect(wrapper.find('.order-group-date').text()).toBe('Za: ponedeljak, 05.10.')
  })
})
