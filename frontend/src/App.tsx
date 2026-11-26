import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactElement, type ReactNode } from 'react'
import {
  Avatar,
  Button,
  Card,
  CardFooter,
  CardHeader,
  Divider,
  Field,
  FluentProvider,
  Input,
  Spinner,
  Tab,
  TabList,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Toolbar,
  createDarkTheme,
  type BrandVariants,
} from '@fluentui/react-components'
import {
  ArrowLeftRegular,
  ArrowRightRegular,
  CheckmarkCircleRegular,
  CoinMultipleRegular,
  LeafOneRegular,
  LockClosedRegular,
  PlayRegular,
  ShoppingBagRegular,
  SignOutRegular,
  SparkleRegular,
  TrophyRegular,
} from '@fluentui/react-icons'
import { api, liveClient, setApiClient } from './api'
import { detectBackend } from './api/detect'
import { createGuestClient } from './guest/guestClient'
import type { Credentials, Creature, LeaderboardEntry, PlayerProfile, RunResult } from '@trailkin/shared'
import GameCanvas from './GameCanvas'
import { drawSpriteFrame, loadCreatureSprite, spriteFrame, type CreatureSprite } from './creatureSprites'
import { drawPixelCreature } from './pixelCreatures'
import './App.css'

type Profile = PlayerProfile
type Leader = LeaderboardEntry
type RunReport = RunResult

const primary = '#53D8CF'
const brandRamp = {
  10: '#071226', 20: '#0A1B31', 30: '#0D2941', 40: '#10364E',
  50: '#164A60', 60: '#1D6470', 70: '#25848A', 80: '#35A9A9',
  90: '#46C5BD', 100: '#53D8CF', 110: '#77E4D9', 120: '#9CECE2',
  130: '#B9F2EA', 140: '#D1F7F1', 150: '#E4FBF7', 160: '#F3FDFC',
} as BrandVariants
const theme = {
  ...createDarkTheme(brandRamp),
  colorNeutralBackground1: '#0A1428',
  colorNeutralBackground2: '#101D34',
  colorNeutralBackground3: '#172744',
  colorNeutralBackground4: '#1D3150',
  colorNeutralForeground1: '#F0F7FF',
  colorNeutralForeground2: '#AFC2D8',
  colorNeutralStroke1: '#2B4160',
  colorNeutralStroke2: '#223650',
  colorBrandBackground: primary,
  colorBrandBackgroundHover: '#77E4D9',
  colorBrandForeground1: primary,
  fontFamilyBase: 'system-ui, -apple-system, "Segoe UI", sans-serif',
}

const donationUrl = import.meta.env.VITE_DONATION_URL?.trim()
const donationLink = donationUrl ? new URL(donationUrl) : undefined
if (donationLink && donationLink.protocol !== 'https:') {
  throw new Error('VITE_DONATION_URL must use HTTPS.')
}

type Route = '/' | '/creatures' | '/market' | '/leaderboard' | '/login' | '/create-account'
type LoadState = 'loading' | 'error' | 'empty' | 'data'
type Connection = 'checking' | 'online' | 'guest'

const uiAsset = (name: string) => `${import.meta.env.BASE_URL ?? '/'}game/ui/${name}.png`

function RouteIcon({ name }: { name: string }) {
  return <img className="nav-icon" src={uiAsset(name)} alt="" />
}

const routeTabs: { value: Route; label: string; icon: ReactElement }[] = [
  { value: '/', label: 'Game', icon: <RouteIcon name="icon-shoes" /> },
  { value: '/creatures', label: 'Pokemons', icon: <RouteIcon name="icon-pokeball" /> },
  { value: '/market', label: 'Shop', icon: <RouteIcon name="icon-potion" /> },
  { value: '/leaderboard', label: 'Rankings', icon: <RouteIcon name="icon-kings-rock" /> },
]

function routeFromPath(path: string): Route {
  if (path === '/creatures' || path === '/market' || path === '/leaderboard' || path === '/login' || path === '/create-account') return path
  return '/'
}

