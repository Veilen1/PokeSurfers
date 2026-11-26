import { z } from 'zod'

export const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(72),
}).strict()

export const selectCreatureSchema = z.object({
  creatureId: z.string().min(1).max(40),
  formId: z.string().min(1).max(40),
}).strict()

export const purchaseSchema = z.object({
  creatureId: z.string().min(1).max(40),
}).strict()

export const submitRunSchema = z.object({
  score: z.number().int().safe().min(0).max(10_000_000),
  durationMs: z.number().int().safe().min(1_000).max(3_600_000),
  collectedCoins: z.number().int().safe().min(0).max(10_000),
  creatureId: z.string().min(1).max(40),
}).strict()

export const leaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict()
