<script setup lang="ts">
import OrderCard from './OrderCard.vue'
import type { Order, OrderCompany } from '../api/types'

interface Props {
  orders: Order[]
  company: OrderCompany | null
  variant: 'preparing' | 'ready' | 'picked-up'
  audience?: 'kitchen' | 'cashier'
  markingIds: ReadonlySet<number>
  newOrderIds?: ReadonlySet<number>
}

interface Emits {
  'mark-done': [orderId: number]
  'mark-picked-up': [orderId: number]
  'acknowledge-new': [orderId: number]
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<template>
  <section class="order-group" :class="{ 'order-group--company': company !== null }">
    <header v-if="company !== null" class="order-group-header">
      <div>
        <h3 class="order-group-name">{{ company.name }}</h3>
        <p class="order-group-code">Kod kompanije: {{ company.code }}</p>
      </div>
      <span class="order-group-count">{{ orders.length }}</span>
    </header>

    <div class="orders-grid">
      <OrderCard
        v-for="order in orders"
        :key="order.id"
        :order="order"
        :variant="variant"
        :audience="audience"
        :is-marking="markingIds.has(order.id)"
        :is-new="newOrderIds?.has(order.id)"
        @mark-done="emit('mark-done', $event)"
        @mark-picked-up="emit('mark-picked-up', $event)"
        @click="emit('acknowledge-new', order.id)"
      />
    </div>
  </section>
</template>

<style scoped>
.order-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
  margin-bottom: 10px;
}

.order-group--company {
  padding: 14px;
  border: 1px solid var(--ck-orange-selected);
  border-radius: var(--ck-radius-card);
  background: rgb(255 248 238 / 0.55);
}

.order-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.order-group-name {
  margin: 0;
  color: var(--ck-brown);
  font-size: 16px;
}

.order-group-code {
  margin: 3px 0 0;
  color: var(--ck-text-secondary);
  font-size: 12px;
}

.order-group-count {
  min-width: 28px;
  padding: 3px 9px;
  border-radius: var(--ck-radius-chip);
  background: var(--ck-orange-selected);
  color: var(--ck-orange);
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

.orders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
</style>
