import { ICON_DATA_URLS } from '../assets/iconDataUrls'

const ROOT_ID = 'highton-github-widget-root'
const STORAGE_KEY = 'highton_pet_state_v2'
const COLLAPSE_KEY = 'highton_widget_collapsed'

type Mood = 'GOOD' | 'NORMAL' | 'BAD'
type SimEvent = 'COMMIT' | 'PULL_REQUEST' | 'REVIEW'
type QuestKey = 'commit1' | 'pr1' | 'review1'

type DailyCounts = {
  commit: number
  pr: number
  review: number
}

type QuestState = {
  key: QuestKey
  claimed: boolean
}

type LogItem = {
  at: number
  text: string
}

type PetState = {
  coins: number
  exp: number
  mood: Mood
  lastCommitAt: number
  dayKey: string
  counts: DailyCounts
  quests: QuestState[]
  logs: LogItem[]
}

const DEBUG = false

const EXP_PER_LEVEL = 100
const LEVELS_PER_TIER = 3
const TIERS = [{ key: 'Newbie' }, { key: 'Junior' }, { key: 'Mid' }, { key: 'Senior' }] as const
const MAX_LEVEL_INDEX = TIERS.length * LEVELS_PER_TIER - 1
const MAX_TOTAL_EXP = (MAX_LEVEL_INDEX + 1) * EXP_PER_LEVEL

const COMMIT_COOLDOWN_MS = 60_000
const FEED_COST = 10
const FEED_EXP = 10
const GITHUB_POLL_MS = 30_000
const GITHUB_DETECTION_KEY = 'highton_github_detection_v1'
const MAX_SEEN_EVENT_IDS = 120
const INITIAL_SYNC_REWARD_COUNT = 1

type GithubEventName = 'PushEvent' | 'PullRequestEvent' | 'PullRequestReviewEvent'

type GithubEventPayload = {
  action?: unknown
}

type GithubEventActor = {
  login?: unknown
}

type GithubRawEvent = {
  id?: unknown
  type?: unknown
  actor?: unknown
  payload?: unknown
}

type GithubEvent = {
  id: string
  type: GithubEventName
  actorLogin: string
  payload: GithubEventPayload
}

type GithubDetectionState = {
  initialized: boolean
  user: string
  seenIds: string[]
}

const QUESTS: Record<QuestKey, { title: string; rewardCoins: number }> = {
  commit1: { title: 'commit 1회 하기', rewardCoins: 10 },
  pr1: { title: 'PR 1회 보내기', rewardCoins: 10 },
  review1: { title: 'Review 1회 하기', rewardCoins: 10 },
}

const EVENT_REWARDS: Record<SimEvent, { coins: number; exp: number; label: string }> = {
  COMMIT: { coins: 2, exp: 8, label: 'Commit' },
  PULL_REQUEST: { coins: 5, exp: 25, label: 'PR Open' },
  REVIEW: { coins: 3, exp: 15, label: 'Review' },
}

const getDayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DEFAULT_STATE = (): PetState => {
  const dayKey = getDayKey()
  return {
    coins: 360,
    exp: 0,
    mood: 'NORMAL',
    lastCommitAt: 0,
    dayKey,
    counts: { commit: 0, pr: 0, review: 0 },
    quests: [
      { key: 'commit1', claimed: false },
      { key: 'pr1', claimed: false },
      { key: 'review1', claimed: false },
    ],
    logs: [],
  }
}

const getMoodModifier = (mood: Mood) => {
  if (mood === 'GOOD') return 1.1
  if (mood === 'BAD') return 0.9
  return 1
}

const improveMood = (mood: Mood): Mood => {
  if (mood === 'BAD') return 'NORMAL'
  if (mood === 'NORMAL') return 'GOOD'
  return 'GOOD'
}

const clampExp = (exp: number) => {
  return Math.max(0, Math.min(MAX_TOTAL_EXP, exp))
}

const ensureToday = (state: PetState): PetState => {
  const today = getDayKey()
  if (state.dayKey === today) return state

  return {
    ...state,
    dayKey: today,
    counts: { commit: 0, pr: 0, review: 0 },
    quests: state.quests.map((q) => ({ ...q, claimed: false })),
  }
}