function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname))
  useEffect(() => {
    const updateRoute = () => setRoute(routeFromPath(window.location.pathname))
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])
  const navigate = useCallback((nextRoute: Route) => {
    if (window.location.pathname !== nextRoute) window.history.pushState({}, '', nextRoute)
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  return [route, navigate]
}

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

const numberFormatter = new Intl.NumberFormat('en-US')

function CreaturePortrait({ creature, formId, large = false }: { creature: Creature; formId?: string; large?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loaded, setLoaded] = useState<{ formId: string; sprite: CreatureSprite | null } | null>(null)
  const resolvedFormId = formId ?? creature.forms[0]?.id ?? creature.id
  const sprite = loaded?.formId === resolvedFormId ? loaded.sprite : null

  useEffect(() => {
    let active = true
    void loadCreatureSprite(resolvedFormId).then((next) => {
      if (active) setLoaded({ formId: resolvedFormId, sprite: next })
    })
    return () => { active = false }
  }, [resolvedFormId])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let startedAt = 0
    let lastPaint = 0

    const paint = (elapsed: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = 'rgba(4, 14, 26, .32)'
      context.beginPath()
      context.ellipse(canvas.width / 2, canvas.height * 0.9, canvas.width * 0.19, canvas.height * 0.045, 0, 0, Math.PI * 2)
      context.fill()
      if (sprite) {
        drawSpriteFrame(
          context,
          spriteFrame(sprite, 'front', elapsed),
          canvas.width / 2,
          canvas.height * 0.9,
          canvas.width * 0.92,
          canvas.height * 0.8,
          sprite.anchors.front,
        )
      } else {
        drawPixelCreature(context, creature, canvas.width / 2, canvas.height / 2, canvas.width * 0.88)
      }
    }

    const animate = (now: number) => {
      if (startedAt === 0) startedAt = now
      // The walk cycle only changes 10 times per second; repainting it at 60 fps
      // just burns battery on phones.
      const due = motion.matches ? lastPaint === 0 : now - lastPaint >= 90
      if (!document.hidden && due) {
        paint(motion.matches ? 0 : (now - startedAt) / 1_000)
        lastPaint = now
      }
      if (!motion.matches) frame = requestAnimationFrame(animate)
    }
    const restart = () => {
      cancelAnimationFrame(frame)
      startedAt = 0
      lastPaint = 0
      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    motion.addEventListener('change', restart)
    return () => {
      cancelAnimationFrame(frame)
      motion.removeEventListener('change', restart)
    }
  }, [creature, sprite])

  return (
    <div
      className={`creature-portrait motif-${creature.motif}${large ? ' creature-portrait-large' : ''}`}
      style={{ '--creature-light': creature.palette.light } as CSSProperties}
      role="img"
      aria-label={`${creature.name}, ${creature.element} Pokémon`}
    >
      <canvas ref={canvasRef} width={160} height={160} aria-hidden="true" />
    </div>
  )
}

function StatePanel({ state, onRetry, label }: { state: LoadState; onRetry: () => void; label: string }) {
  if (state === 'data') return null
  const isError = state === 'error'
  const isEmpty = state === 'empty'
  return (
    <Card className={`state-panel ${isError ? 'state-error' : ''}`} role={isError ? 'alert' : 'status'}>
      {state === 'loading' ? <Spinner size="small" /> : <SparkleRegular fontSize={22} />}
      <div>
        <Text weight="semibold">{isError ? `${label} couldn’t load` : isEmpty ? `No ${label.toLowerCase()} yet` : `Finding ${label.toLowerCase()}…`}</Text>
        <Text className="muted-copy">
          {isError ? 'The trail is having a quiet moment. Check your connection and try again.' : isEmpty ? 'There’s nothing to show here just yet. Check back after your next run.' : 'Gathering the latest trail details.'}
        </Text>
      </div>
      {isError && <Button appearance="secondary" onClick={onRetry}>Try again</Button>}
    </Card>
  )
}

