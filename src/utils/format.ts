/** Formatting helpers shared by the order UI. */

export function formatTime(iso: string | null): string {
  if (iso === null) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** `1250.00` -> `1.250 RSD`, matching the mobile app's formatRsd. */
export function formatRsd(amount: string): string {
  const value = Math.round(Number.parseFloat(amount) || 0)
  const withDots = value
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${withDots} RSD`
}
