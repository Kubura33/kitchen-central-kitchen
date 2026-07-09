<script setup lang="ts">
import { shallowRef } from 'vue'
import { ApiError } from '../api/client'
import { useAuth } from '../composables/useAuth'

const { login } = useAuth()

const email = shallowRef('')
const password = shallowRef('')
const isSubmitting = shallowRef(false)
const errorMessage = shallowRef<string | null>(null)

async function submit(): Promise<void> {
  if (isSubmitting.value) return
  isSubmitting.value = true
  errorMessage.value = null
  try {
    await login(email.value.trim(), password.value)
  } catch (error) {
    errorMessage.value =
      error instanceof ApiError ? error.message : 'Prijava nije uspela.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <main class="login">
    <form class="login-card" @submit.prevent="submit">
      <h1 class="login-title">Central Kitchen</h1>
      <p class="login-subtitle">Kuhinjski panel</p>

      <label class="login-label" for="email">Email</label>
      <input
        id="email"
        v-model="email"
        class="login-input"
        type="email"
        autocomplete="username"
        required
      />

      <label class="login-label" for="password">Lozinka</label>
      <input
        id="password"
        v-model="password"
        class="login-input"
        type="password"
        autocomplete="current-password"
        required
      />

      <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>

      <button class="login-submit" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? 'Prijavljivanje…' : 'Prijavi se' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--ck-card);
  border-radius: var(--ck-radius-card);
  box-shadow: var(--ck-shadow-deep);
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
}

.login-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: var(--ck-brown);
  text-align: center;
}

.login-subtitle {
  margin: 4px 0 24px;
  text-align: center;
  color: var(--ck-text-secondary);
}

.login-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.login-input {
  font: inherit;
  padding: 12px 14px;
  margin-bottom: 16px;
  border: 1px solid var(--ck-divider);
  border-radius: var(--ck-radius-input);
  background: var(--ck-bg);
}

.login-input:focus {
  outline: none;
  border: 1.5px solid var(--ck-orange);
}

.login-error {
  margin: 0 0 12px;
  color: var(--ck-danger);
  font-size: 14px;
}

.login-submit {
  height: 54px;
  border: none;
  border-radius: var(--ck-radius-button);
  background: var(--ck-orange);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.2px;
  cursor: pointer;
}

.login-submit:hover:not(:disabled) {
  background: var(--ck-orange-pressed);
}

.login-submit:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