function AccountPage({
  initialRoute,
  onComplete,
  navigate,
}: {
  initialRoute: Route
  onComplete: (profile: Profile) => void
  navigate: (route: Route) => void
}) {
  const isCreate = initialRoute === '/create-account'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const credentials: Credentials = { username: username.trim(), password }
      onComplete(isCreate ? await api.createAccount(credentials) : await api.login(credentials))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="account-layout">
      <Card className="account-art">
        <div className="brand-lockup"><span className="brand-glyph"><LeafOneRegular /></span><span>POKE <small>SURFERS</small></span></div>
        <div className="account-promise">
          <Text className="eyebrow">A LITTLE WILD, A LOT YOURS</Text>
          <h1>Find your rhythm <em>in the wild.</em></h1>
          <p>Run the evergreen circuit, make a friend, and let every mile grow into a story.</p>
        </div>
        <div className="account-scene" aria-hidden="true">
          <span className="scene-orb orb-one" /><span className="scene-orb orb-two" /><span className="scene-orb orb-three" />
          <div className="scene-track"><i /><i /><i /></div>
          <div className="scene-creature"><img src={`${import.meta.env.BASE_URL}game/sprites/bulbasaur/front/front_00.png`} alt="" /></div>
        </div>
        <Text className="account-foot">ORIGINAL WORLD · EARNED REWARDS ONLY</Text>
      </Card>
      <Card className="account-form-card">
        <Button appearance="subtle" icon={<ArrowLeftRegular />} onClick={() => navigate('/')}>Back to the trail</Button>
        <div className="account-form-heading">
          <Text className="eyebrow">{isCreate ? 'YOUR NEXT ADVENTURE' : 'WELCOME BACK'}</Text>
          <h2>{isCreate ? 'Create your account' : 'Sign in to PokeSurfers'}</h2>
          <p>Use a username and password to keep your progress together.</p>
        </div>
        <div className="account-switch" aria-label="Account options">
          <Button appearance={isCreate ? 'primary' : 'secondary'} onClick={() => navigate('/create-account')}>Create account</Button>
          <Button appearance={!isCreate ? 'primary' : 'secondary'} onClick={() => navigate('/login')}>Sign in</Button>
        </div>
        <form className="account-form" onSubmit={(event) => void submit(event)}>
          <Field label="Username" required validationState={username && !/^[A-Za-z0-9_]{3,20}$/.test(username) ? 'error' : 'none'} validationMessage={username && !/^[A-Za-z0-9_]{3,20}$/.test(username) ? 'Use 3–20 letters, numbers, or underscores.' : undefined}>
            <Input autoComplete="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" required value={username} onChange={(_, data) => setUsername(data.value)} placeholder="trailrunner_42" />
          </Field>
          <Field
            label="Password"
            required
            validationState="warning"
            validationMessage="No email is required, so password recovery isn’t available. Choose one you’ll remember."
          >
            <Input autoComplete={isCreate ? 'new-password' : 'current-password'} type="password" minLength={8} maxLength={72} required value={password} onChange={(_, data) => setPassword(data.value)} placeholder="At least 8 characters" />
          </Field>
          {error && <Text role="alert" className="form-error">{error}</Text>}
          <Button type="submit" appearance="primary" size="large" icon={isCreate ? <SparkleRegular /> : <ArrowRightRegular />} disabled={busy}>
            {busy ? 'One moment…' : isCreate ? 'Create your free account' : 'Sign in and play'}
          </Button>
        </form>
        <Divider />
        <Text className="account-note"><LockClosedRegular /> Your username is public on the global leaderboard. PokeSurfers has no real-money purchases; voluntary donations never grant in-game benefits.</Text>
      </Card>
    </main>
  )
}

