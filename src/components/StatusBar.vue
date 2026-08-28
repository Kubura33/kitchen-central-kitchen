<script setup lang="ts">
import { computed } from 'vue'
import { formatClock } from '../utils/format'

interface Props {
  isOnline: boolean
  lastUpdatedAt: Date | null
  soundEnabled: boolean
  userName: string
  roleLabel?: string
}

interface Emits {
  'toggle-sound': []
  logout: []
}

const props = defineProps<Props>()
defineEmits<Emits>()

const lastUpdatedLabel = computed(() =>
  props.lastUpdatedAt === null ? '—' : formatClock(props.lastUpdatedAt),
)
</script>

<template>
  <header class="status-bar">
    <div class="status-brand">
      <span class="status-title">Central Kitchen</span>
      <span class="status-subtitle">{{ roleLabel ?? 'Kuhinja' }}</span>
    </div>

    <div class="status-info">
      <span
        class="status-dot"
        :class="isOnline ? 'status-dot--online' : 'status-dot--offline'"
        :title="isOnline ? 'Povezano' : 'Nema veze sa serverom'"
      ></span>
      <span class="status-updated">
        Poslednje ažuriranje: {{ lastUpdatedLabel }}
      </span>
    </div>

    <div class="status-actions">
      <button
        class="status-button"
        :class="{ 'status-button--active': soundEnabled }"
        type="button"
        @click="$emit('toggle-sound')"
      >
        {{ soundEnabled ? '🔔 Zvuk uključen' : '🔕 Uključi zvuk' }}
      </button>
      <span class="status-user">{{ userName }}</span>
      <button class="status-button" type="button" @click="$emit('logout')">
        Odjava
      </button>
    </div>
  </header>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 20px;
  background: var(--ck-card);
  border-bottom: 1px solid var(--ck-divider);
  position: sticky;
  top: 0;
  z-index: 10;
}

.status-brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.status-title {
  font-weight: 700;
  font-size: 18px;
  color: var(--ck-brown);
}

.status-subtitle {
  color: var(--ck-orange);
  font-weight: 600;
  font-size: 14px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 220px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.status-dot--online {
  background: var(--ck-green);
  box-shadow: 0 0 6px rgb(29 114 53 / 0.6);
}

.status-dot--offline {
  background: var(--ck-danger);
  box-shadow: 0 0 6px rgb(198 40 40 / 0.6);
}

.status-updated {
  color: var(--ck-text-secondary);
  font-size: 13px;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-user {
  color: var(--ck-text-secondary);
  font-size: 14px;
}

.status-button {
  border: 1px solid var(--ck-divider);
  background: var(--ck-bg);
  border-radius: var(--ck-radius-chip);
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ck-text);
  cursor: pointer;
}

.status-button--active {
  border-color: var(--ck-orange);
  background: var(--ck-orange-selected);
  color: var(--ck-orange);
}
</style>
