import { createGuestState, normalizeGuestState, type GuestState } from './progress'

export const GUEST_STORAGE_KEY = 'pokesurfers.guest.v1'

export interface GuestStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface GuestStore {
  read(): GuestState
  write(state: GuestState): void
}

function browserStorage(): GuestStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Small localStorage wrapper for guest progress. Reads are validated on every
 * access, writes fall back to memory when storage is blocked (private mode, full
 * quota), and a missing or corrupt entry simply starts a fresh trail.
 */
export function createGuestStore(storage: GuestStorage | null = browserStorage()): GuestStore {
  let memory: GuestState | null = null

  return {
    read() {
      try {
        const raw = storage?.getItem(GUEST_STORAGE_KEY)
        if (raw) {
          const parsed = normalizeGuestState(JSON.parse(raw))
          memory = parsed
          return parsed
        }
      } catch {
        // Fall through to the in-memory copy or a fresh state.
      }
      return memory ?? createGuestState()
    },

    write(state) {
      memory = state
      try {
        storage?.setItem(GUEST_STORAGE_KEY, JSON.stringify(state))
      } catch {
        // Keep playing from memory when the browser refuses to persist.
      }
    },
  }
}