function App() {
  const [route, navigate] = useRoute()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [creatures, setCreatures] = useState<Creature[]>([])
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [creatureState, setCreatureState] = useState<LoadState>('loading')
  const [leaderState, setLeaderState] = useState<LoadState>('loading')
  const [profileLoading, setProfileLoading] = useState(true)
  const [connection, setConnection] = useState<Connection>('checking')
  const [connecting, setConnecting] = useState(false)
  const [notice, setNotice] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const [lastRun, setLastRun] = useState<RunReport | null>(null)
  const goTo = useCallback((nextRoute: Route) => {
    setNotice('')
    navigate(nextRoute)
  }, [navigate])

  const refreshCreatures = useCallback(async () => {
    setCreatureState('loading')
    try {
      const result = await api.listCreatures()
      setCreatures(result)
      setCreatureState(result.length === 0 ? 'empty' : 'data')
    } catch {
      setCreatureState('error')
    }
  }, [])

  const refreshLeaders = useCallback(async () => {
    try {
      const result = await api.getLeaderboard()
      setLeaders(result)
      setLeaderState(result.length === 0 ? 'empty' : 'data')
    } catch {
      setLeaderState('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    void (async () => {
      const online = await detectBackend()
      if (!active) return
      const client = online ? liveClient : createGuestClient()
      setApiClient(client)
      setConnection(online ? 'online' : 'guest')
      const initialPath = window.location.pathname
      if (!online && (initialPath === '/login' || initialPath === '/create-account')) {
        goTo('/')
        setNotice('Accounts need the PokeSurfers server. You are playing as a guest, and your progress is saved in this browser.')
      }

      const [profileResult, creaturesResult] = await Promise.allSettled([
        client.getCurrentProfile(),
        client.listCreatures(),
      ])
      if (!active) return

      setProfile(profileResult.status === 'fulfilled' ? profileResult.value : null)
      if (creaturesResult.status === 'fulfilled') {
        const nextCreatures = creaturesResult.value
        setCreatures(nextCreatures)
        setCreatureState(nextCreatures.length === 0 ? 'empty' : 'data')
      } else {
        setCreatureState('error')
      }
      setProfileLoading(false)
    })()
    return () => { active = false }
  }, [goTo])

  useEffect(() => {
    if (route !== '/leaderboard' || !profile) return
    const timer = window.setTimeout(() => { void refreshLeaders() }, 0)
    return () => window.clearTimeout(timer)
  }, [route, profile, refreshLeaders])

  const selectedCreature = useMemo(() => {
    if (creatures.length === 0) return undefined
    return creatures.find((creature) => creature.id === profile?.selectedCreatureId)
      ?? creatures.find((creature) => profile?.unlockedCreatureIds.includes(creature.id))
      ?? creatures[0]
  }, [creatures, profile])
  const selectedProgress = profile && selectedCreature
    ? profile.progress[selectedCreature.id] ?? { xp: 0, level: 1 }
    : { xp: 0, level: 1 }
  const selectedForm = selectedCreature?.forms.find((form) => form.id === profile?.selectedFormId) ?? selectedCreature?.forms[0]
  const authRoute = route === '/login' || route === '/create-account'
  // Guests have no account to sign in to, so auth URLs fall back to the trail.
  const pageRoute: Route = connection === 'guest' && authRoute ? '/' : route

  const handleProfile = (nextProfile: Profile) => {
    setProfile(nextProfile)
    setLastRun(null)
    void refreshCreatures()
    goTo('/')
  }

  const handleLogout = async () => {
    await api.logout()
    setProfile(null)
    goTo('/login')
  }

  const handleConnect = async () => {
    if (connecting) return
    setConnecting(true)
    setNotice('')
    try {
      if (!(await detectBackend())) {
        setNotice('No PokeSurfers server found. You are still playing as a guest.')
        return
      }
      setApiClient(liveClient)
      const next = await liveClient.getCurrentProfile()
      setConnection('online')
      setProfile(next)
      setLastRun(null)
      if (next) {
        setNotice(`Connected as ${next.displayName}.`)
        void refreshCreatures()
      } else {
        goTo('/login')
      }
    } catch (error) {
      setApiClient(createGuestClient())
      setConnection('guest')
      setNotice(error instanceof Error ? error.message : 'Could not reach the PokeSurfers server.')
    } finally {
      setConnecting(false)
    }
  }

  const handleSelectCreature = async (creature: Creature, formId: string) => {
    setBusyKey(`${creature.id}:${formId}`)
    setNotice('')
    try {
      setProfile(await api.selectCreature(creature.id, formId))
      setNotice(`${creature.forms.find((form) => form.id === formId)?.name ?? creature.name} is ready for the trail.`)
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not change your Pokémon.')
    } finally {
      setBusyKey('')
    }
  }

  const handlePurchase = async (creature: Creature) => {
    setBusyKey(creature.id)
    setNotice('')
    try {
      setProfile(await api.purchaseCreature(creature.id))
      setNotice(`${creature.name} joined your team.`)
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not unlock this Pokémon.')
    } finally {
      setBusyKey('')
    }
  }

  const handleRunEnd = async (result: { score: number; durationMs: number; collectedCoins: number }) => {
    if (!profile) return
    try {
      const creatureId = creatures.find((creature) => creature.id === profile.selectedCreatureId)?.id
        ?? creatures.find((creature) => profile.unlockedCreatureIds.includes(creature.id))?.id
        ?? profile.selectedCreatureId
      const saved = await api.submitRun({ ...result, creatureId })
      setLastRun(saved.run)
      setProfile(saved.profile)
      setNotice(`Trail saved · +${saved.run.coinsEarned} coins · +${saved.run.xpEarned} XP`)
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Could not save your run.')
    }
  }

  if (profileLoading) {
    return <FluentProvider theme={theme}><main className="boot-screen"><Spinner label="Preparing your trail…" /></main></FluentProvider>
  }

  if (authRoute && connection !== 'guest') {
    return <FluentProvider theme={theme}><AccountPage initialRoute={route} onComplete={handleProfile} navigate={goTo} /></FluentProvider>
  }

  if (!profile) {
    return <FluentProvider theme={theme}><AccountPage initialRoute="/login" onComplete={handleProfile} navigate={goTo} /></FluentProvider>
  }

  return (
    <FluentProvider theme={theme}>
      <div className="app-shell">
        <header className="app-header">
          <Toolbar className="header-toolbar" aria-label="PokeSurfers">
            <button type="button" className="wordmark" onClick={() => goTo('/')} aria-label="PokeSurfers home">
              <span className="brand-glyph"><LeafOneRegular /></span><span>POKE <small>SURFERS</small></span>
            </button>
            <div className="header-spacer" />
            <div className="header-account">
              <span className="coin-balance"><CoinMultipleRegular />{profile.coins} <small>coins</small></span>
              <Avatar name={profile.displayName} size={32} color="brand" />
              <span className="username-label">{profile.displayName}</span>
              {connection === 'guest' ? (
                <Button appearance="subtle" className="account-link account-connect" disabled={connecting} onClick={() => void handleConnect()}>
                  {connecting ? 'Looking for server…' : 'Connect account'}
                </Button>
              ) : (
                <>
                  <Button appearance="subtle" className="account-link account-create" onClick={() => goTo('/create-account')}>Create account</Button>
                  <Button appearance="subtle" icon={<SignOutRegular />} aria-label="Sign out" title="Sign out" onClick={() => void handleLogout()} />
                </>
              )}
            </div>
          </Toolbar>
        </header>

        <nav className="primary-nav" aria-label="Main navigation">
          <TabList selectedValue={pageRoute} onTabSelect={(_, data) => goTo(data.value as Route)}>
            {routeTabs.map((tab) => <Tab key={tab.value} value={tab.value} icon={tab.icon}>{tab.label}</Tab>)}
          </TabList>
        </nav>

        <main className="page-main">
          {connection === 'guest' && (
            <div className="guest-banner" role="status">
              <img className="guest-ball" src={uiAsset('icon-pokeball')} alt="" />
              <div>
                <Text weight="semibold">Guest mode</Text>
                <Text className="muted-copy">Progress and unlocks are saved in this browser.</Text>
              </div>
            </div>
          )}
          {notice && <Card className="notice-card" role="status"><CheckmarkCircleRegular /><Text>{notice}</Text><Button appearance="subtle" onClick={() => setNotice('')}>Dismiss</Button></Card>}

          {pageRoute === '/' && selectedCreature && selectedForm && (
            <GamePage
              profile={profile}
              creature={selectedCreature}
              formId={selectedForm.id}
              formName={selectedForm.name}
              level={selectedProgress.level}
              lastRun={lastRun}
              onRunEnd={handleRunEnd}
              onOpenCreatures={() => goTo('/creatures')}
            />
          )}
          {pageRoute === '/' && (!selectedCreature || !selectedForm) && (
            <section className="content-page">
              <PageIntro eyebrow="EVERGREEN CIRCUIT" title={<>Your next <em>trail awaits.</em></>} description="Your Pokémon is taking a moment to find the path." />
              <StatePanel state={creatureState} onRetry={() => void refreshCreatures()} label="Pokémon" />
            </section>
          )}

          {pageRoute === '/creatures' && (
            <CreaturesPage
              state={creatureState}
              creatures={creatures}
              profile={profile}
              busyKey={busyKey}
              onRetry={() => void refreshCreatures()}
              onSelect={(creature, formId) => void handleSelectCreature(creature, formId)}
              onNavigate={goTo}
            />
          )}

          {pageRoute === '/market' && (
            <MarketPage
              state={creatureState}
              creatures={creatures}
              profile={profile}
              busyKey={busyKey}
              onRetry={() => void refreshCreatures()}
              onPurchase={(creature) => void handlePurchase(creature)}
            />
          )}

          {pageRoute === '/leaderboard' && (
            <RankingsPage
              state={leaderState}
              leaders={leaders}
              creatures={creatures}
              profile={profile}
              guest={connection === 'guest'}
              onRetry={() => { setLeaderState('loading'); void refreshLeaders() }}
            />
          )}
        </main>
      </div>
    </FluentProvider>
  )
}