const isQuestCompleted = (state: PetState, key: QuestKey) => {
  if (key === 'commit1') return state.counts.commit >= 1
  if (key === 'pr1') return state.counts.pr >= 1
  return state.counts.review >= 1
}

const isQuestClaimed = (state: PetState, key: QuestKey) => {
  return state.quests.find((q) => q.key === key)?.claimed ?? false
}

const pushLog = (state: PetState, text: string): PetState => {
  const nextLogs: LogItem[] = [{ at: Date.now(), text }, ...state.logs].slice(0, 3)
  return { ...state, logs: nextLogs }
}

const getLevelInfo = (totalExp: number) => {
  const clampedTotal = clampExp(totalExp)
  const rawIndex = Math.floor(clampedTotal / EXP_PER_LEVEL)
  const levelIndex = Math.min(rawIndex, MAX_LEVEL_INDEX)
  const tierIndex = Math.min(Math.floor(levelIndex / LEVELS_PER_TIER), TIERS.length - 1)
  const subLevel = (levelIndex % LEVELS_PER_TIER) + 1
  const tier = TIERS[tierIndex]
  const isMaxed = totalExp >= MAX_TOTAL_EXP
  const expInLevel = isMaxed ? EXP_PER_LEVEL : clampedTotal % EXP_PER_LEVEL

  return {
    lv: `${tier.key}${subLevel}`,
    tierKey: tier.key,
    expInLevel,
    expMax: EXP_PER_LEVEL,
  }
}

const getPetAssetByTier = (tierKey: (typeof TIERS)[number]['key']) => {
  if (tierKey === 'Junior') return ICON_DATA_URLS.junior
  if (tierKey === 'Mid') return ICON_DATA_URLS.mid
  if (tierKey === 'Senior') return ICON_DATA_URLS.senior
  return ICON_DATA_URLS.newbie
}

const getGitHubUserLogin = () => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="user-login"]')
  const fromMeta = meta?.content?.trim()
  if (fromMeta) return fromMeta

  const bodyLogin = document.body?.getAttribute('data-logged-in-user')?.trim()
  if (bodyLogin) return bodyLogin

  return ''
}

const parseGithubEvent = (item: unknown): GithubEvent | null => {
  if (!item || typeof item !== 'object') return null

  const raw = item as GithubRawEvent
  const id = raw.id
  const type = raw.type
  const actor = raw.actor as GithubEventActor | undefined
  const actorLogin = actor?.login

  if (typeof id !== 'string') return null
  if (type !== 'PushEvent' && type !== 'PullRequestEvent' && type !== 'PullRequestReviewEvent') {
    return null
  }
  if (typeof actorLogin !== 'string') return null

  return {
    id,
    type,
    actorLogin,
    payload:
      raw.payload && typeof raw.payload === 'object' ? (raw.payload as GithubEventPayload) : {},
  }
}

const mapGithubEventToSimEvent = (event: GithubEvent): SimEvent | null => {
  if (event.type === 'PushEvent') return 'COMMIT'

  if (event.type === 'PullRequestEvent') {
    const action = event.payload.action
    if (action === 'opened') return 'PULL_REQUEST'
    return null
  }

  if (event.type === 'PullRequestReviewEvent') {
    return 'REVIEW'
  }

  return null
}

const loadDetectionState = async (): Promise<GithubDetectionState | null> => {
  const result = await chrome.storage.local.get([GITHUB_DETECTION_KEY])
  const raw = result[GITHUB_DETECTION_KEY] as unknown
  if (!raw || typeof raw !== 'object') return null

  const initialized = (raw as { initialized?: unknown }).initialized
  const user = (raw as { user?: unknown }).user
  const seenIdsRaw = (raw as { seenIds?: unknown }).seenIds

  if (typeof initialized !== 'boolean' || typeof user !== 'string' || !Array.isArray(seenIdsRaw)) {
    return null
  }

  const seenIds = seenIdsRaw
    .filter((x): x is string => typeof x === 'string')
    .slice(0, MAX_SEEN_EVENT_IDS)

  return { initialized, user, seenIds }
}

const saveDetectionState = async (state: GithubDetectionState): Promise<void> => {
  await chrome.storage.local.set({ [GITHUB_DETECTION_KEY]: state })
}

