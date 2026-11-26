/** Game rules shared by the API and the offline guest client. */

export function levelForXp(xp: number): number {
  return Math.floor(xp / 100) + 1
}

export function isValidRun(
  score: number,
  durationMs: number,
  collectedCoins: number,
): boolean {
  if (!Number.isSafeInteger(score) || !Number.isSafeInteger(durationMs) || !Number.isSafeInteger(collectedCoins)) {
    return false
  }

  if (score < 0 || durationMs < 1_000 || durationMs > 3_600_000 || collectedCoins < 0) {
    return false
  }

  const durationSeconds = durationMs / 1_000
  return score <= durationSeconds * 2_400 + 5_000 && collectedCoins <= durationSeconds * 3 + 6
}

export function rewardsForRun(score: number, durationMs: number, collectedCoins: number) {
  return {
    coins: collectedCoins + Math.floor(score / 500),
    xp: Math.floor(score / 250) + Math.floor(durationMs / 2_000),
  }
}
