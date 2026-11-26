import type { ApiClient } from './types'
import { liveClient } from './client'

let activeClient: ApiClient = liveClient

/** Switches between the server API and the localStorage guest client. */
export function setApiClient(client: ApiClient): void {
  activeClient = client
}

/**
 * Stable facade over whichever client is active. Consumers keep importing
 * `api`, while the boot sequence decides whether requests go to the server or
 * to the guest store.
 */
export const api: ApiClient = {
  getCurrentProfile: () => activeClient.getCurrentProfile(),
  listCreatures: () => activeClient.listCreatures(),
  getLeaderboard: () => activeClient.getLeaderboard(),
  login: (credentials) => activeClient.login(credentials),
  createAccount: (credentials) => activeClient.createAccount(credentials),
  logout: () => activeClient.logout(),
  selectCreature: (creatureId, formId) => activeClient.selectCreature(creatureId, formId),
  purchaseCreature: (creatureId) => activeClient.purchaseCreature(creatureId),
  submitRun: (run) => activeClient.submitRun(run),
}

export { liveClient }