const fetchGitHubEvents = async (user: string): Promise<GithubEvent[]> => {
  const fetchEvents = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
      credentials: 'include',
    })

    if (!response.ok) return []
    const json = (await response.json()) as unknown
    if (!Array.isArray(json)) return []
    return json.map(parseGithubEvent).filter((x): x is GithubEvent => x !== null)
  }

  const primary = await fetchEvents(
    `https://api.github.com/users/${encodeURIComponent(user)}/events?per_page=30`,
  )
  if (primary.length > 0) return primary

  return fetchEvents(
    `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=30`,
  )
}

const applySimEventReward = async (
  eventType: SimEvent,
  options: { ignoreCommitCooldown: boolean; showToast: boolean; sourceLabel: string },
) => {
  const reward = EVENT_REWARDS[eventType]
  const prev = await loadState()
  const current = ensureToday(prev)
  const now = Date.now()

  if (
    eventType === 'COMMIT' &&
    !options.ignoreCommitCooldown &&
    now - current.lastCommitAt < COMMIT_COOLDOWN_MS
  ) {
    if (options.showToast) {
      toast('Commit 쿨다운(60s)')
    }
    return
  }

  const modifier = getMoodModifier(current.mood)
  const awardedExp = Math.round(reward.exp * modifier)

  const nextCounts: DailyCounts = {
    commit: current.counts.commit + (eventType === 'COMMIT' ? 1 : 0),
    pr: current.counts.pr + (eventType === 'PULL_REQUEST' ? 1 : 0),
    review: current.counts.review + (eventType === 'REVIEW' ? 1 : 0),
  }

  let next: PetState = {
    ...current,
    coins: Math.max(0, current.coins + reward.coins),
    exp: clampExp(current.exp + awardedExp),
    counts: nextCounts,
    lastCommitAt: eventType === 'COMMIT' ? now : current.lastCommitAt,
  }

  next = pushLog(
    next,
    `${options.sourceLabel}: ${reward.label} +${awardedExp} EXP +${reward.coins} coin`,
  )
  await saveState(next)
  renderState(next)

  if (options.showToast) {
    toast(`${reward.label} +${awardedExp} EXP`)
  }
}

const detectGitHubActivity = async () => {
  const login = getGitHubUserLogin()
  if (!login) return

  const allEvents = await fetchGitHubEvents(login)
  const relevant = allEvents.filter((event) => {
    if (event.actorLogin !== login) return false
    return mapGithubEventToSimEvent(event) !== null
  })

  if (relevant.length === 0) return

  const stored = await loadDetectionState()
  if (!stored || !stored.initialized || stored.user !== login) {
    const initialTargets = [...relevant].slice(0, INITIAL_SYNC_REWARD_COUNT).reverse()
    for (const event of initialTargets) {
      const mapped = mapGithubEventToSimEvent(event)
      if (!mapped) continue
      await applySimEventReward(mapped, {
        ignoreCommitCooldown: true,
        showToast: true,
        sourceLabel: 'GitHub',
      })
    }

    await saveDetectionState({
      initialized: true,
      user: login,
      seenIds: relevant.map((event) => event.id).slice(0, MAX_SEEN_EVENT_IDS),
    })
    return
  }

  const unseen = relevant.filter((event) => !stored.seenIds.includes(event.id))
  const chronological = [...unseen].reverse()

  for (const event of chronological) {
    const mapped = mapGithubEventToSimEvent(event)
    if (!mapped) continue
    await applySimEventReward(mapped, {
      ignoreCommitCooldown: true,
      showToast: true,
      sourceLabel: 'GitHub',
    })
  }

  const nextSeenIds = [...new Set([...relevant.map((event) => event.id), ...stored.seenIds])].slice(
    0,
    MAX_SEEN_EVENT_IDS,
  )
  await saveDetectionState({
    initialized: true,
    user: login,
    seenIds: nextSeenIds,
  })
}

let githubDetectionIntervalId: number | null = null
let githubDetectionRunning = false

const runGitHubDetection = async () => {
  if (githubDetectionRunning) return
  githubDetectionRunning = true
  try {
    await detectGitHubActivity()
  } finally {
    githubDetectionRunning = false
  }
}

const handleVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return
  void runGitHubDetection()
}

const handleWindowFocus = () => {
  void runGitHubDetection()
}

const startGitHubDetection = () => {
  if (githubDetectionIntervalId !== null) return

  void runGitHubDetection()
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleWindowFocus)

  githubDetectionIntervalId = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return
    void runGitHubDetection()
  }, GITHUB_POLL_MS)
}

const stopGitHubDetection = () => {
  if (githubDetectionIntervalId === null) return
  window.clearInterval(githubDetectionIntervalId)
  githubDetectionIntervalId = null
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleWindowFocus)
}

const loadState = async (): Promise<PetState> => {
  const result = await chrome.storage.local.get([STORAGE_KEY])
  const raw = result[STORAGE_KEY] as unknown
  if (!raw || typeof raw !== 'object') {
    const s = DEFAULT_STATE()
    await chrome.storage.local.set({ [STORAGE_KEY]: s })
    return s
  }

  const coins = (raw as { coins?: unknown }).coins
  const exp = (raw as { exp?: unknown }).exp
  if (typeof coins !== 'number' || typeof exp !== 'number') {
    const s = DEFAULT_STATE()
    await chrome.storage.local.set({ [STORAGE_KEY]: s })
    return s
  }

  const moodRaw = (raw as { mood?: unknown }).mood
  const mood: Mood =
    moodRaw === 'GOOD' || moodRaw === 'NORMAL' || moodRaw === 'BAD' ? moodRaw : 'NORMAL'

  const lastCommitAt = (raw as { lastCommitAt?: unknown }).lastCommitAt
  const dayKeyRaw = (raw as { dayKey?: unknown }).dayKey

  const countsRaw = (raw as { counts?: unknown }).counts
  const counts: DailyCounts =
    countsRaw &&
    typeof countsRaw === 'object' &&
    typeof (countsRaw as { commit?: unknown }).commit === 'number' &&
    typeof (countsRaw as { pr?: unknown }).pr === 'number' &&
    typeof (countsRaw as { review?: unknown }).review === 'number'
      ? {
          commit: (countsRaw as DailyCounts).commit,
          pr: (countsRaw as DailyCounts).pr,
          review: (countsRaw as DailyCounts).review,
        }
      : { commit: 0, pr: 0, review: 0 }

  const questsRaw = (raw as { quests?: unknown }).quests
  const questsArr: QuestState[] = Array.isArray(questsRaw)
    ? questsRaw
        .filter(
          (q): q is QuestState =>
            !!q &&
            typeof q === 'object' &&
            ((q as { key?: unknown }).key === 'commit1' ||
              (q as { key?: unknown }).key === 'pr1' ||
              (q as { key?: unknown }).key === 'review1') &&
            typeof (q as { claimed?: unknown }).claimed === 'boolean',
        )
        .slice(0, 3)
    : []

  const quests: QuestState[] = (['commit1', 'pr1', 'review1'] as const).map((key) => ({
    key,
    claimed: questsArr.find((q) => q.key === key)?.claimed ?? false,
  }))

  const logsRaw = (raw as { logs?: unknown }).logs
  const logs: LogItem[] = Array.isArray(logsRaw)
    ? logsRaw
        .filter(
          (x): x is LogItem =>
            !!x &&
            typeof x === 'object' &&
            typeof (x as { at?: unknown }).at === 'number' &&
            typeof (x as { text?: unknown }).text === 'string',
        )
        .slice(0, 3)
    : []

  const state: PetState = {
    coins,
    exp: clampExp(exp),
    mood,
    lastCommitAt: typeof lastCommitAt === 'number' ? lastCommitAt : 0,
    dayKey: typeof dayKeyRaw === 'string' ? dayKeyRaw : getDayKey(),
    counts,
    quests,
    logs,
  }

  const normalized = ensureToday(state)
  if (normalized !== state) {
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized })
  }

  return normalized
}

const saveState = async (state: PetState): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

const getMounted = () => {
  const root = document.getElementById(ROOT_ID)
  const shadow = root?.shadowRoot
  if (!shadow) return null
  const panel = shadow.querySelector<HTMLElement>('[data-highton="panel"]')
  if (!panel) return null
  return { root, shadow, panel }
}

