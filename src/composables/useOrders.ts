import { computed, readonly, ref, shallowRef } from 'vue'
import { request } from '../api/client'
import type { Order, Paginated } from '../api/types'

const POLL_INTERVAL_MS = 10_000
const RECENTLY_PICKED_UP_TTL_MS = 5 * 60_000

export interface UseOrdersOptions {
  /** Fired once per poll that discovered at least one brand-new order. */
  onNewOrders?: () => void
  pollIntervalMs?: number
}

/**
 * Polls the active order list (everything not yet picked up) and derives the
 * kitchen views from it: preparing, ready, and recently picked-up orders.
 *
 * Polling is the transport by design — the API lives on shared hosting with
 * no websocket process. The active list is small, so a full refetch every
 * cycle is cheap and self-healing after connection loss.
 */
export function useOrders(options: UseOrdersOptions = {}) {
  const { onNewOrders, pollIntervalMs = POLL_INTERVAL_MS } = options

  const orders = shallowRef<Order[]>([])
  const recentlyPickedUp = shallowRef<Order[]>([])
  const isLoading = shallowRef(true)
  const isOnline = shallowRef(true)
  const lastUpdatedAt = shallowRef<Date | null>(null)
  const errorMessage = shallowRef<string | null>(null)
  const newOrderIds = ref<Set<number>>(new Set())
  const markingIds = ref<Set<number>>(new Set())

  let knownIds: Set<number> | null = null
  let pickedUpAt = new Map<number, number>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const preparingOrders = computed(() =>
    orders.value
      .filter((order) => order.status === 'preparing')
      .sort(byNewestFirst),
  )
  const readyOrders = computed(() =>
    orders.value.filter((order) => order.status === 'ready').sort(byNewestFirst),
  )

  async function poll(): Promise<void> {
    try {
      const page = await request<Paginated<Order>>('/orders', {
        query: { status: 'pending', per_page: 100 },
      })
      applyServerOrders(page.data)
      isOnline.value = true
      errorMessage.value = null
      lastUpdatedAt.value = new Date()
    } catch (error) {
      isOnline.value = false
      errorMessage.value =
        error instanceof Error ? error.message : 'Osvežavanje nije uspelo.'
    } finally {
      isLoading.value = false
    }
  }

  function applyServerOrders(serverOrders: Order[]): void {
    const serverIds = new Set(serverOrders.map((order) => order.id))

    if (knownIds !== null) {
      const fresh = serverOrders.filter((order) => !knownIds!.has(order.id))
      if (fresh.length > 0) {
        newOrderIds.value = new Set([
          ...newOrderIds.value,
          ...fresh.map((order) => order.id),
        ])
        onNewOrders?.()
      }

      // Orders that vanished from the active list were picked up.
      const now = Date.now()
      for (const order of orders.value) {
        if (!serverIds.has(order.id) && !pickedUpAt.has(order.id)) {
          pickedUpAt.set(order.id, now)
          recentlyPickedUp.value = [
            { ...order, status: 'picked_up' },
            ...recentlyPickedUp.value,
          ]
        }
      }
      pruneRecentlyPickedUp(now)
    }

    knownIds = new Set([...(knownIds ?? []), ...serverIds])
    orders.value = serverOrders
  }

  function pruneRecentlyPickedUp(now: number): void {
    recentlyPickedUp.value = recentlyPickedUp.value.filter((order) => {
      const at = pickedUpAt.get(order.id)
      return at !== undefined && now - at < RECENTLY_PICKED_UP_TTL_MS
    })
  }

  /** Clears the new-order highlight, e.g. after the staff saw the card. */
  function acknowledgeNewOrder(orderId: number): void {
    if (!newOrderIds.value.has(orderId)) return
    const next = new Set(newOrderIds.value)
    next.delete(orderId)
    newOrderIds.value = next
  }

  async function markDone(orderId: number): Promise<void> {
    if (markingIds.value.has(orderId)) return
    markingIds.value = new Set([...markingIds.value, orderId])

    const previous = orders.value
    // Optimistic move to the ready column; rolled back on failure.
    orders.value = orders.value.map((order) =>
      order.id === orderId
        ? { ...order, status: 'ready' as const, ready_at: new Date().toISOString() }
        : order,
    )

    try {
      await request<{ data: Order }>(`/orders/${orderId}/ready`, {
        method: 'PATCH',
      })
      acknowledgeNewOrder(orderId)
    } catch (error) {
      orders.value = previous
      errorMessage.value =
        error instanceof Error ? error.message : 'Označavanje nije uspelo.'
      throw error
    } finally {
      const next = new Set(markingIds.value)
      next.delete(orderId)
      markingIds.value = next
    }
  }

  async function markPickedUp(orderId: number): Promise<void> {
    if (markingIds.value.has(orderId)) return
    markingIds.value = new Set([...markingIds.value, orderId])

    const previousOrders = orders.value
    const previousRecent = recentlyPickedUp.value
    const order = orders.value.find((entry) => entry.id === orderId)

    // Optimistic move to the recently picked-up list; rolled back on failure.
    if (order !== undefined) {
      orders.value = orders.value.filter((entry) => entry.id !== orderId)
      pickedUpAt.set(orderId, Date.now())
      recentlyPickedUp.value = [
        {
          ...order,
          status: 'picked_up' as const,
          picked_up_at: new Date().toISOString(),
        },
        ...recentlyPickedUp.value,
      ]
    }

    try {
      await request<{ data: Order }>(`/orders/${orderId}/picked-up`, {
        method: 'PATCH',
      })
      acknowledgeNewOrder(orderId)
    } catch (error) {
      orders.value = previousOrders
      recentlyPickedUp.value = previousRecent
      pickedUpAt.delete(orderId)
      errorMessage.value =
        error instanceof Error ? error.message : 'Označavanje nije uspelo.'
      throw error
    } finally {
      const next = new Set(markingIds.value)
      next.delete(orderId)
      markingIds.value = next
    }
  }

  function scheduleNext(): void {
    if (stopped) return
    timer = setTimeout(async () => {
      if (document.visibilityState === 'visible') {
        await poll()
      }
      scheduleNext()
    }, pollIntervalMs)
  }

  async function refreshNow(): Promise<void> {
    await poll()
  }

  function handleVisibility(): void {
    if (document.visibilityState === 'visible') void poll()
  }

  function start(): void {
    stopped = false
    void poll()
    scheduleNext()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
  }

  function stop(): void {
    stopped = true
    if (timer !== null) clearTimeout(timer)
    document.removeEventListener('visibilitychange', handleVisibility)
    window.removeEventListener('focus', handleVisibility)
  }

  return {
    preparingOrders,
    readyOrders,
    // Exposed as computed rather than readonly() so consumers keep the plain
    // Order[] element type (deep-readonly would not satisfy card props).
    recentlyPickedUp: computed(() => recentlyPickedUp.value),
    isLoading: readonly(isLoading),
    isOnline: readonly(isOnline),
    lastUpdatedAt: readonly(lastUpdatedAt),
    errorMessage: readonly(errorMessage),
    newOrderIds: readonly(newOrderIds),
    markingIds: readonly(markingIds),
    start,
    stop,
    refreshNow,
    markDone,
    markPickedUp,
    acknowledgeNewOrder,
  }
}

function byNewestFirst(a: Order, b: Order): number {
  return (
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )
}
