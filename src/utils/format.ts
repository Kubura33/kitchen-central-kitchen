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

/**
 * The local calendar day as `YYYY-MM-DD`, the API's `arrival_date` format.
 * Local on purpose: the kitchen's "today" is the kitchen PC's day.
 */
export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Spelled out rather than taken from Intl: `sr-RS` resolves to Cyrillic, and
// the webview's locale data is not guaranteed to carry `sr-Latn`.
const WEEKDAYS = [
  'nedelja',
  'ponedeljak',
  'utorak',
  'sreda',
  'četvrtak',
  'petak',
  'subota',
]

/** `2026-10-05T10:30:00Z` -> `ponedeljak, 05.10.` (local time). */
export function formatWeekdayDate(iso: string | null): string {
  if (iso === null) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${WEEKDAYS[date.getDay()]}, ${day}.${month}.`
}

/** `1250.00` -> `1.250 RSD`, matching the mobile app's formatRsd. */
export function formatRsd(amount: string): string {
  const value = Math.round(Number.parseFloat(amount) || 0)
  const withDots = value
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${withDots} RSD`
}