const toast = (text: string) => {
  const mounted = getMounted()
  if (!mounted) return
  const el = mounted.shadow.querySelector<HTMLElement>('[data-highton="toast"]')
  if (!el) return
  el.textContent = text
  el.setAttribute('data-open', '1')
  window.setTimeout(() => el.removeAttribute('data-open'), 1400)
}

const renderState = (state: PetState) => {
  const mounted = getMounted()
  if (!mounted) return

  const normalized = ensureToday(state)
  const info = getLevelInfo(normalized.exp)
  const percent = Math.max(0, Math.min(100, (info.expInLevel / info.expMax) * 100))

  const coins = mounted.shadow.querySelector<HTMLElement>('[data-highton="coins"]')
  const lv = mounted.shadow.querySelector<HTMLElement>('[data-highton="lv"]')
  const expText = mounted.shadow.querySelector<HTMLElement>('[data-highton="expText"]')
  const fill = mounted.shadow.querySelector<HTMLElement>('[data-highton="fill"]')
  const bar = mounted.shadow.querySelector<HTMLElement>('[data-highton="bar"]')
  const petImage = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="petImage"]')

  if (coins) coins.textContent = String(normalized.coins)
  if (lv) lv.textContent = `LV. ${info.lv}`
  if (expText) expText.textContent = `${info.expInLevel} / ${info.expMax}`
  if (fill) fill.style.width = `${percent}%`
  if (bar) bar.setAttribute('aria-valuenow', String(info.expInLevel))
  if (petImage) {
    petImage.src = getPetAssetByTier(info.tierKey)
    petImage.alt = `${info.tierKey} pet`
  }

  const applyQuestRow = (key: QuestKey) => {
    const row = mounted.shadow.querySelector<HTMLElement>(`[data-highton="q_${key}"]`)
    if (!row) return
    const title = row.querySelector<HTMLElement>('[data-highton="q_title"]')
    const reward = row.querySelector<HTMLElement>('[data-highton="q_reward"]')
    const claim = row.querySelector<HTMLButtonElement>('[data-highton="q_claim"]')

    const done = isQuestCompleted(normalized, key)
    const claimed = isQuestClaimed(normalized, key)

    if (title) title.textContent = QUESTS[key].title
    if (reward) reward.textContent = String(QUESTS[key].rewardCoins)
    if (claim) {
      claim.disabled = !done || claimed
      claim.textContent = claimed ? '완료' : '받기'
    }
  }

  applyQuestRow('commit1')
  applyQuestRow('pr1')
  applyQuestRow('review1')
}

