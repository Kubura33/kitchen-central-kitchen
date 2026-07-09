/**
 * Thin fetch wrapper for the Central Kitchen API. Mirrors the mobile app's
 * client: bearer token auth, Laravel JSON errors surfaced as ApiError, and a
 * 401 hook so an expired session drops back to the login screen.
 */

const TOKEN_STORAGE_KEY = 'ck_kitchen_token'
const USER_STORAGE_KEY = 'ck_kitchen_user'

const API_PREFIX = '/api/v1'

export class ApiError extends Error {
  readonly status: number | null
  readonly errors: Record<string, string[]>

  constructor(
    message: string,
    status: number | null = null,
    errors: Record<string, string[]> = {},
  ) {
    super(message)
    this.status = status
    this.errors = errors
  }

  fieldMessage(field: string): string | null {
    return this.errors[field]?.[0] ?? null
  }
}

let onUnauthorized: (() => void) | null = null

/** Registered once by the auth composable to clear the session on 401. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

export function readStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function storeToken(token: string | null): void {
  if (token === null) {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } else {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  }
}

export function readStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_STORAGE_KEY)
  if (raw === null) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function storeUser(user: object | null): void {
  if (user === null) {
    localStorage.removeItem(USER_STORAGE_KEY)
  } else {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  }
}

function baseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined
  const root = (configured ?? '').replace(/\/$/, '')
  return `${root}${API_PREFIX}`
}

interface RequestOptions {
  method?: string
  body?: object
  query?: Record<string, string | number | undefined>
  /** Skip the global 401 handler (used by the login call itself). */
  skipUnauthorizedHandler?: boolean
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, query, skipUnauthorizedHandler } = options

  // Falls back to the current origin when VITE_API_BASE_URL is relative or
  // unset (dev proxy setups, tests); an absolute base URL wins as-is.
  const url = new URL(`${baseUrl()}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const token = readStoredToken()
  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token !== null ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Server nije dostupan. Proverite internet vezu.')
  }

  if (response.status === 401 && !skipUnauthorizedHandler) {
    storeToken(null)
    storeUser(null)
    onUnauthorized?.()
  }

  const text = await response.text()
  const payload = text === '' ? {} : safeParse(text)

  if (!response.ok) {
    const message =
      typeof payload.message === 'string' && payload.message !== ''
        ? payload.message
        : `Zahtev nije uspeo. Status: ${response.status}`
    throw new ApiError(
      message,
      response.status,
      (payload.errors as Record<string, string[]>) ?? {},
    )
  }

  return payload as T
}

function safeParse(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}
