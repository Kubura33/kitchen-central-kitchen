<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  done: number
  total: number
}

const props = defineProps<Props>()

const percent = computed(() =>
  props.total === 0 ? 0 : Math.round((props.done / props.total) * 100),
)
const isComplete = computed(() => props.total > 0 && props.done >= props.total)
</script>

<template>
  <div
    class="order-progress"
    :class="{ 'order-progress--complete': isComplete }"
    role="progressbar"
    :aria-valuenow="done"
    aria-valuemin="0"
    :aria-valuemax="total"
  >
    <div class="order-progress-track">
      <div class="order-progress-fill" :style="{ width: `${percent}%` }" />
    </div>
    <span class="order-progress-label">{{ done }}/{{ total }} gotovo</span>
  </div>
</template>

<style scoped>
.order-progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.order-progress-track {
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: var(--ck-divider);
  overflow: hidden;
}

.order-progress-fill {
  height: 100%;
  border-radius: 5px;
  background: var(--ck-orange);
  transition: width 0.25s ease;
}

.order-progress--complete .order-progress-fill {
  background: var(--ck-green);
}

.order-progress-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--ck-brown);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.order-progress--complete .order-progress-label {
  color: var(--ck-green);
}
</style>
