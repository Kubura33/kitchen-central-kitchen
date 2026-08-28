<script setup lang="ts">
import { computed } from 'vue'
import type { Order } from '../api/types'
import { formatRsd, formatTime } from '../utils/format'

interface Props {
  order: Order
  variant: 'preparing' | 'ready' | 'picked-up'
  isMarking?: boolean
  isNew?: boolean
}

interface Emits {
  'mark-done': [orderId: number]
  'mark-picked-up': [orderId: number]
}

const props = defineProps<Props>()
defineEmits<Emits>()

const customerName = computed(() => {
  const name = [
    props.order.customer_first_name,
    props.order.customer_last_name,
  ]
    .filter((part) => part.trim() !== '')
    .join(' ')
  return name === '' ? 'Gost' : name
})

const paymentLabel = computed(() =>
  props.order.payment_method === 'card' ? 'Kartica' : 'Gotovina',
)
</script>

<template>
  <article
    class="order-card"
    :class="{
      'order-card--new': isNew,
      'order-card--muted': variant === 'picked-up',
    }"
  >
    <header class="order-header">
      <div class="order-identity">
        <h3 class="order-customer">{{ customerName }}</h3>
        <p v-if="order.customer_phone" class="order-phone">
          {{ order.customer_phone }}
        </p>
        <span v-if="order.company" class="order-company">
          {{ order.company.name }}
        </span>
      </div>
      <div class="order-arrival" title="Vreme dolaska">
        <span class="order-arrival-label">Dolazak</span>
        <span class="order-arrival-time">{{ formatTime(order.arrival_time) }}</span>
      </div>
      <div class="order-code" title="Kod za preuzimanje">
        {{ order.pickup_code }}
      </div>
    </header>

    <div class="order-meta">
      <span class="order-chip">💳 {{ paymentLabel }}</span>
    </div>

    <ul class="order-lines">
      <li v-for="line in order.lines" :key="line.id" class="order-line">
        <div class="order-line-main">
          <span class="order-line-qty">{{ line.quantity }}×</span>
          <span class="order-line-name">
            {{ line.meal_name }}
            <span
              v-if="line.side_dishes && line.side_dishes.length > 0"
              class="order-line-sides"
            >
              ({{ line.side_dishes.join(', ') }})
            </span>
          </span>
          <span class="order-line-price">
            <span class="order-line-calc">
              {{ line.quantity }} × {{ formatRsd(line.unit_price) }} =
            </span>
            <span class="order-line-total">{{ formatRsd(line.line_total) }}</span>
          </span>
        </div>
        <p v-if="line.note" class="order-line-note">Napomena: {{ line.note }}</p>
      </li>
    </ul>

    <div class="order-total">
      <span class="order-total-label">Ukupno</span>
      <span class="order-total-value">{{ formatRsd(order.total_price) }}</span>
    </div>

    <p v-if="order.note" class="order-note">Napomena: {{ order.note }}</p>

    <footer class="order-footer">
      <button
        v-if="variant === 'preparing'"
        class="order-done-button"
        type="button"
        :disabled="isMarking"
        @click="$emit('mark-done', order.id)"
      >
        {{ isMarking ? 'Označavanje…' : 'Označi kao gotovo' }}
      </button>
      <template v-else-if="variant === 'ready'">
        <span class="order-ready-tag">✓ Spremno</span>
        <button
          class="order-pickup-button"
          type="button"
          :disabled="isMarking"
          @click="$emit('mark-picked-up', order.id)"
        >
          {{ isMarking ? 'Označavanje…' : 'Označi kao preuzeto' }}
        </button>
      </template>
      <span v-else class="order-picked-up-tag">Preuzeto</span>
    </footer>
  </article>
</template>

<style scoped>
.order-card {
  background: var(--ck-card);
  border-radius: var(--ck-radius-card);
  box-shadow: var(--ck-shadow-card);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 2px solid transparent;
  transition: border-color 0.3s ease;
}

.order-card--new {
  border-color: var(--ck-orange);
  animation: order-pulse 1.2s ease-in-out 3;
}

.order-card--muted {
  opacity: 0.65;
}

@keyframes order-pulse {
  50% {
    box-shadow: 0 0 0 6px rgb(251 88 42 / 0.25);
  }
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.order-identity {
  min-width: 0;
  flex: 1;
}

.order-customer {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.order-phone {
  margin: 2px 0 0;
  color: var(--ck-text-secondary);
  font-size: 13px;
}

.order-company {
  display: inline-block;
  margin-top: 6px;
  padding: 3px 10px;
  border-radius: var(--ck-radius-chip);
  background: var(--ck-orange-selected);
  color: var(--ck-orange);
  font-size: 12px;
  font-weight: 700;
}

.order-arrival {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
}

.order-arrival-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ck-orange);
}

.order-arrival-time {
  font-size: 24px;
  line-height: 1.1;
  font-weight: 800;
  color: var(--ck-orange);
  font-variant-numeric: tabular-nums;
}

.order-code {
  font-family: 'Caveat Brush', cursive;
  font-size: 34px;
  line-height: 1;
  color: var(--ck-brown);
  background: var(--ck-bg);
  border: 1px dashed var(--ck-divider);
  border-radius: 12px;
  padding: 8px 14px;
  letter-spacing: 2px;
}

.order-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.order-chip {
  background: var(--ck-bg);
  border-radius: var(--ck-radius-chip);
  padding: 4px 12px;
  font-size: 13px;
  color: var(--ck-text-secondary);
}

.order-lines {
  list-style: none;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--ck-divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.order-line-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 16px;
}

.order-line-qty {
  font-weight: 700;
  color: var(--ck-orange);
  min-width: 30px;
}

.order-line-name {
  flex: 1;
  min-width: 0;
}

.order-line-sides {
  color: var(--ck-text-secondary);
  font-size: 14px;
}

.order-line-price {
  margin-left: auto;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.order-line-calc {
  color: var(--ck-text-secondary);
  font-size: 15px;
}

.order-line-total {
  font-size: 17px;
  font-weight: 700;
}

.order-line-note {
  margin: 4px 0 0 38px;
  color: var(--ck-text-secondary);
  font-style: italic;
  font-size: 14px;
}

.order-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  border-top: 2px solid var(--ck-divider);
}

.order-total-label {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ck-text-secondary);
}

.order-total-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--ck-brown);
  font-variant-numeric: tabular-nums;
}

.order-note {
  margin: 0;
  padding: 8px 12px;
  background: var(--ck-bg);
  border-radius: 10px;
  font-size: 14px;
  color: var(--ck-text-secondary);
}

.order-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
}

.order-done-button {
  height: 46px;
  padding: 0 22px;
  border: none;
  border-radius: var(--ck-radius-button);
  background: var(--ck-orange);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.order-done-button:hover:not(:disabled) {
  background: var(--ck-orange-pressed);
}

.order-done-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.order-ready-tag {
  color: var(--ck-green);
  font-weight: 700;
  font-size: 14px;
  margin-right: auto;
}

.order-pickup-button {
  height: 46px;
  padding: 0 22px;
  border: none;
  border-radius: var(--ck-radius-button);
  background: var(--ck-green);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.order-pickup-button:hover:not(:disabled) {
  filter: brightness(0.92);
}

.order-pickup-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.order-picked-up-tag {
  color: var(--ck-text-light);
  font-weight: 600;
  font-size: 13px;
}
</style>
