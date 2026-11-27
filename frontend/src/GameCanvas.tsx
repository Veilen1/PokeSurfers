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
  PLAYER_Z,
  POINTS_PER_METER,
  clearsBarrier,
  coinInReach,
  createPlayerState,
  jump,
  laneChangeBlocked,
  multiplierAt,
  passesBranch,
  platformTopAt,
  slide,
  speedAt,
  stepPlayerFrame,
  type PlayerState,
} from './runnerMechanics'
import type { PowerupKind, RunnerObject, RunnerScene } from './runnerScene'
import { planWave } from './runnerWaves'
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
    && object.z + object.length / 2 > -70
    && object.z - object.length / 2 < 12)
}

/** Moves one lane unless that lane currently holds a platform the runner
 * cannot mount from its current height. */
function moveLane(game: GameState, direction: number): void {
  const target = Math.max(0, Math.min(2, game.lane + direction))
  if (target === game.lane) return
  const platforms = game.objects.filter((object) => object.kind === 'platform')
  if (laneChangeBlocked(game, platforms, target)) return
  game.lane = target
}

function spawnWave(game: GameState): void {
  // Pattern selection, safe-lane guarantees and next-wave timing live in
  // runnerWaves.ts so they can be tested without Three.js.
  const freeLanes = LANES.filter((lane) => !laneBusy(game, lane))
  const plan = planWave(game.distance, freeLanes, Math.random)
  for (const object of plan.objects) addObject(game, object)
  game.spawnIn = plan.delay
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
  const [cityBanner, setCityBanner] = useState<{ id: string; name: string; landmark: string } | null>(null)
  const [powerupNotice, setPowerupNotice] = useState<PowerupKind | null>(null)
  const [noticeSeq, setNoticeSeq] = useState(0)
  const [muted, setMuted] = useState(() => gameAudio.isMuted)
  const [volume, setVolume] = useState(() => Math.round(gameAudio.volume * 100))
  const [flash, setFlash] = useState<{ kind: FlashKind; id: number } | null>(null)
  const sceneRef = useRef<RunnerScene | null>(null)
  const flashTimer = useRef<number | undefined>(undefined)
  const cityRef = useRef('littleroot')
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
                const canMount = !game.grounded && game.y >= object.height - MOUNT_TOLERANCE - 1e-6
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
          if (stepPlayerFrame(game, delta, platforms).wallHit) {
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
          if (game.spawnIn <= 0) spawnWave(game)
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
              setCityBanner({ id: nextCity.id, name: nextCity.name, landmark: nextCity.landmark })
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
        moveLane(game, -1)
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        moveLane(game, 1)
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
    const openingCity = cityAtScore(0)
    cityRef.current = openingCity.id
    setCityBanner({ id: openingCity.id, name: openingCity.name, landmark: openingCity.landmark })
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
      moveLane(gameRef.current, distanceX < 0 ? -1 : 1)
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
            <small><PixelText text="ENTRANDO A" /></small>
            <PixelText text={cityBanner.name} scale={2} />
            <span className="city-landmark"><PixelText text={cityBanner.landmark} /></span>
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
