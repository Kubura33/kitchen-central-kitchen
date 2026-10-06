import { computed, readonly, ref, shallowRef } from 'vue'
import { request } from '../api/client'
import type { Order, Paginated } from '../api/types'
import { localDateKey } from '../utils/format'

const POLL_INTERVAL_MS = 10_000
const RECENTLY_PICKED_UP_TTL_MS = 5 * 60_000

export interface UseOrdersOptions {
  /** Fired once per poll that discovered at least one brand-new order. */
  onNewOrders?: () => void
  pollIntervalMs?: number
}

/**
 * Polls today's active order list (everything not yet picked up, due today)
 * and derives the kitchen views from it: preparing, ready, and recently
 * picked-up orders.
 *
 * Company orders are placed the evening before for the next delivery day, so
 * the list is limited to today: tomorrow's company orders appear once their
 * day starts, not the evening they are placed.
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
  // Portion writes in flight, keyed by line. Taps on one line are sent one at
  // a time with only the newest count, so they cannot arrive out of order.
  const lineWrites = new Map<number, { latest: number }>()

  let knownIds: Set<number> | null = null
  let loadedDay: string | null = null
  const pickedUpAt = new Map<number, number>()
  let timer: ReturnType<typeof setTimeout> | null = null
  let pollingPromise: Promise<void> | null = null
  let pollQueued = false
  let mutationGeneration = 0
  let stopped = false

  const preparingOrders = computed(() =>
    orders.value
      .filter((order) => order.status === 'preparing')
      .sort(byNewestFirst),
  )
  const readyOrders = computed(() =>
    orders.value.filter((order) => order.status === 'ready').sort(byNewestFirst),
  )

  /**
   * Coalesces timer, focus and manual refreshes into one active request plus at
   * most one follow-up. Serial polling prevents older GET responses from
   * overtaking newer GET responses; the mutation generation below handles GET
   * responses that overlap a ready/picked-up PATCH.
   */
  function poll(): Promise<void> {
    if (pollingPromise !== null) {
      pollQueued = true
      return pollingPromise
    }

    pollingPromise = runPollLoop()
    return pollingPromise
  }

  async function runPollLoop(): Promise<void> {
    try {
      do {
        pollQueued = false
        await pollOnce()
      } while (pollQueued && !stopped)
    } finally {
      pollingPromise = null
    }
  }

  async function pollOnce(): Promise<void> {
    const generationAtStart = mutationGeneration

    try {
      const day = localDateKey(new Date())
      const page = await request<Paginated<Order>>('/orders', {
        query: { status: 'pending', per_page: 100, arrival_date: day },
      })

      isOnline.value = true

      // A mutation that started or completed while this GET was running owns
      // the newer state. Discard the stale snapshot; the mutation queues a
      // fresh poll after its PATCH succeeds.
      if (
        generationAtStart === mutationGeneration &&
        markingIds.value.size === 0 &&
        lineWrites.size === 0
      ) {
        // A new day is a fresh start, like opening the dashboard: yesterday's
        // leftovers dropping out of the list were not picked up.
        if (loadedDay !== day) {
          knownIds = null
          newOrderIds.value = new Set()
          loadedDay = day
        }
        applyServerOrders(page.data)
        errorMessage.value = null
        lastUpdatedAt.value = new Date()
      }
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

    if (knownIds === null) {
      // Opening the dashboard (or a new day starting) announces the work
      // already waiting, e.g. company orders placed the evening before.
      if (serverOrders.some((order) => order.status === 'preparing')) {
        onNewOrders?.()
      }
    } else {
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

  function storeRecentlyPickedUp(order: Order, pickedUpTimestamp: number): void {
    pickedUpAt.set(order.id, pickedUpTimestamp)
    recentlyPickedUp.value = [
      order,
      ...recentlyPickedUp.value.filter((entry) => entry.id !== order.id),
    ]
    pruneRecentlyPickedUp(pickedUpTimestamp)
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
    mutationGeneration += 1

    const previous = orders.value
    let succeeded = false
    // Optimistic move to the ready column; rolled back on failure.
    orders.value = orders.value.map((order) =>
      order.id === orderId
        ? {
            ...order,
            status: 'ready' as const,
            ready_at: new Date().toISOString(),
            lines: order.lines.map((line) => ({
              ...line,
              prepared_quantity: line.quantity,
            })),
          }
        : order,
    )

    try {
      const response = await request<{ data: Order }>(
        `/orders/${orderId}/ready`,
        { method: 'PATCH' },
      )
      orders.value = orders.value.map((order) =>
        order.id === orderId ? response.data : order,
      )
      acknowledgeNewOrder(orderId)
      succeeded = true
    } catch (error) {
      orders.value = previous
      errorMessage.value =
        error instanceof Error ? error.message : 'Označavanje nije uspelo.'
      throw error
    } finally {
      const next = new Set(markingIds.value)
      next.delete(orderId)
      markingIds.value = next
      mutationGeneration += 1
      if (succeeded) void poll()
    }
  }

  function patchLine(orderId: number, lineId: number, count: number): void {
    orders.value = orders.value.map((order) =>
      order.id === orderId
        ? {
            ...order,
            lines: order.lines.map((line) =>
              line.id === lineId ? { ...line, prepared_quantity: count } : line,
            ),
          }
        : order,
    )
  }

  /**
   * Sets how many portions of a line are done. The API marks the order ready
   * by itself once the last portion of the last line is, and answers with the
   * order, so that is also how the card moves to the ready section.
   *
   * Not rolled back on failure: other taps may have landed meanwhile, so the
   * list is simply refetched, which is the server's word on what is done.
   */
  async function setPrepared(
    orderId: number,
    lineId: number,
    count: number,
  ): Promise<void> {
    patchLine(orderId, lineId, count)

    const pending = lineWrites.get(lineId)
    if (pending !== undefined) {
      pending.latest = count
      return
    }

    const write = { latest: count }
    lineWrites.set(lineId, write)
    mutationGeneration += 1
    let failure: string | null = null

    try {
      let sent: number
      do {
        sent = write.latest
        const response = await request<{ data: Order }>(
          `/orders/${orderId}/lines/${lineId}/prepared`,
          { method: 'PATCH', body: { prepared_quantity: sent } },
        )
        // A newer tap is already on screen; adopting this older answer would
        // flicker the card back.
        if (sent === write.latest) {
          orders.value = orders.value.map((order) =>
            order.id === orderId ? response.data : order,
          )
          if (response.data.status !== 'preparing') acknowledgeNewOrder(orderId)
        }
      } while (sent !== write.latest)
    } catch (error) {
      failure =
        error instanceof Error ? error.message : 'Označavanje nije uspelo.'
      throw error
    } finally {
      lineWrites.delete(lineId)
      mutationGeneration += 1
      const resync = poll()
      // A successful resync clears the error banner, so show this one after it.
      if (failure !== null) {
        const message = failure
        void resync.then(() => {
          errorMessage.value = message
        })
      }
    }
  }

  async function markPickedUp(orderId: number): Promise<void> {
    if (markingIds.value.has(orderId)) return
    markingIds.value = new Set([...markingIds.value, orderId])
    mutationGeneration += 1

    const previousOrders = orders.value
    const previousRecent = recentlyPickedUp.value
    const previousPickedUpAt = pickedUpAt.get(orderId)
    const order = orders.value.find((entry) => entry.id === orderId)
    let succeeded = false

    // Optimistic move to the recently picked-up list; rolled back on failure.
    if (order !== undefined) {
      orders.value = orders.value.filter((entry) => entry.id !== orderId)
      const optimisticTimestamp = Date.now()
      storeRecentlyPickedUp(
        {
          ...order,
          status: 'picked_up' as const,
          picked_up_at: new Date().toISOString(),
        },
        optimisticTimestamp,
      )
    }

    try {
      const response = await request<{ data: Order }>(
        `/orders/${orderId}/picked-up`,
        { method: 'PATCH' },
      )
      orders.value = orders.value.filter((entry) => entry.id !== orderId)
      storeRecentlyPickedUp(
        response.data,
        pickedUpAt.get(orderId) ?? Date.now(),
      )
      acknowledgeNewOrder(orderId)
      succeeded = true
    } catch (error) {
      orders.value = previousOrders
      recentlyPickedUp.value = previousRecent
      if (previousPickedUpAt === undefined) {
        pickedUpAt.delete(orderId)
      } else {
        pickedUpAt.set(orderId, previousPickedUpAt)
      }
      errorMessage.value =
        error instanceof Error ? error.message : 'Označavanje nije uspelo.'
      throw error
    } finally {
      const next = new Set(markingIds.value)
      next.delete(orderId)
      markingIds.value = next
      mutationGeneration += 1
      if (succeeded) void poll()
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
    setPrepared,
    acknowledgeNewOrder,
  }
}

function byNewestFirst(a: Order, b: Order): number {
  return (
    new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )
}