const mountWidget = () => {
  if (document.getElementById(ROOT_ID)) return
  if (!document.body) return

  const root = document.createElement('div')
  root.id = ROOT_ID
  document.body.appendChild(root)

  const shadow = root.attachShadow({ mode: 'open' })

  const headerHeight = document.querySelector('header')?.getBoundingClientRect().height
  const topOffset = typeof headerHeight === 'number' && headerHeight > 0 ? headerHeight + 12 : 16

  const style = document.createElement('style')
  style.textContent = `
    :host {
      all: initial;

      --frame-bg: rgba(34, 34, 34, 0.62);
      --frame-border: rgba(47, 47, 47, 0.58);
      --text: #ffffff;
      --muted: rgba(255, 255, 255, 0.6);
      --accent: #ff9d00;
      --accent-bg: rgba(255, 157, 0, 0.5);
      --disabled-bg: rgba(93, 93, 93, 0.2);
      --disabled-text: rgba(255, 255, 255, 0.2);
      --card-bg: rgba(34, 34, 34, 0.5);
      --card-bg-2: rgba(34, 34, 34, 0.7);
      --track: rgba(255, 255, 255, 0.12);
    }

    .frame {
      box-sizing: border-box;
      position: fixed;
      right: 16px;
      top: ${topOffset}px;
      width: 480px;
      height: 580px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      isolation: isolate;
      background: var(--frame-bg);
      border: 0;
      border-radius: 8px;
      backdrop-filter: blur(18px);
      z-index: 2147483647;
      color: var(--text);
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial,
        sans-serif;
    }

    .frame.collapsed {
      height: 420px;
    }

    .frame.collapsed .quests {
      display: none;
    }

    .stage {
      box-sizing: border-box;
      width: 432px;
      height: 360px;
      padding: 16px 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 24px;
      border: 0;
      border-radius: 8px;
      background:
        linear-gradient(0deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.08)),
        url('${ICON_DATA_URLS.background}') center / cover no-repeat;
      position: relative;
      overflow: hidden;
    }

    .stageInner {
      width: 360px;
      height: 360px;
      display: grid;
      place-items: center;
      position: relative;
    }

    .pet {
      width: 280px;
      height: 280px;
      border-radius: 0;
      background: transparent;
      border: 0;
      display: grid;
      place-items: center;
      overflow: visible;
    }

    .petImage {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .coinPill {
      box-sizing: border-box;
      position: absolute;
      right: 12px;
      top: 12px;
      width: 67px;
      height: 26px;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border: 1px solid var(--frame-border);
      border-radius: 8px;
      background: var(--card-bg-2);
    }

    .coinGlyph {
      position: relative;
      width: 16px;
      height: 16px;
      flex: none;
    }

    .coinGlyph::before {
      content: '';
      position: absolute;
      width: 10.37px;
      height: 13.81px;
      left: 0;
      top: 1px;
      border-radius: 999px;
      background: #ffc98c;
    }

    .coinGlyph::after {
      content: '';
      position: absolute;
      width: 10.61px;
      height: 13.66px;
      left: 5.39px;
      top: 3.34px;
      border-radius: 999px;
      background: #f5b66e;
    }

    .coinText {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      text-align: center;
    }

    .bagBtn {
      box-sizing: border-box;
      position: absolute;
      right: 12px;
      bottom: 12px;
      width: 36px;
      height: 36px;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid var(--frame-border);
      background: rgba(34, 34, 34, 0.5);
      backdrop-filter: blur(18px);
      display: grid;
      place-items: center;
      cursor: pointer;
    }

    .bagBtn:hover {
      filter: brightness(1.05);
    }

    .bagIcon {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .stageIcon {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .stageLeftBtn {
      box-sizing: border-box;
      position: absolute;
      left: 12px;
      bottom: 12px;
      width: 36px;
      height: 36px;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid var(--frame-border);
      background: rgba(34, 34, 34, 0.5);
      backdrop-filter: blur(18px);
      display: grid;
      place-items: center;
      cursor: pointer;
      color: #bbbbbb;
      font-weight: 900;
    }

    .stageLeftBtn:hover {
      filter: brightness(1.05);
    }

    .status {
      width: 432px;
      height: 22px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 24px;
    }

    .statusLeft {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 24px;
      flex: 1;
      min-width: 0;
    }

    .lv {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      width: 90px;
      text-align: left;
      white-space: nowrap;
    }

    .bar {
      box-sizing: border-box;
      height: 8px;
      flex: 1;
      border: 1px solid #ffffff;
      border-radius: 4px;
      background: transparent;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      width: 0%;
      background: #ffffff;
    }

    .expText {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      width: 56px;
      text-align: center;
      white-space: nowrap;
    }

    .feedBtn {
      box-sizing: border-box;
      height: 22px;
      padding: 4px 12px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      border-radius: 8px;
      background: var(--accent-bg);
      border: 1px solid var(--accent);
      backdrop-filter: blur(18px);
      cursor: pointer;
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      white-space: nowrap;
    }

    .feedBtn:disabled {
      background: rgba(93, 93, 93, 0.2);
      border: 1px solid rgba(93, 93, 93, 0.2);
      color: rgba(255, 255, 255, 0.2);
      cursor: not-allowed;
    }

    .quests {
      width: 432px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      flex: 1;
      min-height: 0;
    }

    .questList {
      width: 432px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: auto;
      padding-right: 6px;
    }

    .questList::-webkit-scrollbar {
      width: 4px;
    }

    .questList::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }

    .questRow {
      box-sizing: border-box;
      width: 424px;
      height: 38px;
      padding: 8px 12px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
      border-radius: 8px;
      background: var(--card-bg);
      border: 1px solid var(--frame-border);
      backdrop-filter: blur(18px);
    }

    .questTitle {
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      letter-spacing: -0.03em;
    }

    .questRight {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }

    .questReward {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      letter-spacing: -0.03em;
    }

    .questBtn {
      box-sizing: border-box;
      height: 22px;
      padding: 4px 12px;
      border-radius: 8px;
      border: 1px solid var(--accent);
      background: var(--accent-bg);
      backdrop-filter: blur(18px);
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      letter-spacing: -0.03em;
      cursor: pointer;
    }

    .questBtn:disabled {
      background: rgba(93, 93, 93, 0.2);
      border: 1px solid rgba(93, 93, 93, 0.2);
      color: rgba(255, 255, 255, 0.2);
      cursor: not-allowed;
    }

    .toast {
      box-sizing: border-box;
      position: absolute;
      left: 12px;
      bottom: 12px;
      max-width: 240px;
      padding: 8px 10px;
      border-radius: 8px;
      background: rgba(34, 34, 34, 0.7);
      border: 1px solid var(--frame-border);
      backdrop-filter: blur(18px);
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      opacity: 0;
      transform: translateY(6px);
      transition:
        opacity 140ms ease,
        transform 140ms ease;
      pointer-events: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toast[data-open='1'] {
      opacity: 1;
      transform: translateY(0);
    }

    @keyframes highton-enter {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `

  const panel = document.createElement('section')
  panel.className = 'frame'
  panel.setAttribute('data-highton', 'panel')
  panel.innerHTML = `
    <section class="stage" aria-label="stage" data-highton="toggle-area">
      <div class="stageInner">
        <div class="pet" aria-hidden="true">
          <img class="petImage" data-highton="petImage" src="${ICON_DATA_URLS.newbie}" alt="Newbie pet" />
        </div>
      </div>
      <div class="coinPill" aria-label="coins">
        <span class="coinGlyph" aria-hidden="true"></span>
        <span class="coinText" data-highton="coins">360</span>
      </div>
      <button class="bagBtn" type="button" data-highton="bag" aria-label="bag">
        <img class="bagIcon" src="${ICON_DATA_URLS.cart}" alt="" aria-hidden="true" />
      </button>
      <button class="stageLeftBtn" type="button" data-highton="collapse" aria-label="collapse">
        <img class="stageIcon" src="${ICON_DATA_URLS.game}" alt="" aria-hidden="true" />
      </button>
      <div class="toast" data-highton="toast"></div>
    </section>

    <section class="status" aria-label="status">
      <div class="statusLeft">
        <div class="lv" data-highton="lv">LV. Newbie1</div>
        <div class="bar" data-highton="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="fill" data-highton="fill" style="width: 0%"></div>
        </div>
        <div class="expText" data-highton="expText">0 / 100</div>
      </div>
      <button class="feedBtn" type="button" data-highton="feed">
        <span class="coinGlyph" aria-hidden="true"></span>
        <span data-highton="feedCost">${FEED_COST}</span>
        <span>밥주기</span>
      </button>
    </section>

    <section class="quests" aria-label="quests">
      <div class="questList">
        <div class="questRow" data-highton="q_commit1">
          <div class="questTitle" data-highton="q_title">${QUESTS.commit1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <span class="coinGlyph" aria-hidden="true"></span>
              <span data-highton="q_reward">${QUESTS.commit1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="commit1">받기</button>
          </div>
        </div>

        <div class="questRow" data-highton="q_pr1">
          <div class="questTitle" data-highton="q_title">${QUESTS.pr1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <span class="coinGlyph" aria-hidden="true"></span>
              <span data-highton="q_reward">${QUESTS.pr1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="pr1">받기</button>
          </div>
        </div>

        <div class="questRow" data-highton="q_review1">
          <div class="questTitle" data-highton="q_title">${QUESTS.review1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <span class="coinGlyph" aria-hidden="true"></span>
              <span data-highton="q_reward">${QUESTS.review1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="review1">받기</button>
          </div>
        </div>
      </div>
    </section>
  `

  shadow.append(style, panel)
}

