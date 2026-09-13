<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import OrderGroup from '../components/OrderGroup.vue'
import StatusBar from '../components/StatusBar.vue'
import { useAuth } from '../composables/useAuth'
import { useOrders } from '../composables/useOrders'
import { useSound } from '../composables/useSound'
import { groupOrdersByCompany } from '../utils/order-groups'

const { user, isCashier, logout } = useAuth()
const sound = useSound()
const {
  preparingOrders,
  readyOrders,
  recentlyPickedUp,
  isLoading,
  isOnline,
  lastUpdatedAt,
  errorMessage,
  newOrderIds,
  markingIds,
  start,
  stop,
  markDone,
  markPickedUp,
  acknowledgeNewOrder,
} = useOrders({
  // The new-order chime announces incoming work for the kitchen; at the
  // register it would fire for orders the cashier never sees.
  onNewOrders: () => {
    if (!isCashier.value) sound.playNewOrder()
  },
})

onMounted(start)
onBeforeUnmount(stop)

const readySearch = ref('')

const filteredReadyOrders = computed(() => {
  const query = readySearch.value.trim()
  if (query === '') return readyOrders.value
  return readyOrders.value.filter((order) =>
    order.pickup_code.includes(query),
  )
})

const preparingGroups = computed(() =>
  groupOrdersByCompany(preparingOrders.value),
)
const readyGroups = computed(() => groupOrdersByCompany(filteredReadyOrders.value))
const recentlyPickedUpGroups = computed(() =>
  groupOrdersByCompany(recentlyPickedUp.value),
)

async function handleMarkDone(orderId: number): Promise<void> {
  try {
    await markDone(orderId)
  } catch {
    // The error is already surfaced through errorMessage.
  }
}

async function handleMarkPickedUp(orderId: number): Promise<void> {
  try {
    await markPickedUp(orderId)
  } catch {
    // The error is already surfaced through errorMessage.
  }
}
</script>

<template>
  <div class="orders-page">
    <StatusBar
      :is-online="isOnline"
      :last-updated-at="lastUpdatedAt"
      :sound-enabled="sound.enabled.value"
      :user-name="user?.name ?? ''"
      :role-label="isCashier ? 'Kasa' : 'Kuhinja'"
      :show-sound-toggle="!isCashier"
      @toggle-sound="sound.toggle"
      @logout="logout"
    />

    <p v-if="errorMessage" class="orders-error">{{ errorMessage }}</p>

    <main class="orders-content">
      <p v-if="isLoading" class="orders-empty">Učitavanje porudžbina…</p>

      <template v-else>
        <section v-if="!isCashier" class="orders-section">
          <h2 class="orders-heading">
            U pripremi
            <span class="orders-count">{{ preparingOrders.length }}</span>
          </h2>
          <p v-if="preparingOrders.length === 0" class="orders-empty">
            Nema porudžbina u pripremi.
          </p>
          <OrderGroup
            v-for="group in preparingGroups"
            :key="group.key"
            :orders="group.orders"
            :company="group.company"
            variant="preparing"
            :audience="isCashier ? 'cashier' : 'kitchen'"
            :marking-ids="markingIds"
            :new-order-ids="newOrderIds"
            @mark-done="handleMarkDone"
            @acknowledge-new="acknowledgeNewOrder"
          />
        </section>

        <section class="orders-section">
          <h2 class="orders-heading orders-heading--ready">
            Spremno za preuzimanje
            <span class="orders-count">{{ readyOrders.length }}</span>
          </h2>
          <input
            v-if="readyOrders.length > 0"
            v-model="readySearch"
            class="orders-search"
            type="search"
            inputmode="numeric"
            placeholder="Pretraži po kodu za preuzimanje…"
            aria-label="Pretraga po kodu za preuzimanje"
          />
          <p v-if="readyOrders.length === 0" class="orders-empty">
            Nema spremnih porudžbina.
          </p>
          <p v-else-if="filteredReadyOrders.length === 0" class="orders-empty">
            Nijedna spremna porudžbina ne odgovara kodu „{{ readySearch }}”.
          </p>
          <OrderGroup
            v-for="group in readyGroups"
            :key="group.key"
            :orders="group.orders"
            :company="group.company"
            variant="ready"
            :audience="isCashier ? 'cashier' : 'kitchen'"
            :marking-ids="markingIds"
            @mark-picked-up="handleMarkPickedUp"
          />
        </section>

        <section v-if="recentlyPickedUp.length > 0" class="orders-section">
          <h2 class="orders-heading orders-heading--muted">Nedavno preuzeto</h2>
          <OrderGroup
            v-for="group in recentlyPickedUpGroups"
            :key="group.key"
            :orders="group.orders"
            :company="group.company"
            variant="picked-up"
            :audience="isCashier ? 'cashier' : 'kitchen'"
            :marking-ids="markingIds"
          />
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.orders-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.orders-error {
  margin: 0;
  padding: 10px 20px;
  background: rgb(198 40 40 / 0.08);
  color: var(--ck-danger);
  font-size: 14px;
}

.orders-content {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 28px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.orders-heading {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 700;
  color: var(--ck-brown);
  display: flex;
  align-items: center;
  gap: 10px;
}

.orders-heading--ready {
  color: var(--ck-green);
}

.orders-heading--muted {
  color: var(--ck-text-light);
  font-size: 16px;
}

.orders-count {
  background: var(--ck-orange-selected);
  color: var(--ck-orange);
  border-radius: var(--ck-radius-chip);
  font-size: 13px;
  padding: 2px 10px;
}

.orders-empty {
  color: var(--ck-text-secondary);
  margin: 0;
}

.orders-search {
  display: block;
  width: 100%;
  max-width: 340px;
  margin: 0 0 14px;
  padding: 10px 14px;
  font-size: 15px;
  color: var(--ck-text);
  background: var(--ck-card);
  border: 1px solid var(--ck-divider);
  border-radius: var(--ck-radius-button);
}

.orders-search:focus {
  outline: none;
  border-color: var(--ck-green);
  box-shadow: 0 0 0 3px rgb(29 114 53 / 0.15);
}

.orders-search::placeholder {
  color: var(--ck-text-light);
}
</style>
