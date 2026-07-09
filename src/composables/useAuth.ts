import { computed, readonly, shallowRef } from 'vue'
import {
  ApiError,
  readStoredToken,
  readStoredUser,
  request,
  setUnauthorizedHandler,
  storeToken,
  storeUser,
} from '../api/client'
import type { LoginResponse } from '../api/types'

type KitchenUser = LoginResponse['user']

/**
 * Module-scoped singleton auth state: the dashboard is a single page, so the
 * refs below act as the one source of truth shared by every consumer.
 */
const token = shallowRef<string | null>(readStoredToken())
const user = shallowRef<KitchenUser | null>(readStoredUser<KitchenUser>())

setUnauthorizedHandler(() => {
  token.value = null
  user.value = null
})

export function useAuth() {
  const isAuthenticated = computed(() => token.value !== null)

  async function login(email: string, password: string): Promise<void> {
    const response = await request<LoginResponse>('/login', {
      method: 'POST',
      body: { email, password, device_name: 'kitchen-dashboard' },
      skipUnauthorizedHandler: true,
    })

    if (response.user.role !== 'kitchen' && response.user.role !== 'admin') {
      throw new ApiError('Ovaj nalog nema pristup kuhinjskom panelu.')
    }

    storeToken(response.token)
    storeUser(response.user)
    token.value = response.token
    user.value = response.user
  }

  async function logout(): Promise<void> {
    try {
      await request('/logout', { method: 'POST' })
    } catch {
      // Best effort: the local session is cleared regardless.
    }
    storeToken(null)
    storeUser(null)
    token.value = null
    user.value = null
  }

  return {
    isAuthenticated,
    user: readonly(user),
    login,
    logout,
  }
}