function GamePage({
  profile, creature, formId, formName, level, lastRun, onRunEnd, onOpenCreatures,
}: {
  profile: Profile
  creature: Creature
  formId: string
  formName: string
  level: number
  lastRun: RunReport | null
  onRunEnd: (result: { score: number; durationMs: number; collectedCoins: number }) => void
  onOpenCreatures: () => void
}) {
  return (
    <div className="game-page">
      <section className="game-hero">
        <div className="game-hero-copy">
          <Text className="eyebrow">POKESURFERS · SUNNY MEADOW</Text>
          <h1>Ride the <em>sunny trail.</em></h1>
          <p>Dash through the meadow with {creature.name}. Every run brings a new little spark.</p>
          <span className="hero-ready"><i /> YOUR POKÉMON IS READY</span>
        </div>
        <div className="hero-companion" aria-hidden="true">
          <span className="hero-moon" />
          <span className="hero-waterline waterline-one" />
          <span className="hero-waterline waterline-two" />
          <CreaturePortrait creature={creature} formId={formId} large />
          <span className="hero-companion-name">{formName}</span>
        </div>
      </section>

      <section className="game-stats" aria-label="Player and trail summary">
        <Card className="stat-card"><Text className="stat-label"><TrophyRegular /> TRAIL XP</Text><strong>{formatNumber(profile.progress[creature.id]?.xp ?? 0)}</strong><small>Earned with this Pokémon</small></Card>
        <Card className="stat-card"><Text className="stat-label"><CoinMultipleRegular /> TRAIL COINS</Text><strong>{profile.coins}</strong><small>Earned by running</small></Card>
        <Card className="stat-card"><Text className="stat-label"><img className="inline-sprite" src={uiAsset('icon-pokeball')} alt="" /> POKÉMON</Text><strong>{formName}</strong><small>Level {level} · {creature.element}</small></Card>
      </section>

      <section className="runner-section">
        <div className="section-heading">
          <div><Text className="eyebrow">THE MEADOW IS CALLING</Text><h2>Your next run</h2></div>
          <span className="section-hint">Three lanes · endless trail</span>
        </div>
        <div className="game-layout">
          <div className="runner-column">
            <GameCanvas
              creature={creature}
              formId={formId}
              formName={formName}
              onRunEnd={onRunEnd}
            />
            {lastRun && <Card className="last-run-card"><SparkleRegular /><div><Text weight="semibold">Last trail saved</Text><Text>{formatNumber(lastRun.score)} points · +{lastRun.coinsEarned} coins · +{lastRun.xpEarned} XP</Text></div></Card>}
          </div>
          <aside className="runner-aside">
            <Card className="companion-card">
              <CardHeader header={<Text className="eyebrow">YOUR POKÉMON</Text>} />
              <CreaturePortrait creature={creature} formId={formId} large />
              <Text className="companion-name">{formName}</Text>
              <Text className="muted-copy">{creature.name} · {creature.element} Pokémon</Text>
              <div className="level-row"><span>Level {level}</span><span>{profile.progress[creature.id]?.xp ?? 0} XP</span></div>
              <div className="xp-track"><span style={{ width: `${Math.min(100, (profile.progress[creature.id]?.xp ?? 0) % 100)}%` }} /></div>
              <Button appearance="secondary" icon={<img className="button-sprite" src={uiAsset('icon-pokeball')} alt="" />} onClick={onOpenCreatures}>Change Pokémon</Button>
            </Card>
            <Card className="controls-card">
              <Text className="eyebrow">HOW TO PLAY</Text>
              <p><kbd>←</kbd><kbd>→</kbd> or <kbd>A</kbd><kbd>D</kbd> change lanes</p>
              <p><kbd>Space</kbd> / <kbd>↑</kbd> jump · <kbd>↓</kbd> slide</p>
              <p className="muted-copy">Swipe or use the on-screen buttons. Jump onto long platforms or over logs, slide under vines, and grab every coin. Floating orbs grant the coin magnet, ×2 score, super sneakers, or a hoverboard that saves you from one crash. Tall stone towers can only be reached with Super Sneakers or by jumping from a lower platform.</p>
            </Card>
          </aside>
        </div>
      </section>
    </div>
  )
}

