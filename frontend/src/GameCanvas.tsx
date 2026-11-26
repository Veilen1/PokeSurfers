import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Button } from '@fluentui/react-components'
import {
  ArrowDownRegular,
  ArrowUpRegular,
  PauseRegular,
  PlayRegular,
  Speaker2Regular,
  SpeakerMuteRegular,
} from '@fluentui/react-icons'
import type { Creature } from '@trailkin/shared'
import {
  MOUNT_TOLERANCE,
  PLATFORM_HEIGHT,
  PLAYER_Z,
  POINTS_PER_METER,
  TALL_PLATFORM_HEIGHT,
  clearsBarrier,
  coinInReach,
  createPlayerState,
  jump,
  multiplierAt,
  passesBranch,
  platformTopAt,
  slide,
  speedAt,
  stepPlayer,
  type PlayerState,
} from './runnerMechanics'
import type { PowerupKind, RunnerObject, RunnerScene } from './runnerScene'
import { cityAtScore } from './cities'
import { PixelText } from './PixelText'
import { gameAudio } from './gameAudio'

interface GameCanvasProps {
  creature: Creature
  formId: string
  formName: string
  onRunEnd: (result: { score: number; durationMs: number; collectedCoins: number }) => void
}

type Status = 'ready' | 'running' | 'paused' | 'finished'
type FlashKind = 'crash' | 'powerup' | 'city'

const numberFormatter = new Intl.NumberFormat('en-US')
const COARSE_POINTER = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

const LANE_SPACING = 2.4
const laneX = (lane: number) => (lane - 1) * LANE_SPACING

interface GameState extends PlayerState {
  elapsed: number
  distance: number
  score: number
  coins: number
  multiplier: number
  maxMultiplier: number
  magnetRemaining: number
  doubleRemaining: number
  sneakersRemaining: number
  hoverboardCharges: number
  invulnerableRemaining: number
  pickupKind: PowerupKind | null
  pickupRemaining: number
  spawnIn: number
  objects: RunnerObject[]
  pointer: { x: number; y: number } | null
}

const LANES = [0, 1, 2] as const

const POWERUP_LABELS: Record<PowerupKind, string> = {
  magnet: 'POKÉ BALL - MAGNET',
  double: 'GREAT BALL - ×2 SCORE',
  sneakers: 'ULTRA BALL - SUPER SNEAKERS',
  hoverboard: 'MASTER BALL - HOVERBOARD',
}

const POWERUP_BALL_ICONS: Record<PowerupKind, string> = {
  magnet: 'ball-poke',
  double: 'ball-great',
  sneakers: 'ball-ultra',
  hoverboard: 'ball-master',
}

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]
const difficultyAt = (distance: number) => Math.min(distance / 1_500, 1)

const initialGame = (): GameState => ({
  ...createPlayerState(1),
  elapsed: 0,
  distance: 0,
  score: 0,
  coins: 0,
  multiplier: 1,
  maxMultiplier: 1,
  magnetRemaining: 0,
  doubleRemaining: 0,
  sneakersRemaining: 0,
  hoverboardCharges: 0,
  invulnerableRemaining: 0,
  pickupKind: null,
  pickupRemaining: 0,
  spawnIn: 0.9,
  objects: [],
  pointer: null,
})

let objectIdCounter = 0

function addObject(
  game: GameState,
  object: Omit<RunnerObject, 'id' | 'collected' | 'resolved'>,
): void {
  game.objects.push({
    ...object,
    id: objectIdCounter,
    collected: false,
    resolved: false,
  })
  objectIdCounter += 1
}

function addCoinLine(game: GameState, lane: number, startZ: number, count: number, spacing: number, y: number): void {
  for (let index = 0; index < count; index += 1) {
    addObject(game, { lane, z: startZ + index * spacing, kind: 'coin', length: 0, height: 0, y, ramp: false })
  }
}

