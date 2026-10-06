<script setup lang="ts">
import { computed } from 'vue'
import type { Order, OrderLine } from '../api/types'

interface Props {
  order: Order
  disabled?: boolean
}

interface Emits {
  'set-prepared': [orderId: number, lineId: number, count: number]
}

interface Portion {
  key: string
  line: OrderLine
  /** Position within its line: finished portions first, then the open ones. */
  number: number
  isDone: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

/**
 * One card per portion. Portions of a line are identical, so the API stores
 * only how many are done; which card is "the" finished one is a drawing
 * decision. Open portions come first so the cook always works from the top.
 */
const portions = computed<Portion[]>(() => {
  const all = props.order.lines.flatMap((line) =>
    Array.from({ length: line.quantity }, (_, index): Portion => ({
      key: `${line.id}-${index + 1}`,
      line,
      number: index + 1,
      isDone: index < (line.prepared_quantity ?? 0),
    })),
  )
  return [...all.filter((p) => !p.isDone), ...all.filter((p) => p.isDone)]
})

function toggle(portion: Portion): void {
  const done = portion.line.prepared_quantity ?? 0
  const next = portion.isDone ? done - 1 : done + 1
  emit('set-prepared', props.order.id, portion.line.id, next)
}
</script>

<template>
  <ul class="portion-list">
    <li
      v-for="portion in portions"
      :key="portion.key"
      class="portion"
      :class="{ 'portion--done': portion.isDone }"
    >
      <div class="portion-info">
        <span class="portion-name">
          {{ portion.line.meal_name }}
          <span
            v-if="portion.line.side_dishes && portion.line.side_dishes.length > 0"
            class="portion-sides"
          >
            ({{ portion.line.side_dishes.join(', ') }})
          </span>
        </span>
        <span v-if="portion.line.quantity > 1" class="portion-count">
          {{ portion.number }}/{{ portion.line.quantity }}
        </span>
        <p v-if="portion.line.note" class="portion-note">
          Napomena: {{ portion.line.note }}
        </p>
      </div>
      <button
        class="portion-button"
        type="button"
        :disabled="disabled"
        @click="toggle(portion)"
      >
        {{ portion.isDone ? '✓ Gotovo · Vrati' : 'Spremno' }}
      </button>
    </li>
  </ul>
</template>

<style scoped>
.portion-list {
  list-style: none;
  margin: 0;
  padding: 12px 0 0;
  border-top: 1px solid var(--ck-divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.portion {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 2px solid var(--ck-orange-selected);
  border-left: 6px solid var(--ck-orange);
  border-radius: 12px;
  background: var(--ck-card);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.portion--done {
  border-color: rgb(29 114 53 / 0.2);
  border-left-color: var(--ck-green);
  background: rgb(29 114 53 / 0.06);
  opacity: 0.75;
}

.portion-info {
  flex: 1;
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
}

.portion--done .portion-name {
  color: var(--ck-text-secondary);
}

.portion-sides {
  color: var(--ck-text-secondary);
  font-size: 14px;
  font-weight: 400;
}

.portion-count {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 9px;
  border-radius: var(--ck-radius-chip);
  background: var(--ck-bg);
  color: var(--ck-text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.portion-note {
  margin: 4px 0 0;
  color: var(--ck-text-secondary);
  font-size: 14px;
  font-style: italic;
  font-weight: 400;
}

.portion-button {
  min-width: 118px;
  height: 48px;
  padding: 0 18px;
  border: none;
  border-radius: var(--ck-radius-button);
  background: var(--ck-orange);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.portion-button:hover:not(:disabled) {
  background: var(--ck-orange-pressed);
}

.portion--done .portion-button {
  background: transparent;
  color: var(--ck-green);
  border: 2px solid rgb(29 114 53 / 0.35);
  font-size: 13px;
}

.portion--done .portion-button:hover:not(:disabled) {
  background: rgb(29 114 53 / 0.1);
}

.portion-button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
