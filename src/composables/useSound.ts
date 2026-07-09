import { readonly, shallowRef } from 'vue'
import newOrderChimeUrl from '../assets/new-order.wav'
import { isTauri } from '../tauri'

const SOUND_STORAGE_KEY = 'ck_kitchen_sound_enabled'

const storedPreference = localStorage.getItem(SOUND_STORAGE_KEY)

// The desktop app's webview allows autoplay without a user gesture, so sound
// starts enabled there; browsers keep the explicit opt-in toggle.
const enabled = shallowRef(
  storedPreference === null ? isTauri() : storedPreference === '1',
)

/**
 * New-order chime with an explicit opt-in toggle. Browsers block audio until
 * a user gesture, so the toggle click itself plays a silent priming sound —
 * after that, polls may play the chime freely.
 */
export function useSound() {
  function toggle(): void {
    enabled.value = !enabled.value
    localStorage.setItem(SOUND_STORAGE_KEY, enabled.value ? '1' : '0')
    if (enabled.value) {
      // The toggle click is a user gesture: unlock audio for later polls.
      const primer = new Audio(newOrderChimeUrl)
      primer.volume = 0
      void primer.play().catch(() => {})
    }
  }

  function playNewOrder(): void {
    if (!enabled.value) return
    void new Audio(newOrderChimeUrl).play().catch(() => {
      // Autoplay refused (e.g. after a browser restart without a gesture);
      // the visual highlight still announces the order.
    })
  }

  return {
    enabled: readonly(enabled),
    toggle,
    playNewOrder,
  }
}