const unmountWidget = () => {
  stopGitHubDetection()
  document.getElementById(ROOT_ID)?.remove()
}

const wireUi = async () => {
  const mounted = getMounted()
  if (!mounted) return

  const state = await loadState()
  renderState(state)
  startGitHubDetection()

  const applyCollapsed = (collapsed: boolean) => {
    mounted.panel.classList.toggle('collapsed', collapsed)
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      void 0
    }
  }

  try {
    applyCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1')
  } catch {
    void 0
  }

  const collapseBtn = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="collapse"]')
  collapseBtn?.addEventListener('click', () => {
    applyCollapsed(!mounted.panel.classList.contains('collapsed'))
  })

  const toggleArea = mounted.shadow.querySelector<HTMLElement>('[data-highton="toggle-area"]')
  toggleArea?.addEventListener('dblclick', () => {
    applyCollapsed(!mounted.panel.classList.contains('collapsed'))
  })

  const feedCost = mounted.shadow.querySelector<HTMLElement>('[data-highton="feedCost"]')
  if (feedCost) feedCost.textContent = String(FEED_COST)

  const feedButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="feed"]')
  feedButton?.addEventListener('click', () => {
    void (async () => {
      const prev = await loadState()
      const current = ensureToday(prev)
      if (current.coins < FEED_COST) {
        toast('코인이 부족해요')
        return
      }

      const next: PetState = {
        ...current,
        coins: current.coins - FEED_COST,
        exp: clampExp(current.exp + FEED_EXP),
        mood: improveMood(current.mood),
      }

      const withLog = pushLog(next, `Feed +${FEED_EXP} EXP -${FEED_COST} coin`)
      await saveState(withLog)
      renderState(withLog)
      toast(`밥 냠냠! +${FEED_EXP} EXP`)
    })()
  })

  const bagButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="bag"]')
  bagButton?.addEventListener('click', () => {
    toast('가방: 준비중')
  })

  const claimButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="q_claim"]',
  )
  claimButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-quest')
      if (key !== 'commit1' && key !== 'pr1' && key !== 'review1') return

      void (async () => {
        const prev = await loadState()
        const current = ensureToday(prev)

        if (!isQuestCompleted(current, key)) {
          toast('아직 조건을 달성하지 않았어요')
          return
        }

        if (isQuestClaimed(current, key)) {
          toast('이미 받았어요')
          return
        }

        const next: PetState = {
          ...current,
          coins: current.coins + QUESTS[key].rewardCoins,
          quests: current.quests.map((q) => (q.key === key ? { ...q, claimed: true } : q)),
        }

        const withLog = pushLog(next, `Quest claimed: ${key} +${QUESTS[key].rewardCoins} coin`)
        await saveState(withLog)
        renderState(withLog)
        toast('보상 받기 완료!')
      })()
    })
  })
}

