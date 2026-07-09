<script setup lang="ts">
import LoginView from './views/LoginView.vue'
import OrdersView from './views/OrdersView.vue'
import { useAuth } from './composables/useAuth'

const { isAuthenticated } = useAuth()
</script>

<template>
  <OrdersView v-if="isAuthenticated" />
  <LoginView v-else />
</template>