function addPowerup(game: GameState, lane: number, z: number, y = 1.25): void {
  const roll = Math.random()
  const powerup: PowerupKind = roll < 0.3 ? 'magnet' : roll < 0.6 ? 'double' : roll < 0.85 ? 'sneakers' : 'hoverboard'
  addObject(game, { lane, z, kind: 'powerup', length: 0, height: 0, y, ramp: false, powerup })
}

function applyPowerup(game: GameState, powerup: PowerupKind): void {
  if (powerup === 'magnet') game.magnetRemaining = 8
  else if (powerup === 'double') game.doubleRemaining = 10
  else if (powerup === 'sneakers') game.sneakersRemaining = 10
  else game.hoverboardCharges = 1
}

/** A lane is busy while a long train is still approaching or under the runner. */
function laneBusy(game: GameState, lane: number): boolean {
  return game.objects.some((object) => object.kind === 'platform'
    && object.lane === lane
    && object.z + object.length / 2 > -50
    && object.z - object.length / 2 < 12)
}

function spawnWave(game: GameState): void {
  const difficulty = difficultyAt(game.distance)
  const freeLanes = LANES.filter((lane) => !laneBusy(game, lane))
  const openLanes = freeLanes.length > 0 ? freeLanes : [...LANES]
  const roll = Math.random()

  if (roll < 0.4) {
    const lane = pick(openLanes)
    const tall = difficulty > 0.3 && Math.random() < 0.32
    const height = tall ? TALL_PLATFORM_HEIGHT : PLATFORM_HEIGHT
    const length = 13 + Math.random() * 9 + difficulty * 26
    const farEdge = -56 - length
    addObject(game, {
      lane,
      z: farEdge + length / 2,
      kind: 'platform',
      length,
      height,
      y: 0,
      ramp: !tall && Math.random() < 0.5,
    })
    addCoinLine(game, lane, farEdge + 3, 3, 3.6, height + 1)
    if (Math.random() < 0.22) addPowerup(game, lane, farEdge + length - 4, height + 1.2)

    if (tall && openLanes.length >= 3) {
      // A lower platform in a neighbouring lane becomes the stepping stone
      // used to reach the tall roof when Super Sneakers are not active.
      const stepLane = openLanes.find((candidate) => candidate !== lane)
      if (stepLane !== undefined) {
        const stepLength = Math.max(10, length * 0.75)
        const stepFar = -56 - stepLength
        addObject(game, {
          lane: stepLane,
          z: stepFar + stepLength / 2,
          kind: 'platform',
          length: stepLength,
          height: PLATFORM_HEIGHT,
          y: 0,
          ramp: false,
        })
        addCoinLine(game, stepLane, stepFar + 3, 2, 3.6, PLATFORM_HEIGHT + 1)
      }
      return
    }

    if (difficulty > 0.55 && openLanes.length >= 2 && Math.random() < 0.4) {
      const secondLane = openLanes.find((candidate) => candidate !== lane)
      if (secondLane !== undefined) {
        const secondLength = 10 + Math.random() * 10 + difficulty * 16
        const secondFar = -56 - secondLength
        addObject(game, {
          lane: secondLane,
          z: secondFar + secondLength / 2,
          kind: 'platform',
          length: secondLength,
          height: PLATFORM_HEIGHT,
          y: 0,
          ramp: Math.random() < 0.4,
        })
      }
    }
    return
  }

  const shuffled = [...openLanes].sort(() => Math.random() - 0.5)
  const maxHazards = Math.max(0, shuffled.length - 1)
  const hazardCount = Math.min(maxHazards, Math.random() < 0.35 + difficulty * 0.45 ? 2 : 1)

  if (hazardCount > 0) {
    const hazardLanes = shuffled.slice(0, hazardCount)
    const kind = roll < 0.72 ? 'barrier' : 'branch'
    for (const lane of hazardLanes) {
      addObject(game, { lane, z: -54, kind, length: 0, height: 0, y: 0, ramp: false })
    }
    const safeLane = shuffled.find((lane) => !hazardLanes.includes(lane))
    if (safeLane !== undefined) {
      addCoinLine(game, safeLane, -58, 3, 3.1, 1)
      if (Math.random() < 0.14) addPowerup(game, safeLane, -74)
    }
    return
  }

  const coinLane = pick(openLanes)
  addCoinLine(game, coinLane, -58, 3, 3.1, 1)
  if (Math.random() < 0.12) addPowerup(game, coinLane, -74)
}