const ensureMounted = () => {
  mountWidget()
  if (!document.getElementById(ROOT_ID)) return

  void wireUi()

  const observer = new MutationObserver(() => {
    if (!document.getElementById(ROOT_ID)) {
      observer.disconnect()
      return
    }

    void wireUi()
  })

  observer.observe(document.documentElement, { childList: true, subtree: true })
  window.setTimeout(() => observer.disconnect(), 2000)
}

ensureMounted()
document.addEventListener('turbo:load', ensureMounted)
document.addEventListener('DOMContentLoaded', ensureMounted)

chrome.runtime.onMessage.addListener((message) => {
  if (!message || typeof message !== 'object') return

  if (message.type === 'HIGHTON_TOGGLE_WIDGET') {
    if (document.getElementById(ROOT_ID)) {
      unmountWidget()
    } else {
      ensureMounted()
    }
  }

  if (message.type === 'HIGHTON_RESET_STATE') {
    void (async () => {
      const next = DEFAULT_STATE()
      await saveState(next)
      renderState(next)
      toast('초기화 완료')
    })()
  }

  if (message.type === 'HIGHTON_SIMULATE_EVENT') {
    const eventType = (message as { eventType?: unknown }).eventType
    if (eventType !== 'COMMIT' && eventType !== 'PULL_REQUEST' && eventType !== 'REVIEW') return

    void (async () => {
      await applySimEventReward(eventType, {
        ignoreCommitCooldown: false,
        showToast: true,
        sourceLabel: 'Simulated',
      })
    })()
  }
})

if (DEBUG) {
  console.log('[Highton] content script loaded:', window.location.href)
}
