/**
 * Accounts that get the cashier view: "Spremno za preuzimanje" only, without
 * the "U pripremi" section.
 *
 * This is a cosmetic split, not an access boundary. These are ordinary
 * `kitchen` users on the API and their tokens keep the full `kitchen` ability,
 * so the API would still accept a mark-as-ready call from them — the section
 * is simply not rendered. The list is baked into the bundle at build time, so
 * changing it means rebuilding and reinstalling the desktop app.
 *
 * Entries must be lowercase; the lookup normalizes the address it is given.
 */
export const CASHIER_EMAILS: readonly string[] = ['kasa@centralkitchen.rs']

export function isCashierEmail(email: string | null | undefined): boolean {
  if (email === null || email === undefined) return false
  const normalized = email.trim().toLowerCase()
  return CASHIER_EMAILS.includes(normalized)
}