function CreaturesPage({
  state, creatures, profile, busyKey, onRetry, onSelect, onNavigate,
}: {
  state: LoadState
  creatures: Creature[]
  profile: Profile
  busyKey: string
  onRetry: () => void
  onSelect: (creature: Creature, formId: string) => void
  onNavigate: (route: Route) => void
}) {
  return (
    <section className="content-page">
      <PageIntro icon="icon-pokeball" eyebrow="YOUR POKÉMON" title={<>Small friends, <em>big legends.</em></>} description="Review your Pokémon, their growing forms, and who's ready to join you on the trail." />
      <StatePanel state={state} onRetry={onRetry} label="Creatures" />
      {state === 'data' && (
        <div className="creature-grid">
          {creatures.map((creature) => {
            const unlocked = profile.unlockedCreatureIds.includes(creature.id)
            const progress = profile.progress[creature.id] ?? { xp: 0, level: 1 }
            const active = profile.selectedCreatureId === creature.id
            const equippedForm = active ? profile.selectedFormId : creature.forms.filter((form) => form.unlockLevel <= progress.level).at(-1)?.id ?? creature.forms[0].id
            return (
              <Card key={creature.id} className={`creature-card ${active ? 'is-selected' : ''} ${!unlocked ? 'is-locked' : ''}`}>
                <div className="creature-card-art"><CreaturePortrait creature={creature} formId={equippedForm} large /><span className="element-pill">{creature.element}</span></div>
                <CardHeader header={<Text size={500} weight="semibold">{creature.name}</Text>} description={`${unlocked ? `Level ${progress.level} · ${progress.xp} XP` : 'Not discovered yet'}`} />
                <div className="creature-card-body">
                  <Text className="form-caption">EVOLUTION FORMS</Text>
                  <div className="form-list">{creature.forms.map((form) => {
                    const formUnlocked = unlocked && form.unlockLevel <= progress.level
                    return <Button key={form.id} size="small" appearance={equippedForm === form.id && active ? 'primary' : 'secondary'} disabled={!formUnlocked || busyKey === `${creature.id}:${form.id}`} onClick={() => onSelect(creature, form.id)}>
                      {formUnlocked ? form.name : <><LockClosedRegular /> {form.name} · Lv {form.unlockLevel}</>}
                    </Button>
                  })}</div>
                </div>
                <CardFooter>{active ? <span className="status-positive"><CheckmarkCircleRegular /> Active Pokémon</span> : unlocked ? <span className="status-neutral">Ready to select</span> : <span className="status-neutral">Adopt in the shop</span>}</CardFooter>
              </Card>
            )
          })}
        </div>
      )}
      <div className="page-action"><Button appearance="primary" icon={<PlayRegular />} onClick={() => onNavigate('/')}>Back to the trail</Button></div>
    </section>
  )
}

