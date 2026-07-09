import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderCard from '../OrderCard.vue'
import type { Order } from '../../api/types'

const order: Order = {
  id: 7,
  customer_first_name: 'Jovana',
  customer_last_name: 'Jovic',
  customer_phone: '0655555555',
  arrival_time: '2026-07-04T12:30:00Z',
  note: 'Bez luka.',
  payment_method: 'card',
  total_price: '1250.00',
  company_id: 1,
  company: { id: 1, name: 'Penguin Codes', code: 'PGC12345' },
  pickup_code: '123456',
  status: 'preparing',
  ready_at: null,
  picked_up_at: null,
  lines: [
    {
      id: 11,
      meal_id: 3,
      meal_name: 'Pasulj sa kobasicom',
      quantity: 2,
      unit_price: '625.00',
      line_total: '1250.00',
      side_dishes: ['kupus salata'],
      note: null,
    },
  ],
  created_at: '2026-07-04T11:00:00Z',
  updated_at: null,
}

describe('OrderCard', () => {
  it('renders the pickup code, customer, company and lines', () => {
    const wrapper = mount(OrderCard, {
      props: { order, variant: 'preparing' },
    })

    expect(wrapper.text()).toContain('123456')
    expect(wrapper.text()).toContain('Jovana Jovic')
    expect(wrapper.text()).toContain('Penguin Codes')
    expect(wrapper.text()).toContain('2×')
    expect(wrapper.text()).toContain('Pasulj sa kobasicom')
    expect(wrapper.text()).toContain('kupus salata')
    expect(wrapper.text()).toContain('1.250 RSD')
    expect(wrapper.text()).toContain('Bez luka.')
  })

  it('emits mark-done with the order id', async () => {
    const wrapper = mount(OrderCard, {
      props: { order, variant: 'preparing' },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('mark-done')).toEqual([[7]])
  })

  it('disables the button while marking', () => {
    const wrapper = mount(OrderCard, {
      props: { order, variant: 'preparing', isMarking: true },
    })

    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })

  it('shows the ready tag instead of the button for ready orders', () => {
    const wrapper = mount(OrderCard, {
      props: { order: { ...order, status: 'ready' }, variant: 'ready' },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toContain('Spremno za preuzimanje')
  })
})
