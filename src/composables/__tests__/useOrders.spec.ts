import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrders } from '../useOrders'
import type { Order } from '../../api/types'

function order(id: number, status: 'preparing' | 'ready' = 'preparing'): Order {
  return {
    id,
    customer_first_name: 'Marko',
    customer_last_name: 'Markovic',
    customer_phone: '0641234567',
    arrival_time: '2026-07-04T12:30:00Z',
    note: null,
    payment_method: 'cash',
    total_price: '500.00',
    company_id: null,
    company: null,
    pickup_code: String(100000 + id),
    status,
    ready_at: status === 'ready' ? '2026-07-04T12:00:00Z' : null,
    picked_up_at: null,
    lines: [],
    created_at: `2026-07-04T1${id % 10}:00:00Z`,
    updated_at: null,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pageOf(orders: Order[]): unknown {
  return {
    data: orders,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 100,
      total: orders.length,
    },
  }
}

describe('useOrders', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('splits active orders into preparing and ready sections', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(pageOf([order(1), order(2, 'ready')]))),
    )
    const orders = useOrders()

    await orders.refreshNow()

    expect(orders.preparingOrders.value.map((o) => o.id)).toEqual([1])
    expect(orders.readyOrders.value.map((o) => o.id)).toEqual([2])
    expect(orders.isOnline.value).toBe(true)
  })

  it('detects brand-new orders and fires the notification callback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1)])))
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1), order(2)])))
    vi.stubGlobal('fetch', fetchMock)
    const onNewOrders = vi.fn()
    const orders = useOrders({ onNewOrders })

    await orders.refreshNow()
    expect(onNewOrders).not.toHaveBeenCalled()

    await orders.refreshNow()
    expect(onNewOrders).toHaveBeenCalledTimes(1)
    expect(orders.newOrderIds.value.has(2)).toBe(true)
    expect(orders.newOrderIds.value.has(1)).toBe(false)
  })

  it('moves vanished orders into the recently picked-up list', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1), order(2)])))
      .mockResolvedValueOnce(jsonResponse(pageOf([order(2)])))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()

    await orders.refreshNow()
    await orders.refreshNow()

    expect(orders.recentlyPickedUp.value.map((o) => o.id)).toEqual([1])
    expect(orders.recentlyPickedUp.value[0]?.status).toBe('picked_up')
  })

  it('optimistically marks an order ready and confirms via the API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1)])))
      .mockResolvedValueOnce(jsonResponse({ data: order(1, 'ready') }))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    await orders.markDone(1)

    expect(orders.preparingOrders.value).toHaveLength(0)
    expect(orders.readyOrders.value.map((o) => o.id)).toEqual([1])
    const patchCall = fetchMock.mock.calls[1]
    expect(String(patchCall?.[0])).toContain('/orders/1/ready')
    expect(patchCall?.[1]?.method).toBe('PATCH')
  })

  it('rolls the optimistic update back when the API rejects it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1)])))
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Porudzbina je vec preuzeta.' }, 422),
      )
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    await expect(orders.markDone(1)).rejects.toThrow()

    expect(orders.preparingOrders.value.map((o) => o.id)).toEqual([1])
    expect(orders.readyOrders.value).toHaveLength(0)
    expect(orders.errorMessage.value).toBe('Porudzbina je vec preuzeta.')
  })

  it('reports the offline state when polling fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const orders = useOrders()

    await orders.refreshNow()

    expect(orders.isOnline.value).toBe(false)
    expect(orders.errorMessage.value).not.toBeNull()
  })
})