function MarketPage({
  state, creatures, profile, busyKey, onRetry, onPurchase,
}: {
  state: LoadState
  creatures: Creature[]
  profile: Profile
  busyKey: string
  onRetry: () => void
  onPurchase: (creature: Creature) => void
}) {
  const offers = creatures.filter((creature) => !creature.starter)
  return (
    <section className="content-page">
      <PageIntro icon="icon-potion" eyebrow="POKÉ MART" title={<>Find your next <em>Pokémon.</em></>} description="Meet new Pokémon, then bring their unlockable forms to life on the run." />
      <Card className="market-note"><CoinMultipleRegular /><div><Text weight="semibold">Your coins are earned on the trail</Text><Text className="muted-copy">Every Pokémon is unlocked with in-game coins. There are no real-money purchases.</Text></div><strong>{profile.coins} coins</strong></Card>
      <Card className="donation-note">
        <SparkleRegular />
        <div>
          <Text weight="semibold">Keep the trail free for everyone</Text>
          <Text className="muted-copy">Optional donations, if enabled, support the project outside the game and never unlock creatures, currency, cosmetics, or gameplay benefits.</Text>
        </div>
        {donationLink
          ? <Button as="a" href={donationLink.href} target="_blank" rel="noopener noreferrer" appearance="secondary">Support PokeSurfers</Button>
          : <Text className="donation-status">Donation link not set up yet</Text>}
      </Card>
      <StatePanel state={state} onRetry={onRetry} label="Pokémon" />
      {state === 'data' && <div className="market-grid">
        {offers.map((creature) => {
          const unlocked = profile.unlockedCreatureIds.includes(creature.id)
          const progressionUnlock = creature.id === 'swablu'
          return (
            <Card key={creature.id} className="market-card">
              <div className="market-art"><CreaturePortrait creature={creature} large /><span className="element-pill">{creature.element}</span></div>
              <CardHeader header={<Text size={500} weight="semibold">{creature.name}</Text>} description={progressionUnlock ? 'A cloud-born friend, found through progression.' : `${creature.element} trail Pokémon`} />
              <div className="market-details">
                <div><span>UNLOCK</span><strong>{progressionUnlock ? 'Reach level 6' : `${creature.price} coins`}</strong></div>
                <div><span>FORMS</span><strong>{creature.forms.length} to discover</strong></div>
              </div>
              <CardFooter>
                {unlocked
                  ? <Button appearance="secondary" icon={<CheckmarkCircleRegular />} disabled>In your team</Button>
                  : progressionUnlock
                    ? <Button appearance="secondary" disabled icon={<LockClosedRegular />}>Unlock by running</Button>
                    : <Button appearance="primary" icon={<ShoppingBagRegular />} disabled={busyKey === creature.id || profile.coins < creature.price} onClick={() => onPurchase(creature)}>
                      {profile.coins < creature.price ? `Need ${creature.price - profile.coins} more` : `Adopt · ${creature.price} coins`}
                    </Button>}
              </CardFooter>
            </Card>
          )
        })}
      </div>}
    </section>
  )
}

