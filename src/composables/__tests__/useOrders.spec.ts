import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
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

function orderWithLine(
  id: number,
  quantity: number,
  prepared: number,
  status: 'preparing' | 'ready' = 'preparing',
): Order {
  return {
    ...order(id, status),
    lines: [
      {
        id: 50,
        meal_id: 9,
        meal_name: 'Pasulj',
        quantity,
        prepared_quantity: prepared,
        unit_price: '500.00',
        line_total: '500.00',
        side_dishes: null,
        note: null,
      },
    ],
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

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
} {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolver) => {
    resolve = resolver
  })
  return { promise, resolve }
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
    // Opening the dashboard announces the work already waiting.
    expect(onNewOrders).toHaveBeenCalledTimes(1)

    await orders.refreshNow()
    expect(onNewOrders).toHaveBeenCalledTimes(2)
    expect(orders.newOrderIds.value.has(2)).toBe(true)
    expect(orders.newOrderIds.value.has(1)).toBe(false)
  })

  it('asks only for orders due today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 5, 9, 30))
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(pageOf([])))
    vi.stubGlobal('fetch', fetchMock)

    await useOrders().refreshNow()

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), 'http://localhost')
    expect(url.searchParams.get('arrival_date')).toBe('2026-10-05')
    expect(url.searchParams.get('status')).toBe('pending')
    vi.useRealTimers()
  })

  it('stays quiet on opening when nothing is waiting to be prepared', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(pageOf([order(1, 'ready')]))),
    )
    const onNewOrders = vi.fn()

    await useOrders({ onNewOrders }).refreshNow()

    expect(onNewOrders).not.toHaveBeenCalled()
  })

  it('starts a new day fresh instead of treating yesterday as picked up', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 23, 59))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1)])))
      .mockResolvedValueOnce(jsonResponse(pageOf([order(2)])))
    vi.stubGlobal('fetch', fetchMock)
    const onNewOrders = vi.fn()
    const orders = useOrders({ onNewOrders })

    await orders.refreshNow()
    vi.setSystemTime(new Date(2026, 9, 5, 0, 1))
    await orders.refreshNow()

    const url = new URL(String(fetchMock.mock.calls[1]?.[0]), 'http://localhost')
    expect(url.searchParams.get('arrival_date')).toBe('2026-10-05')
    // Yesterday's order left the list because the day ended, not because it
    // was collected; the new day's waiting work is announced again.
    expect(orders.recentlyPickedUp.value).toEqual([])
    expect(onNewOrders).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
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
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1, 'ready')])))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    await orders.markDone(1)
    await flushPromises()

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

  it('optimistically marks an order picked up and confirms via the API', async () => {
    const pickedUp = {
      ...order(1, 'ready'),
      status: 'picked_up' as const,
      picked_up_at: '2026-07-04T12:05:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1, 'ready')])))
      .mockResolvedValueOnce(jsonResponse({ data: pickedUp }))
      .mockResolvedValueOnce(jsonResponse(pageOf([])))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    await orders.markPickedUp(1)
    await flushPromises()

    expect(orders.readyOrders.value).toHaveLength(0)
    expect(orders.recentlyPickedUp.value.map((o) => o.id)).toEqual([1])
    expect(orders.recentlyPickedUp.value[0]?.status).toBe('picked_up')
    const patchCall = fetchMock.mock.calls[1]
    expect(String(patchCall?.[0])).toContain('/orders/1/picked-up')
    expect(patchCall?.[1]?.method).toBe('PATCH')
  })

  it('rolls back the picked-up move when the API rejects it', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1, 'ready')])))
      .mockResolvedValueOnce(
        jsonResponse({ message: 'Greška na serveru.' }, 500),
      )
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    await expect(orders.markPickedUp(1)).rejects.toThrow()

    expect(orders.readyOrders.value.map((o) => o.id)).toEqual([1])
    expect(orders.recentlyPickedUp.value).toHaveLength(0)
    expect(orders.errorMessage.value).not.toBeNull()
  })

  it('does not restore a picked-up order from a stale poll response', async () => {
    const stalePoll = deferred<Response>()
    const pickedUp = {
      ...order(1, 'ready'),
      status: 'picked_up' as const,
      picked_up_at: '2026-07-04T12:05:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1, 'ready')])))
      .mockImplementationOnce(() => stalePoll.promise)
      .mockResolvedValueOnce(jsonResponse({ data: pickedUp }))
      .mockResolvedValueOnce(jsonResponse(pageOf([])))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    const staleRefresh = orders.refreshNow()
    await orders.markPickedUp(1)

    stalePoll.resolve(jsonResponse(pageOf([order(1, 'ready')])))
    await staleRefresh

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(orders.readyOrders.value).toHaveLength(0)
    expect(orders.recentlyPickedUp.value.map((entry) => entry.id)).toEqual([1])
    expect(orders.recentlyPickedUp.value[0]?.picked_up_at).toBe(
      pickedUp.picked_up_at,
    )
  })

  it('does not revert a ready order from a stale poll response', async () => {
    const stalePoll = deferred<Response>()
    const ready = {
      ...order(1, 'ready'),
      ready_at: '2026-07-04T12:10:00Z',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(pageOf([order(1)])))
      .mockImplementationOnce(() => stalePoll.promise)
      .mockResolvedValueOnce(jsonResponse({ data: ready }))
      .mockResolvedValueOnce(jsonResponse(pageOf([ready])))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()
    await orders.refreshNow()

    const staleRefresh = orders.refreshNow()
    await orders.markDone(1)

    stalePoll.resolve(jsonResponse(pageOf([order(1)])))
    await staleRefresh

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(orders.preparingOrders.value).toHaveLength(0)
    expect(orders.readyOrders.value.map((entry) => entry.id)).toEqual([1])
    expect(orders.readyOrders.value[0]?.ready_at).toBe(ready.ready_at)
  })

  it('coalesces overlapping refreshes into one follow-up poll', async () => {
    const firstPoll = deferred<Response>()
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstPoll.promise)
      .mockResolvedValueOnce(jsonResponse(pageOf([order(2)])))
    vi.stubGlobal('fetch', fetchMock)
    const orders = useOrders()

    const first = orders.refreshNow()
    const second = orders.refreshNow()
    const third = orders.refreshNow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    firstPoll.resolve(jsonResponse(pageOf([order(1)])))
    await Promise.all([first, second, third])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(orders.preparingOrders.value.map((entry) => entry.id)).toEqual([2])
  })

  it('reports the offline state when polling fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const orders = useOrders()

    await orders.refreshNow()

    expect(orders.isOnline.value).toBe(false)
    expect(orders.errorMessage.value).not.toBeNull()
  })
  describe('setPrepared', () => {
    it('shows the count at once and adopts the order the API returns', async () => {
      const patch = deferred<Response>()
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pageOf([orderWithLine(1, 3, 0)])))
        .mockImplementationOnce(() => patch.promise)
        .mockResolvedValue(jsonResponse(pageOf([orderWithLine(1, 3, 1)])))
      vi.stubGlobal('fetch', fetchMock)
      const orders = useOrders()
      await orders.refreshNow()

      const done = orders.setPrepared(1, 50, 1)

      expect(orders.preparingOrders.value[0]?.lines[0]?.prepared_quantity).toBe(1)
      patch.resolve(jsonResponse({ data: orderWithLine(1, 3, 1) }))
      await done
      await flushPromises()

      const patchCall = fetchMock.mock.calls[1]
      expect(String(patchCall?.[0])).toContain('/orders/1/lines/50/prepared')
      expect(patchCall?.[1]?.method).toBe('PATCH')
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        prepared_quantity: 1,
      })
    })

    it('moves the order to ready when the API marks it ready', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pageOf([orderWithLine(1, 1, 0)])))
        .mockResolvedValueOnce(
          jsonResponse({ data: orderWithLine(1, 1, 1, 'ready') }),
        )
        .mockResolvedValue(
          jsonResponse(pageOf([orderWithLine(1, 1, 1, 'ready')])),
        )
      vi.stubGlobal('fetch', fetchMock)
      const orders = useOrders()
      await orders.refreshNow()

      await orders.setPrepared(1, 50, 1)
      await flushPromises()

      expect(orders.preparingOrders.value).toHaveLength(0)
      expect(orders.readyOrders.value.map((o) => o.id)).toEqual([1])
    })

    it('sends rapid taps on one line in order, only the newest count', async () => {
      const first = deferred<Response>()
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pageOf([orderWithLine(1, 3, 0)])))
        .mockImplementationOnce(() => first.promise)
        .mockResolvedValueOnce(jsonResponse({ data: orderWithLine(1, 3, 3) }))
        .mockResolvedValue(jsonResponse(pageOf([orderWithLine(1, 3, 3)])))
      vi.stubGlobal('fetch', fetchMock)
      const orders = useOrders()
      await orders.refreshNow()

      const tapOne = orders.setPrepared(1, 50, 1)
      const tapTwo = orders.setPrepared(1, 50, 2)
      const tapThree = orders.setPrepared(1, 50, 3)
      first.resolve(jsonResponse({ data: orderWithLine(1, 3, 1) }))
      await Promise.all([tapOne, tapTwo, tapThree])

      const bodies = fetchMock.mock.calls
        .slice(1, 3)
        .map((call) => JSON.parse(String(call[1]?.body)).prepared_quantity)
      expect(bodies).toEqual([1, 3])
      expect(orders.preparingOrders.value[0]?.lines[0]?.prepared_quantity).toBe(3)
    })

    it('reports a failure and falls back to what the server says', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(pageOf([orderWithLine(1, 3, 0)])))
        .mockResolvedValueOnce(
          jsonResponse({ message: 'Porudzbina je vec spremna.' }, 422),
        )
        .mockResolvedValue(jsonResponse(pageOf([orderWithLine(1, 3, 0)])))
      vi.stubGlobal('fetch', fetchMock)
      const orders = useOrders()
      await orders.refreshNow()

      await expect(orders.setPrepared(1, 50, 1)).rejects.toThrow()
      await flushPromises()

      expect(orders.errorMessage.value).toBe('Porudzbina je vec spremna.')
      expect(orders.preparingOrders.value[0]?.lines[0]?.prepared_quantity).toBe(0)
    })
  })
})
