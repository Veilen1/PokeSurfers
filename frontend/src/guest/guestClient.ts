import type { ApiClient } from '../api/types'
import { guestCreatures, guestLeaders, guestPurchase, guestRun, guestSelect } from './progress'
import { createGuestStore, type GuestStorage } from './store'

/**
 * Offline implementation of the API contract. It keeps the player's coins, XP
 * and unlocks in localStorage and applies the same catalog and reward rules as
 * the server, so the game is fully playable from a static deployment.
 */
export function createGuestClient(storage?: GuestStorage): ApiClient {
  const store = createGuestStore(storage)

  return {
    async getCurrentProfile() {
      return store.read().profile
    },

    async listCreatures() {
      return guestCreatures(store.read())
    },

    async getLeaderboard() {
      return guestLeaders(store.read())
    },

    async login() {
      throw new Error('Accounts need the PokeSurfers server, which is not available right now.')
    },

    async createAccount() {
      throw new Error('Accounts need the PokeSurfers server, which is not available right now.')
    },

    async logout() {
      // Guest progress belongs to this browser, so signing out does nothing.
    },

    async selectCreature(creatureId, formId) {
      const next = guestSelect(store.read(), creatureId, formId)
      store.write(next)
      return next.profile
    },

    async purchaseCreature(creatureId) {
      const next = guestPurchase(store.read(), creatureId)
      store.write(next)
      return next.profile
    },

    async submitRun(run) {
      const result = guestRun(store.read(), run)
      store.write(result.state)
      return { run: result.run, profile: result.state.profile }
    },
  }
}