function RankingsPage({
  state, leaders, creatures, profile, guest, onRetry,
}: {
  state: LoadState
  leaders: Leader[]
  creatures: Creature[]
  profile: Profile
  guest: boolean
  onRetry: () => void
}) {
  return (
    <section className="content-page rankings-page">
      <PageIntro
        icon="icon-kings-rock"
        eyebrow="EVERY RUN LEAVES A MARK"
        title={<>The fastest <em>trails.</em></>}
        description={guest
          ? 'Your best runs are stored on this device. Connect the PokeSurfers server to join the global leaderboard.'
          : 'See the runners who found their rhythm, and the Pokémon that carried them.'}
      />
      <div className="section-heading"><div><Text className="eyebrow">{guest ? 'SAVED IN THIS BROWSER' : 'GLOBAL STANDINGS'}</Text><h2>Leaderboard</h2></div><span className="section-hint">{guest ? 'Your personal best' : 'Best verified scores'}</span></div>
      <StatePanel state={state} onRetry={onRetry} label="Rankings" />
      {state === 'data' && <Card className="leaderboard-card">
        <div className="table-scroll">
          <Table aria-label={guest ? 'Guest personal best' : 'Global PokeSurfers leaderboard'}>
            <TableHeader><TableRow><TableHeaderCell>Rank</TableHeaderCell><TableHeaderCell>Runner</TableHeaderCell><TableHeaderCell>Best score</TableHeaderCell><TableHeaderCell>Creature form</TableHeaderCell></TableRow></TableHeader>
            <TableBody>{leaders.map((leader, index) => {
              const isYou = leader.player === profile.displayName
              const creatureName = creatures.find((creature) => creature.id === leader.creatureId)?.name ?? leader.creatureId
              return <TableRow key={leader.player} className={isYou ? 'leader-you' : ''}>
                <TableCell><span className={`rank-chip ${index < 3 ? `rank-${index + 1}` : ''}`}>#{leader.rank}{isYou ? ' · You' : ''}</span></TableCell>
                <TableCell><span className="runner-name"><Avatar name={leader.player} size={28} color={isYou ? 'brand' : 'neutral'} />{leader.player}</span></TableCell>
                <TableCell><strong>{formatNumber(leader.bestScore)}</strong></TableCell>
                <TableCell><span className="form-chip">{creatureName}</span></TableCell>
              </TableRow>
            })}</TableBody>
          </Table>
        </div>
      </Card>}
      <Card className="rankings-footnote"><img className="inline-sprite" src={uiAsset('icon-kings-rock')} alt="" /><Text>{guest ? 'Guest scores stay in this browser. Connect an account to compete globally.' : 'Scores are earned in-game. Keep running to move up the trail.'}</Text></Card>
    </section>
  )
}

function PageIntro({ eyebrow, title, description, icon }: { eyebrow: string; title: ReactNode; description: string; icon?: string }) {
  return (
    <header className={`page-intro${icon ? ' page-intro-icon' : ''}`}>
      {icon && <img className="page-icon" src={uiAsset(icon)} alt="" />}
      <div>
        <Text className="eyebrow">{eyebrow}</Text>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  )
}

export default App
