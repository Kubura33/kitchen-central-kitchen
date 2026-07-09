<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import OrderCard from '../components/OrderCard.vue'
import StatusBar from '../components/StatusBar.vue'
import { useAuth } from '../composables/useAuth'
import { useOrders } from '../composables/useOrders'
import { useSound } from '../composables/useSound'

const { user, logout } = useAuth()
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
  acknowledgeNewOrder,
} = useOrders({ onNewOrders: sound.playNewOrder })

onMounted(start)
onBeforeUnmount(stop)

async function handleMarkDone(orderId: number): Promise<void> {
  try {
    await markDone(orderId)
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
      @toggle-sound="sound.toggle"
      @logout="logout"
    />

    <p v-if="errorMessage" class="orders-error">{{ errorMessage }}</p>

    <main class="orders-content">
      <p v-if="isLoading" class="orders-empty">Učitavanje porudžbina…</p>

      <template v-else>
        <section class="orders-section">
          <h2 class="orders-heading">
            U pripremi
            <span class="orders-count">{{ preparingOrders.length }}</span>
          </h2>
          <p v-if="preparingOrders.length === 0" class="orders-empty">
            Nema porudžbina u pripremi.
          </p>
          <div class="orders-grid">
            <OrderCard
              v-for="order in preparingOrders"
              :key="order.id"
              :order="order"
              variant="preparing"
              :is-marking="markingIds.has(order.id)"
              :is-new="newOrderIds.has(order.id)"
              @mark-done="handleMarkDone"
              @click="acknowledgeNewOrder(order.id)"
            />
          </div>
        </section>

        <section class="orders-section">
          <h2 class="orders-heading orders-heading--ready">
            Spremno za preuzimanje
            <span class="orders-count">{{ readyOrders.length }}</span>
          </h2>
          <p v-if="readyOrders.length === 0" class="orders-empty">
            Nema spremnih porudžbina.
          </p>
          <div class="orders-grid">
            <OrderCard
              v-for="order in readyOrders"
              :key="order.id"
              :order="order"
              variant="ready"
            />
          </div>
        </section>

        <section v-if="recentlyPickedUp.length > 0" class="orders-section">
          <h2 class="orders-heading orders-heading--muted">Nedavno preuzeto</h2>
          <div class="orders-grid">
            <OrderCard
              v-for="order in recentlyPickedUp"
              :key="order.id"
              :order="order"
              variant="picked-up"
            />
          </div>
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

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.orders-empty {
  color: var(--ck-text-secondary);
  margin: 0;
}
</style>