export default function GameCanvas({ creature, formId, formName, onRunEnd }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState>(initialGame())
  const statusRef = useRef<Status>('ready')
  const onRunEndRef = useRef(onRunEnd)
  const [status, setStatus] = useState<Status>('ready')
  const [score, setScore] = useState(0)
  const [distance, setDistance] = useState(0)
  const [coins, setCoins] = useState(0)
  const [multiplier, setMultiplier] = useState(1)
  const [magnetTime, setMagnetTime] = useState(0)
  const [doubleTime, setDoubleTime] = useState(0)
  const [sneakerTime, setSneakerTime] = useState(0)
  const [boardCharge, setBoardCharge] = useState(0)
  const [cityBanner, setCityBanner] = useState<{ id: string; name: string } | null>(null)
  const [powerupNotice, setPowerupNotice] = useState<PowerupKind | null>(null)
  const [noticeSeq, setNoticeSeq] = useState(0)
  const [muted, setMuted] = useState(() => gameAudio.isMuted)
  const [volume, setVolume] = useState(() => Math.round(gameAudio.volume * 100))
  const [flash, setFlash] = useState<{ kind: FlashKind; id: number } | null>(null)
  const sceneRef = useRef<RunnerScene | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  const cityRef = useRef('pallet')
  const cityTimer = useRef<number | undefined>(undefined)
  const noticeTimer = useRef<number | undefined>(undefined)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    onRunEndRef.current = onRunEnd
  }, [onRunEnd])

  const triggerFlash = (kind: FlashKind, duration: number) => {
    setFlash({ kind, id: Date.now() })
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => setFlash(null), duration)
  }

  useEffect(() => () => {
    if (cityTimer.current) window.clearTimeout(cityTimer.current)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let scene: RunnerScene | undefined
    let disposed = false
    let frame = 0
    let lastFrame = 0
    let lastHudUpdate = 0
    let pendingRender = true
    const hudInterval = COARSE_POINTER ? 180 : 80
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let motionPreference: MediaQueryList | undefined
    let updateMotionPreference: ((event: MediaQueryListEvent) => void) | undefined

    const consumeHoverboard = (game: GameState) => {
      game.hoverboardCharges = 0
      game.invulnerableRemaining = 2
      sceneRef.current?.burst('powerup', laneX(game.lane), game.y, PLAYER_Z)
      sceneRef.current?.shake(0.55)
      triggerFlash('powerup', 300)
      gameAudio.play('powerup', 0.8)
    }

    const finishRun = (game: GameState) => {
      if (statusRef.current === 'finished') return
      const finalScore = Math.floor(game.score)
      gameAudio.play('crash')
      gameAudio.play('gameover', 0.9, 1, 0.3)
      sceneRef.current?.burst('crash', laneX(game.lane), game.y + 0.8, PLAYER_Z)
      sceneRef.current?.shake(1)
      triggerFlash('crash', 620)
      statusRef.current = 'finished'
      setStatus('finished')
      setScore(finalScore)
      setDistance(Math.floor(game.distance))
      setCoins(game.coins)
      setMultiplier(game.multiplier)
      setMagnetTime(game.magnetRemaining)
      setDoubleTime(game.doubleRemaining)
      setSneakerTime(game.sneakersRemaining)
      setBoardCharge(game.hoverboardCharges)
      onRunEndRef.current({
        score: finalScore,
        durationMs: Math.max(1_000, Math.floor(game.elapsed * 1_000)),
        collectedCoins: game.coins,
      })
    }

    const render = (now: number) => {
      const activeScene = scene
      if (!activeScene) return
      if (document.hidden) {
        lastFrame = now
        frame = requestAnimationFrame(render)
        return
      }
      const delta = lastFrame === 0 ? 0 : Math.min((now - lastFrame) / 1_000, 0.05)
      lastFrame = now
      const game = gameRef.current

      if (statusRef.current === 'running' && delta > 0) {
        game.elapsed += delta
        game.magnetRemaining = Math.max(0, game.magnetRemaining - delta)
        game.doubleRemaining = Math.max(0, game.doubleRemaining - delta)
        game.sneakersRemaining = Math.max(0, game.sneakersRemaining - delta)
        game.invulnerableRemaining = Math.max(0, game.invulnerableRemaining - delta)
        game.pickupRemaining = Math.max(0, game.pickupRemaining - delta)

        const speed = speedAt(game.distance)
        game.distance += speed * delta
        game.multiplier = multiplierAt(game.distance)
        game.maxMultiplier = Math.max(game.maxMultiplier, game.multiplier)
        const scoreRate = game.multiplier * (game.doubleRemaining > 0 ? 2 : 1)
        game.score += speed * delta * POINTS_PER_METER * scoreRate

        let coinsThisFrame = 0
        for (const object of game.objects) {
          const previousZ = object.z
          object.z += speed * delta
          if (object.resolved) continue

          if (object.kind === 'coin') {
            const magnet = game.magnetRemaining > 0
            if (!magnet && object.lane !== game.lane) continue
            if (Math.abs(object.z - PLAYER_Z) > (magnet ? 2.2 : 0.9)) continue
            if (!magnet && !coinInReach(game, object.y)) continue
            object.resolved = true
            object.collected = true
            game.coins += 1
            coinsThisFrame += 1
            sceneRef.current?.burst('coin', laneX(object.lane), object.y, object.z)
            continue
          }

          if (object.lane !== game.lane) continue

          if (object.kind === 'powerup') {
            if (Math.abs(object.z - PLAYER_Z) > 1) continue
            if (Math.abs(game.y + 1 - object.y) > 1) continue
            object.resolved = true
            object.collected = true
            const powerup = object.powerup ?? 'magnet'
            applyPowerup(game, powerup)
            gameAudio.play('powerup')
            sceneRef.current?.burst('powerup', laneX(game.lane), game.y, PLAYER_Z)
            sceneRef.current?.shake(0.18)
            triggerFlash('powerup', 260)
            game.pickupKind = powerup
            game.pickupRemaining = 1
            setPowerupNotice(powerup)
            setNoticeSeq((value) => value + 1)
            if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
            noticeTimer.current = window.setTimeout(() => setPowerupNotice(null), 1_500)
            continue
          }

          if (object.kind === 'platform') {
            const previousEdge = previousZ + object.length / 2
            const edge = object.z + object.length / 2
            if (previousEdge <= PLAYER_Z && edge >= PLAYER_Z) {
              object.resolved = true
              if (game.y < object.height - 0.18) {
                const canMount = !game.grounded && game.y >= object.height - MOUNT_TOLERANCE
                if (canMount) {
                  game.y = object.height
                  game.velocityY = 0
                  game.grounded = true
                  gameAudio.play('land', 0.85)
                  sceneRef.current?.burst('land', laneX(game.lane), game.y, PLAYER_Z)
                } else if (object.ramp || game.invulnerableRemaining > 0) {
                  game.y = object.height
                  game.velocityY = 6
                  game.grounded = false
                } else if (game.hoverboardCharges > 0) {
                  consumeHoverboard(game)
                  game.y = object.height
                  game.velocityY = 6
                  game.grounded = false
                } else {
                  finishRun(game)
                  break
                }
              }
            }
            continue
          }

          const crossedPlayer = previousZ <= PLAYER_Z && object.z >= PLAYER_Z
          if (!crossedPlayer) continue

          object.resolved = true
          const hit = object.kind === 'barrier' ? !clearsBarrier(game) : !passesBranch(game)
          if (!hit || game.invulnerableRemaining > 0) continue
          if (game.hoverboardCharges > 0) {
            consumeHoverboard(game)
            continue
          }
          finishRun(game)
          break
        }

        game.objects = game.objects.filter((object) => !object.collected && object.z - object.length / 2 < PLAYER_Z + 20)
        if (coinsThisFrame > 0) {
          gameAudio.play('coin', 1, 0.95 + Math.min(coinsThisFrame, 6) * 0.04)
        }

        if (statusRef.current === 'running') {
          const platforms = game.objects.filter((object) => object.kind === 'platform')
          const wasGrounded = game.grounded
          const fallSpeed = game.velocityY
          if (stepPlayer(game, delta, platforms).wallHit) {
            if (game.hoverboardCharges > 0 || game.invulnerableRemaining > 0) {
              if (game.hoverboardCharges > 0) {
                consumeHoverboard(game)
              }
              game.y = platformTopAt(platforms, game.lane, PLAYER_Z)
              game.velocityY = 0
              game.grounded = true
            } else {
              finishRun(game)
            }
          }
          if (!wasGrounded && game.grounded && fallSpeed < -1.2 && statusRef.current === 'running') {
            gameAudio.play('land')
            sceneRef.current?.burst('land', laneX(game.lane), game.y, PLAYER_Z)
          }
        }

        if (statusRef.current === 'running') {
          game.spawnIn -= delta
          if (game.spawnIn <= 0) {
            spawnWave(game)
            game.spawnIn = Math.max(0.72, 1.8 - difficultyAt(game.distance) * 1.05) + Math.random() * 0.25
          }
          if (now - lastHudUpdate >= hudInterval) {
            setScore(Math.floor(game.score))
            setDistance(Math.floor(game.distance))
            setCoins(game.coins)
            setMultiplier(game.multiplier)
            setMagnetTime(game.magnetRemaining)
            setDoubleTime(game.doubleRemaining)
            setSneakerTime(game.sneakersRemaining)
            setBoardCharge(game.hoverboardCharges)
            const nextCity = cityAtScore(game.score)
            if (nextCity.id !== cityRef.current) {
              cityRef.current = nextCity.id
              setCityBanner({ id: nextCity.id, name: nextCity.name })
              gameAudio.play('city')
              triggerFlash('city', 700)
              if (cityTimer.current) window.clearTimeout(cityTimer.current)
              cityTimer.current = window.setTimeout(() => setCityBanner(null), 3_400)
            }
            lastHudUpdate = now
          }
        }
      }

      // The 3D scene only needs to repaint while the run moves or when a
      // resize/visibility change requested a fresh frame. Idle, paused and
      // finished states keep the last frame behind the overlay.
      if (statusRef.current === 'running' || pendingRender) {
        activeScene.render({
          lane: game.lane,
          elapsed: game.elapsed,
          distance: game.distance,
          y: game.y,
          velocityY: game.velocityY,
          sliding: game.slideRemaining > 0,
          grounded: game.grounded,
          objects: game.objects,
          powerups: {
            magnet: game.magnetRemaining > 0,
            double: game.doubleRemaining > 0,
            sneakers: game.sneakersRemaining > 0,
            hoverboard: game.hoverboardCharges > 0,
          },
          cityId: cityAtScore(game.score).id,
          pickup: game.pickupRemaining > 0 && game.pickupKind
            ? { kind: game.pickupKind, progress: 1 - game.pickupRemaining / 1 }
            : null,
          reducedMotion,
        })
        pendingRender = false
      }
      frame = requestAnimationFrame(render)
    }

    void import('./runnerScene').then(async ({ createRunnerScene }) => {
      if (disposed) return
      try {
        const created = await createRunnerScene(canvas, creature, { formId })
        if (disposed) {
          created.dispose()
          return
        }
        scene = created
        sceneRef.current = created
        setRenderError(null)
      } catch (error) {
        setRenderError(error instanceof Error ? error.message : String(error))
        return
      }
      motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
      reducedMotion = motionPreference.matches
      updateMotionPreference = (event) => { reducedMotion = event.matches }
      motionPreference.addEventListener('change', updateMotionPreference)
      pendingRender = true
      frame = requestAnimationFrame(render)
    }).catch((error: unknown) => {
      if (!disposed) setRenderError(error instanceof Error ? error.message : String(error))
    })

    const requestRender = () => { pendingRender = true }
    window.addEventListener('resize', requestRender)
    window.addEventListener('orientationchange', requestRender)

    return () => {
      disposed = true
      window.removeEventListener('resize', requestRender)
      window.removeEventListener('orientationchange', requestRender)
      cancelAnimationFrame(frame)
      if (motionPreference && updateMotionPreference) {
        motionPreference.removeEventListener('change', updateMotionPreference)
      }
      scene?.dispose()
      sceneRef.current = null
    }
  }, [creature, formId])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (statusRef.current === 'running' || statusRef.current === 'paused')) {
        const nextStatus = statusRef.current === 'running' ? 'paused' : 'running'
        statusRef.current = nextStatus
        setStatus(nextStatus)
        gameAudio.play('click')
        return
      }
      if (statusRef.current !== 'running') return

      const game = gameRef.current
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        game.lane = Math.max(0, game.lane - 1)
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        game.lane = Math.min(2, game.lane + 1)
      } else if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W' || event.code === 'Space') {
        event.preventDefault()
        if (jump(game, game.sneakersRemaining > 0 ? 1.35 : 1)) gameAudio.play('jump')
      } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault()
        if (slide(game)) gameAudio.play('slide')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const start = () => {
    if (renderError) return
    void gameAudio.unlock()
    gameAudio.play('select')
    gameRef.current = initialGame()
    statusRef.current = 'running'
    setScore(0)
    setDistance(0)
    setCoins(0)
    setMultiplier(1)
    setMagnetTime(0)
    setDoubleTime(0)
    setSneakerTime(0)
    setBoardCharge(0)
    setPowerupNotice(null)
    cityRef.current = 'pallet'
    setCityBanner({ id: 'pallet', name: 'Pallet Town' })
    if (cityTimer.current) window.clearTimeout(cityTimer.current)
    cityTimer.current = window.setTimeout(() => setCityBanner(null), 3_400)
    setStatus('running')
  }

  const resume = () => {
    void gameAudio.unlock()
    gameAudio.play('select')
    statusRef.current = 'running'
    setStatus('running')
  }

  const triggerAction = (action: 'jump' | 'slide') => {
    if (statusRef.current !== 'running') return
    const game = gameRef.current
    if (action === 'jump') {
      if (jump(game, game.sneakersRemaining > 0 ? 1.35 : 1)) gameAudio.play('jump')
    } else if (slide(game)) {
      gameAudio.play('slide')
    }
  }

  const toggleMute = () => {
    if (!muted && volume === 0) {
      setVolume(60)
      gameAudio.setVolume(0.6)
      gameAudio.play('click')
      return
    }
    const nextMuted = gameAudio.toggleMuted()
    setMuted(nextMuted)
    if (!nextMuted) {
      if (volume === 0) {
        setVolume(60)
        gameAudio.setVolume(0.6)
      }
      void gameAudio.unlock()
      gameAudio.play('click')
    }
  }

  const changeVolume = (nextVolume: number) => {
    setVolume(nextVolume)
    gameAudio.setVolume(nextVolume / 100)
  }

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (statusRef.current !== 'running') return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gameRef.current.pointer = { x: event.clientX, y: event.clientY }
  }

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const origin = gameRef.current.pointer
    gameRef.current.pointer = null
    if (!origin || statusRef.current !== 'running') return
    const distanceX = event.clientX - origin.x
    const distanceY = event.clientY - origin.y
    if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) <= 26) return

    if (Math.abs(distanceX) > Math.abs(distanceY)) {
      gameRef.current.lane = Math.max(0, Math.min(2, gameRef.current.lane + (distanceX < 0 ? -1 : 1)))
    } else {
      triggerAction(distanceY < 0 ? 'jump' : 'slide')
    }
  }

  const displayMultiplier = multiplier * (doubleTime > 0 ? 2 : 1)
  const hasPowerup = magnetTime > 0 || doubleTime > 0 || sneakerTime > 0 || boardCharge > 0
  const ballIcon = (kind: PowerupKind) => `${import.meta.env.BASE_URL}game/ui/${POWERUP_BALL_ICONS[kind]}.png`
  const soundIsOff = muted || volume === 0
  const soundLabel = muted ? 'Unmute game sounds' : volume === 0 ? 'Restore game volume' : 'Mute game sounds'
  const speedOpacity = status === 'running' ? Math.min(0.7, Math.max(0, (speedAt(distance) - 16) / 14) * 0.7) : 0

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <div className="hud-score">
          <span className="hud-label"><PixelText text="SCORE" /></span>
          <div className="hud-score-line">
            <strong><PixelText text={numberFormatter.format(score)} scale={2} /></strong>
            <span key={displayMultiplier} className={`score-multiplier${doubleTime > 0 ? ' is-boosted' : ''}`}><PixelText text={`×${displayMultiplier}`} /></span>
            <small className="hud-distance"><PixelText text={`${numberFormatter.format(distance)} M`} /></small>
          </div>
        </div>
        <div className="hud-creature"><span className="status-dot" /><PixelText text={formName} /></div>
        <div><span className="hud-label"><PixelText text="COINS" /></span><strong key={coins} className="coin-value"><PixelText text={coins.toString()} scale={2} /></strong></div>
      </div>
      <div className="canvas-shell">
        <canvas
          ref={canvasRef}
          width={960}
          height={480}
          aria-label="Three-lane 3D meadow run. Use left and right to change lanes, Space or Up to jump onto trains and over logs, and Down to slide under vines. Swipe in any direction on touch screens."
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { gameRef.current.pointer = null }}
        />
        {status === 'running' && speedOpacity > 0 && <div className="speed-lines" style={{ opacity: speedOpacity }} aria-hidden="true" />}
        {flash && <div key={flash.id} className={`screen-flash screen-flash-${flash.kind}`} aria-hidden="true" />}
        {status === 'running' && hasPowerup && (
          <div className="powerup-row" aria-live="polite">
            {magnetTime > 0 && <span className="powerup-pill powerup-magnet"><img className="powerup-ball-icon" src={ballIcon('magnet')} alt="" /><PixelText text={`POKÉ BALL ${Math.ceil(magnetTime)}S`} /></span>}
            {doubleTime > 0 && <span className="powerup-pill powerup-double"><img className="powerup-ball-icon" src={ballIcon('double')} alt="" /><PixelText text={`GREAT BALL ${Math.ceil(doubleTime)}S`} /></span>}
            {sneakerTime > 0 && <span className="powerup-pill powerup-sneakers"><img className="powerup-ball-icon" src={ballIcon('sneakers')} alt="" /><PixelText text={`ULTRA BALL ${Math.ceil(sneakerTime)}S`} /></span>}
            {boardCharge > 0 && <span className="powerup-pill powerup-hoverboard"><img className="powerup-ball-icon" src={ballIcon('hoverboard')} alt="" /><PixelText text={`MASTER BALL ${boardCharge}`} /></span>}
          </div>
        )}
        {status === 'running' && cityBanner && (
          <div key={cityBanner.id} className="city-banner">
            <small><PixelText text="NOW ENTERING" /></small>
            <PixelText text={cityBanner.name} scale={2} />
          </div>
        )}
        {status === 'running' && powerupNotice && (
          <div key={`${powerupNotice}-${noticeSeq}`} className={`powerup-banner powerup-banner-${powerupNotice}`}>
            <img className="powerup-ball-icon powerup-ball-icon-lg" src={ballIcon(powerupNotice)} alt="" />
            <PixelText text={`${POWERUP_LABELS[powerupNotice]}!`} />
          </div>
        )}
        {(status !== 'running' || renderError) && (
          <div className="game-overlay">
            <div className={`overlay-card overlay-${status}${renderError ? ' overlay-error' : ''}`}>
              <span className="eyebrow"><PixelText text={renderError ? '3D SCENE UNAVAILABLE' : status === 'finished' ? 'TRAIL COMPLETE' : status === 'paused' ? 'PAUSED' : 'READY WHEN YOU ARE'} /></span>
              <h2><PixelText text={renderError ? 'Could not start the run' : status === 'finished' ? 'What a trail!' : status === 'paused' ? 'Take a breath' : 'Chase the multiplier'} scale={2} /></h2>
              <p>
                {renderError
                  ? `The 3D scene could not be initialized: ${renderError}`
                  : status === 'finished'
                    ? `You scored ${numberFormatter.format(score)} points over ${numberFormatter.format(distance)} m with a ×${multiplier} multiplier and collected ${coins} coins.`
                    : status === 'paused'
                      ? 'Your run is paused. Jump back in when you are ready.'
                      : 'The trail speeds up and the score multiplier climbs. Ride trains, clear logs, slide under vines, and grab Poké Ball power-ups.'}
              </p>
              {!renderError && (
                <Button className="overlay-primary" appearance="primary" icon={<PlayRegular />} onClick={status === 'paused' ? resume : start}>
                  {status === 'finished' ? 'Run again' : status === 'paused' ? 'Resume run' : 'Start running'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="game-controls">
        <span><kbd>←</kbd> / A</span>
        <span>LANES</span>
        <span>D / <kbd>→</kbd></span>
        {status === 'running' && (
          <>
            <Button appearance="subtle" className="action-button" icon={<ArrowUpRegular />} onClick={() => triggerAction('jump')}>
              Jump <span className="key-hint">· Space</span>
            </Button>
            <Button appearance="subtle" className="action-button" icon={<ArrowDownRegular />} onClick={() => triggerAction('slide')}>
              Slide <span className="key-hint">· ↓</span>
            </Button>
            <Button appearance="subtle" className="pause-button" icon={<PauseRegular />} onClick={() => {
              gameAudio.play('click')
              statusRef.current = 'paused'
              setStatus('paused')
            }}>Pause <span className="key-hint">· Esc</span></Button>
          </>
        )}
        <div className="sound-control">
          <Button
            appearance="subtle"
            className="sound-button"
            icon={soundIsOff ? <SpeakerMuteRegular /> : <Speaker2Regular />}
            onClick={toggleMute}
            aria-label={soundLabel}
            title={soundLabel}
          />
          <input
            type="range"
            className="volume-slider"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            onPointerUp={() => gameAudio.play('select', 0.7)}
            aria-label="Sound volume"
            title={`Volume ${volume}%`}
          />
          <span className="volume-value">{volume}%</span>
        </div>
      </div>
      <span className="sr-only">
        Swipe up to jump onto trains and over logs, swipe down to slide under vines, and swipe sideways to change lanes.
        The score multiplier increases with distance, and coins on train roofs only count while you ride them.
      </span>
    </div>
  )
}
