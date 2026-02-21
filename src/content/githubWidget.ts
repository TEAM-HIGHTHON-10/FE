import { ICON_DATA_URLS } from '../assets/iconDataUrls'

const ROOT_ID = 'highton-github-widget-root'
const STORAGE_KEY = 'highton_pet_state_v2'
const MINIMIZE_KEY = 'highton_widget_minimized'
const POSITION_KEY = 'highton_widget_position'

type Mood = 'GOOD' | 'NORMAL' | 'BAD'
type SimEvent = 'COMMIT' | 'PULL_REQUEST' | 'REVIEW'
type QuestKey = 'commit1' | 'pr1' | 'review1'
type AccessoryKey = 'straw_hat'

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
  ownedItems: AccessoryKey[]
  equippedItem: AccessoryKey | null
}

type WidgetPosition = {
  left: number
  top: number
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
const TEST_COIN_AMOUNT = 200

const SHOP_ITEMS: Array<{ key: AccessoryKey; name: string; price: number }> = [
  { key: 'straw_hat', name: '밀짚모자', price: 100 },
]

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
    ownedItems: [],
    equippedItem: null,
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

const clampPosition = (
  left: number,
  top: number,
  width: number,
  height: number,
): WidgetPosition => {
  const margin = 8
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const maxTop = Math.max(margin, window.innerHeight - height - margin)

  return {
    left: Math.min(Math.max(left, margin), maxLeft),
    top: Math.min(Math.max(top, margin), maxTop),
  }
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

const formatCompactNumber = (value: number) => {
  const n = Math.max(0, Math.floor(value))
  if (n < 1000) return String(n)
  if (n < 1_000_000) {
    const k = n / 1000
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10
    return `${rounded}k`
  }
  const m = n / 1_000_000
  const rounded = m >= 10 ? Math.round(m) : Math.round(m * 10) / 10
  return `${rounded}m`
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
    lvLabel: `LV ${subLevel}. ${tier.key}`,
    tierKey: tier.key,
    subLevel,
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

type TierKey = (typeof TIERS)[number]['key']

type HatAnchor = {
  x: number
  y: number
  headRatio: number
  hatWidth: number
  toastGap: number
  toastNoHatGap: number
  miniX: number
  miniY: number
  miniHeadRatio: number
  miniHatWidth: number
}

const HAT_ANCHORS: Record<TierKey, HatAnchor> = {
  Newbie: {
    x: 3,
    y: 10,
    headRatio: 0.4,
    hatWidth: 55,
    toastGap: 10,
    toastNoHatGap: 42,
    miniX: 2,
    miniY: 5,
    miniHeadRatio: 0.42,
    miniHatWidth: 34,
  },
  Junior: {
    x: -5,
    y: 30,
    headRatio: 0.32,
    hatWidth: 55,
    toastGap: 10,
    toastNoHatGap: 20,
    miniX: -2,
    miniY: 10,
    miniHeadRatio: 0.36,
    miniHatWidth: 38,
  },
  Mid: {
    x: -10,
    y: 10,
    headRatio: 0.28,
    hatWidth: 100,
    toastGap: 20,
    toastNoHatGap: 60,
    miniX: -5,
    miniY: 1,
    miniHeadRatio: 0.32,
    miniHatWidth: 60,
  },
  Senior: {
    x: -25,
    y: 1,
    headRatio: 0.22,
    hatWidth: 130,
    toastGap: 15,
    toastNoHatGap: 70,
    miniX: -15,
    miniY: -5,
    miniHeadRatio: 0.26,
    miniHatWidth: 70,
  },
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const PET_TALKS: Record<TierKey, Record<Mood, string[]>> = {
  Newbie: {
    GOOD: [
      '웃어주셔서 저도 꼬리가 절로 흔들려요!',
      '오늘은 함께 있는 것만으로도 참 좋아요!',
      '햇살 좋은 날 같아서 마음이 따뜻해져요.',
      '눈을 마주치면 기분이 몽글몽글해져요.',
      '정말 잘하고 계세요. 오늘도 행복 스탬프 하나 찍어요!',
    ],
    NORMAL: [
      '괜찮아요. 천천히 하셔도 제가 옆에 있을게요.',
      '잠깐 숨 고르시고 제 머리도 한번 쓰다듬어주세요!',
      '우리 페이스대로 천천히 걸어가면 돼요.',
      '지금 이 순간도 충분히 소중해요.',
      '조용히 함께 있는 것만으로도 힘이 돼요.',
    ],
    BAD: [
      '오늘 마음이 무거우시면 제 곁에서 잠깐 쉬어가세요.',
      '괜찮아요. 당신의 속도는 언제나 옳아요.',
      '힘드시면 제가 먼저 꼭 안아드릴게요.',
      '천천히 하셔도 괜찮아요. 저는 기다릴 수 있어요.',
      '표정이 다시 밝아질 때까지 옆에 있을게요.',
    ],
  },
  Junior: {
    GOOD: [
      '함께 있으면 하루가 반짝반짝 빛나요!',
      '좋은 에너지가 느껴져서 저도 신나요!',
      '지금 분위기가 정말 포근하고 좋아요.',
      '작은 성취도 함께 기뻐하고 싶어요!',
      '오늘은 기분 좋은 바람이 부는 날 같아요!',
    ],
    NORMAL: [
      '저희 차분하게 하나씩 해보아요.',
      '서두르지 않으셔도 괜찮아요. 저는 늘 당신 편이에요.',
      '따뜻한 차 한 모금 같은 순간이에요.',
      '오늘도 우리만의 리듬으로 가보아요.',
      '평온해 보이시면 저도 행복해요.',
    ],
    BAD: [
      '괜찮아요. 오늘은 제가 마음을 지켜드릴게요.',
      '잠깐 눈 감고 쉬셔도 돼요. 저는 여기 있어요.',
      '흔들리는 날에는 더 천천히 걸으면 돼요.',
      '너무 애쓰지 않으셔도 돼요. 충분히 잘하고 계세요.',
      '힘드실 땐 제 이름을 한번 불러주세요.',
    ],
  },
  Mid: {
    GOOD: [
      '눈빛이 반짝여서 저도 덩달아 행복해요!',
      '오늘 모습이 정말 멋지고 따뜻해 보여요.',
      '지금 이 순간을 오래 기억하고 싶어요!',
      '함께 있는 시간이 큰 힘이 돼요.',
      '우리의 하루가 예쁘게 차곡차곡 쌓이고 있어요.',
    ],
    NORMAL: [
      '심호흡 한 번 하시고, 다시 함께 가요.',
      '하루에 작은 미소를 더해드릴게요.',
      '차분한 오늘도 충분히 아름다워요.',
      '곁을 지키는 게 제 가장 큰 일상이에요.',
      '함께라면 평범한 순간도 특별해져요.',
    ],
    BAD: [
      '마음이 지치실 땐 제 옆에 기대셔도 돼요.',
      '오늘은 버텨낸 것만으로도 충분해요.',
      '괜찮아질 때까지 조용히 기다릴게요.',
      '조금 울적해도 우리는 함께예요.',
      '힘드시면 잠깐 멈춰도 돼요. 저는 도망가지 않아요.',
    ],
  },
  Senior: {
    GOOD: [
      '함께해 주셔서 제 세상도 단단해져요.',
      '오늘 모습은 보는 것만으로도 힘이 돼요.',
      '함께 걸어온 시간들이 반짝이고 있어요.',
      '그 미소를 오래오래 지켜드리고 싶어요.',
      '지금처럼만 우리 행복하게 가요.',
    ],
    NORMAL: [
      '천천히, 그러나 따뜻하게. 그게 우리 방식이에요!',
      '편안해 보이시면 저도 마음이 놓여요.',
      '조용히 옆에 앉아 있는 지금이 참 좋아요.',
      '오늘도 충분히 멋진 하루예요.',
      '서두르지 않아도 충분히 잘 해내실 수 있어요.',
    ],
    BAD: [
      '지친 마음은 제가 살살 달래드릴게요.',
      '오늘은 아무것도 하지 않으셔도 괜찮아요.',
      '다시 웃으실 때까지 곁을 지킬게요.',
      '힘이 빠지실 땐 제 온기로 쉬어가세요.',
      '괜찮아요. 우리는 언제든 다시 시작할 수 있어요.',
    ],
  },
}

const pickRandom = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)]
}

const getPetTalkMessage = (state: PetState) => {
  const tierKey = getLevelInfo(state.exp).tierKey
  const moodLine = pickRandom(PET_TALKS[tierKey][state.mood])
  return moodLine
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

  const ownedItemsRaw = (raw as { ownedItems?: unknown }).ownedItems
  const ownedItems: AccessoryKey[] = Array.isArray(ownedItemsRaw)
    ? ownedItemsRaw.filter((x): x is AccessoryKey => x === 'straw_hat')
    : []

  const equippedItemRaw = (raw as { equippedItem?: unknown }).equippedItem
  const equippedItem: AccessoryKey | null =
    equippedItemRaw === 'straw_hat' && ownedItems.includes('straw_hat') ? equippedItemRaw : null

  const state: PetState = {
    coins,
    exp: clampExp(exp),
    mood,
    lastCommitAt: typeof lastCommitAt === 'number' ? lastCommitAt : 0,
    dayKey: typeof dayKeyRaw === 'string' ? dayKeyRaw : getDayKey(),
    counts,
    quests,
    logs,
    ownedItems,
    equippedItem,
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

let toastTimerId: number | null = null

const toast = (text: string) => {
  const mounted = getMounted()
  if (!mounted) return
  const el = mounted.shadow.querySelector<HTMLElement>('[data-highton="toast"]')
  if (!el) return

  if (toastTimerId !== null) {
    window.clearTimeout(toastTimerId)
    toastTimerId = null
  }

  el.textContent = text
  el.setAttribute('data-open', '1')
  toastTimerId = window.setTimeout(() => {
    el.removeAttribute('data-open')
    toastTimerId = null
  }, 2600)
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
  const petHat = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="petHat"]')
  const miniLv = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHoverLv"]')
  const miniCoins = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHoverCoins"]')
  const miniExp = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHoverExp"]')
  const miniPet = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="miniPet"]')
  const miniHat = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="miniHat"]')

  if (coins) coins.textContent = formatCompactNumber(normalized.coins)
  if (lv) lv.textContent = info.lvLabel
  if (expText) expText.textContent = `${info.expInLevel} / ${info.expMax}`
  if (fill) fill.style.width = `${percent}%`
  if (bar) bar.setAttribute('aria-valuenow', String(info.expInLevel))
  if (petImage) {
    petImage.src = getPetAssetByTier(info.tierKey)
    petImage.alt = `${info.tierKey} pet`
  }
  const stage = mounted.shadow.querySelector<HTMLElement>('[data-highton="toggle-area"]')
  const petTalkTarget = mounted.shadow.querySelector<HTMLElement>('[data-highton="petTalk"]')

  const updateStageAnchors = (attempt = 0) => {
    if (!stage || !petTalkTarget || !petImage) return

    const stageRect = stage.getBoundingClientRect()
    const petRect = petTalkTarget.getBoundingClientRect()
    const imgRect = petImage.getBoundingClientRect()

    if (stageRect.width <= 0 || petRect.width <= 0 || imgRect.width <= 0) {
      if (attempt < 8) {
        requestAnimationFrame(() => updateStageAnchors(attempt + 1))
      }
      return
    }

    const anchor = HAT_ANCHORS[info.tierKey]
    const equipped = normalized.equippedItem === 'straw_hat'
    const hatW = anchor.hatWidth
    const hatH = Math.round(hatW * 0.62)

    const headCenterX = imgRect.left - stageRect.left + imgRect.width / 2 + anchor.x
    const headTopY = imgRect.top - stageRect.top + imgRect.height * anchor.headRatio
    const toastTop = equipped ? headTopY - hatH - anchor.toastGap : headTopY - anchor.toastNoHatGap

    mounted.panel.style.setProperty('--toast-left', `${Math.round(headCenterX)}px`)
    mounted.panel.style.setProperty('--toast-top', `${Math.round(clamp(toastTop, 10, 130))}px`)

    if (!petHat) return

    if (!equipped) {
      petHat.style.display = 'none'
      return
    }

    const petLocalCenterX = imgRect.left - petRect.left + imgRect.width / 2 + anchor.x
    const headTopLocal = imgRect.top - petRect.top + imgRect.height * anchor.headRatio
    const petLocalTop = headTopLocal - hatH * 0.78 + anchor.y

    petHat.style.display = 'block'
    petHat.style.width = `${hatW}px`
    petHat.style.height = `${hatH}px`
    petHat.style.left = `${Math.round(petLocalCenterX)}px`
    petHat.style.top = `${Math.round(petLocalTop)}px`
    petHat.style.marginLeft = '0'
    petHat.style.transform = 'translate(-50%, 0)'
  }

  requestAnimationFrame(() => updateStageAnchors(0))
  if (miniLv) miniLv.textContent = info.lvLabel
  if (miniCoins) miniCoins.textContent = formatCompactNumber(normalized.coins)
  if (miniExp) miniExp.textContent = `${info.expInLevel} / ${info.expMax}`
  if (miniPet) {
    miniPet.src = getPetAssetByTier(info.tierKey)
    miniPet.alt = `${info.tierKey} pet`
  }
  if (miniHat && miniPet) {
    const equipped = normalized.equippedItem === 'straw_hat'
    if (!equipped) {
      miniHat.style.display = 'none'
    } else {
      const anchor = HAT_ANCHORS[info.tierKey]
      const miniRect = miniPet.getBoundingClientRect()
      const wrap = miniPet.parentElement
      const wrapRect = wrap?.getBoundingClientRect()

      if (wrapRect && miniRect.width > 0) {
        const hatW = anchor.miniHatWidth
        const hatH = Math.round(hatW * 0.62)
        const localCenterX = miniRect.left - wrapRect.left + miniRect.width / 2 + anchor.miniX
        const headTopLocal = miniRect.top - wrapRect.top + miniRect.height * anchor.miniHeadRatio
        const localTop = headTopLocal - hatH * 0.78 + anchor.miniY

        miniHat.style.display = 'block'
        miniHat.style.width = `${hatW}px`
        miniHat.style.height = `${hatH}px`
        miniHat.style.left = `${Math.round(localCenterX)}px`
        miniHat.style.top = `${Math.round(localTop)}px`
        miniHat.style.marginLeft = '0'
        miniHat.style.transform = 'translate(-50%, 0)'
      }
    }
  }

  const shopButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="shop-item"]',
  )
  shopButtons.forEach((btn) => {
    const itemKey = btn.getAttribute('data-item')
    if (itemKey !== 'straw_hat') return
    const item = SHOP_ITEMS.find((x) => x.key === itemKey)
    if (!item) return

    const owned = normalized.ownedItems.includes(itemKey)
    const equipped = normalized.equippedItem === itemKey
    const price = btn.querySelector<HTMLElement>('[data-highton="shop-price"]')
    const action = btn.querySelector<HTMLElement>('[data-highton="shop-action"]')

    if (price) {
      price.textContent = String(item.price)
      price.style.opacity = owned ? '0.6' : '1'
    }
    if (action) {
      action.textContent = equipped ? '착용 중' : owned ? '착용하기' : '구매하기'
    }
    btn.setAttribute('data-owned', owned ? '1' : '0')
    btn.setAttribute('data-equipped', equipped ? '1' : '0')
  })

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
      --toast-top: 92px;
      --toast-left: 50%;
    }

    .frame {
      box-sizing: border-box;
      position: fixed;
      left: ${Math.max(8, window.innerWidth - 480 - 16)}px;
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

    .toolbar {
      width: 100%;
      height: 22px;
      margin-top: 0;
      margin-bottom: 6px;
      padding-right: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: move;
      user-select: none;
    }

    .dragDots {
      color: var(--muted);
      font-size: 12px;
      line-height: 1;
      letter-spacing: 0.2em;
      padding-left: 4px;
    }

    .toolBtn {
      width: 20px;
      height: 20px;
      border: 1px solid var(--frame-border);
      border-radius: 6px;
      background: rgba(34, 34, 34, 0.55);
      color: #d8d8d8;
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      padding: 0;
      margin-top: 1px;
    }

    .toolBtn:hover {
      filter: brightness(1.08);
    }

    .miniDock {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .miniDockBtn {
      width: 148px;
      height: 148px;
      border-radius: 0;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      transition:
        transform 120ms ease,
        filter 120ms ease;
    }

    .miniDockBtn:hover {
      transform: translateY(-1px);
      filter: brightness(1.03);
    }

    .miniPetWrap {
      width: 148px;
      height: 148px;
      display: grid;
      place-items: center;
      flex: none;
      position: relative;
    }

    .miniPet {
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }

    .miniHat {
      position: absolute;
      width: 50px;
      height: 30px;
      left: 0;
      top: 0;
      transform: translate(-50%, 0);
      transform-origin: center center;
      margin-left: -25px;
      object-fit: contain;
      pointer-events: none;
      display: none;
    }

    .miniHoverCard {
      position: absolute;
      left: 126px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 148px;
      max-width: 180px;
      display: none;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(8px);
      color: #2a2a2a;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16);
      pointer-events: none;
      z-index: 6;
    }

    .miniHoverCard::after {
      content: '';
      position: absolute;
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      width: 8px;
      height: 10px;
      background: rgba(255, 255, 255, 0.94);
      clip-path: polygon(100% 50%, 0 0, 0 100%);
    }

    .miniMeta {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .miniLv {
      font-weight: 700;
      font-size: 12px;
      line-height: 1.2;
    }

    .miniCoins {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #2a2a2a;
    }

    .miniLabel {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: #595959;
    }

    .frame.collapsed {
      height: 420px;
    }

    .frame.collapsed .quests {
      display: none;
    }

    .frame.minimized {
      width: 164px;
      height: 164px;
      padding: 6px;
      gap: 0;
      border-radius: 999px;
      position: fixed;
      justify-content: center;
      align-items: center;
      overflow: visible;
      background: transparent;
      border: 0;
      backdrop-filter: none;
    }

    .frame.minimized .toolbar {
      display: none;
    }

    .frame.minimized .stage,
    .frame.minimized .status,
    .frame.minimized .quests {
      display: none;
    }

    .frame.minimized .miniDock {
      display: flex;
    }

    .frame.minimized:hover .miniHoverCard,
    .frame.minimized:focus-within .miniHoverCard {
      display: flex;
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
      position: relative;
      overflow: visible;
      cursor: pointer;
    }

    .petImage {
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }

    .petHat {
      position: absolute;
      width: 110px;
      height: 68px;
      left: 0;
      top: 0;
      transform: translate(-50%, 0);
      transform-origin: center center;
      object-fit: contain;
      pointer-events: none;
      z-index: 3;
      margin-left: -55px;
      display: none;
    }

    .coinPill {
      box-sizing: border-box;
      position: absolute;
      right: 12px;
      top: 12px;
      width: auto;
      min-width: 72px;
      max-width: 140px;
      height: 26px;
      padding: 4px 10px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
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
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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

    .bagBtn[aria-pressed='true'] {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(255, 157, 0, 0.45) inset;
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

    .shopPanel {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      min-height: 116px;
      padding: 26px 12px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 157, 0, 0.55);
      background: rgba(34, 34, 34, 0.78);
      backdrop-filter: blur(14px);
      display: none;
      flex-direction: row;
      gap: 10px;
      overflow-x: auto;
      z-index: 5;
    }

    .shopClose {
      position: absolute;
      top: 6px;
      right: 8px;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: rgba(34, 34, 34, 0.42);
      color: #e8e8e8;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      padding: 0;
    }

    .shopClose:hover {
      filter: brightness(1.08);
    }

    .shopPanel[data-open='1'] {
      display: flex;
    }

    .shopCard {
      width: 126px;
      min-width: 126px;
      border-radius: 12px;
      border: 1px solid rgba(255, 157, 0, 0.9);
      background: rgba(255, 157, 0, 0.16);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 8px;
      cursor: pointer;
    }

    .shopCard:hover {
      filter: brightness(1.05);
    }

    .shopCard[data-equipped='1'] {
      border-color: #ffe8b7;
      background: rgba(255, 157, 0, 0.3);
    }

    .shopIcon {
      width: 54px;
      height: 40px;
      object-fit: contain;
      pointer-events: none;
    }

    .shopPrice {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
    }

    .shopName {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
    }

    .shopAction {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
    }

    .status {
      width: 432px;
      height: 22px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }

    .statusLeft {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .lv {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      width: 76px;
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
      width: 48px;
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
      left: var(--toast-left);
      top: var(--toast-top);
      max-width: 230px;
      min-width: 120px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(0, 0, 0, 0.12);
      backdrop-filter: blur(8px);
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      color: #2a2a2a;
      opacity: 0;
      transform: translate(-50%, 6px);
      transition:
        opacity 140ms ease,
        transform 140ms ease;
      pointer-events: none;
      white-space: normal;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      z-index: 4;
    }

    .toast::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: 100%;
      width: 10px;
      height: 8px;
      background: rgba(255, 255, 255, 0.94);
      clip-path: polygon(50% 100%, 0 0, 100% 0);
    }

    .toast[data-open='1'] {
      opacity: 1;
      transform: translate(-50%, 0);
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
    <section class="toolbar" data-highton="dragHandle" aria-label="widget toolbar">
      <span class="dragDots" aria-hidden="true">•••</span>
      <button class="toolBtn" type="button" data-highton="minimize" aria-label="minimize">—</button>
    </section>

    <section class="miniDock" data-highton="miniDock" aria-label="minimized widget">
      <button class="miniDockBtn" type="button" data-highton="miniRestore" aria-label="restore widget">
        <span class="miniPetWrap" aria-hidden="true">
          <img class="miniPet" data-highton="miniPet" src="${ICON_DATA_URLS.newbie}" alt="Newbie pet" />
          <img class="miniHat" data-highton="miniHat" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
        </span>
      </button>

      <div class="miniHoverCard" data-highton="miniHover">
        <div class="miniMeta">
          <div class="miniLv" data-highton="miniHoverLv">LV 1. Newbie</div>
          <div class="miniCoins">
            <span class="miniLabel">Coin</span>
            <span class="coinGlyph" aria-hidden="true"></span>
            <span data-highton="miniHoverCoins">360</span>
          </div>
          <div class="miniCoins"><span class="miniLabel">EXP</span> <span data-highton="miniHoverExp">0 / 100</span></div>
        </div>
      </div>
    </section>

    <section class="stage" aria-label="stage" data-highton="toggle-area">
      <div class="stageInner">
        <div class="pet" data-highton="petTalk" data-highton-no-drag="1" role="button" tabindex="0" aria-label="pet talk">
          <img class="petImage" data-highton="petImage" src="${ICON_DATA_URLS.newbie}" alt="Newbie pet" />
          <img class="petHat" data-highton="petHat" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
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
      <section class="shopPanel" data-highton="shopPanel" aria-label="shop">
        <button class="shopClose" type="button" data-highton="shopClose" aria-label="close shop">×</button>
        <button class="shopCard" type="button" data-highton="shop-item" data-item="straw_hat">
          <img class="shopIcon" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
          <div class="shopPrice">
            <span class="coinGlyph" aria-hidden="true"></span>
            <span data-highton="shop-price">100</span>
          </div>
          <div class="shopName">밀짚모자</div>
          <div class="shopAction" data-highton="shop-action">구매하기</div>
        </button>
      </section>
      <div class="toast" data-highton="toast"></div>
    </section>

    <section class="status" aria-label="status">
      <div class="statusLeft">
        <div class="lv" data-highton="lv">LV 1. Newbie</div>
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
  document.getElementById(ROOT_ID)?.remove()
}

const wireUi = async () => {
  const mounted = getMounted()
  if (!mounted) return

  const state = await loadState()
  renderState(state)

  let applyShopOpen: (open: boolean) => void = () => {
    void 0
  }

  const rerenderByCurrentState = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void (async () => {
          const latest = await loadState()
          renderState(latest)
        })()
      })
    })
  }

  const applyPosition = (left: number, top: number) => {
    const rect = mounted.panel.getBoundingClientRect()
    const clamped = clampPosition(left, top, rect.width, rect.height)
    mounted.panel.style.right = 'auto'
    mounted.panel.style.left = `${clamped.left}px`
    mounted.panel.style.top = `${clamped.top}px`

    try {
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(clamped))
    } catch {
      void 0
    }
  }

  const applyMinimized = (minimized: boolean) => {
    mounted.panel.classList.toggle('minimized', minimized)
    const minimizeBtn = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="minimize"]')
    if (minimizeBtn) {
      minimizeBtn.textContent = minimized ? '□' : '—'
      minimizeBtn.setAttribute('aria-label', minimized ? 'restore' : 'minimize')
    }

    try {
      window.localStorage.setItem(MINIMIZE_KEY, minimized ? '1' : '0')
    } catch {
      void 0
    }

    if (minimized) {
      applyShopOpen(false)
    }

    const rect = mounted.panel.getBoundingClientRect()
    applyPosition(rect.left, rect.top)
    rerenderByCurrentState()
  }

  try {
    applyMinimized(window.localStorage.getItem(MINIMIZE_KEY) === '1')
  } catch {
    void 0
  }

  try {
    const raw = window.localStorage.getItem(POSITION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { left?: unknown; top?: unknown }
      if (typeof parsed.left === 'number' && typeof parsed.top === 'number') {
        applyPosition(parsed.left, parsed.top)
      }
    }
  } catch {
    void 0
  }

  if (mounted.panel.getAttribute('data-highton-wired') === '1') {
    return
  }
  mounted.panel.setAttribute('data-highton-wired', '1')

  const minimizeBtn = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="minimize"]')
  minimizeBtn?.addEventListener('click', () => {
    applyMinimized(!mounted.panel.classList.contains('minimized'))
  })

  const miniRestoreBtn = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="miniRestore"]',
  )
  const bagButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="bag"]')
  const shopPanel = mounted.shadow.querySelector<HTMLElement>('[data-highton="shopPanel"]')
  const shopCloseButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="shopClose"]',
  )
  const shopButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="shop-item"]',
  )

  let shopOpen = false
  applyShopOpen = (open: boolean) => {
    shopOpen = open
    if (shopPanel) {
      shopPanel.setAttribute('data-open', open ? '1' : '0')
    }
    if (bagButton) {
      bagButton.setAttribute('aria-pressed', open ? 'true' : 'false')
    }
  }
  applyShopOpen(false)

  let dragging = false
  let offsetX = 0
  let offsetY = 0
  let dragStartX = 0
  let dragStartY = 0
  let dragMoved = false
  let suppressMiniRestoreClick = false

  const onMouseMove = (event: MouseEvent) => {
    if (!dragging) return

    if (!dragMoved) {
      const movedX = Math.abs(event.clientX - dragStartX)
      const movedY = Math.abs(event.clientY - dragStartY)
      if (movedX > 3 || movedY > 3) {
        dragMoved = true
      }
    }

    applyPosition(event.clientX - offsetX, event.clientY - offsetY)
  }

  const stopDragging = () => {
    if (dragMoved) {
      suppressMiniRestoreClick = true
    }
    dragging = false
    dragMoved = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', stopDragging)
  }

  const startDragging = (event: MouseEvent) => {
    if (event.button !== 0) return
    const target = event.target as HTMLElement | null
    if (
      target?.closest(
        'button:not(.miniDockBtn), input, textarea, select, a, [role="button"], [data-highton-no-drag="1"]',
      )
    ) {
      return
    }

    event.preventDefault()
    const rect = mounted.panel.getBoundingClientRect()
    dragStartX = event.clientX
    dragStartY = event.clientY
    offsetX = event.clientX - rect.left
    offsetY = event.clientY - rect.top
    dragging = true
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', stopDragging)
  }

  mounted.panel.addEventListener('mousedown', startDragging)

  miniRestoreBtn?.addEventListener('click', () => {
    if (suppressMiniRestoreClick) {
      suppressMiniRestoreClick = false
      return
    }
    applyMinimized(false)
  })

  const petTalkTarget = mounted.shadow.querySelector<HTMLElement>('[data-highton="petTalk"]')
  const emitPetTalk = () => {
    void (async () => {
      const prev = await loadState()
      const current = ensureToday(prev)
      toast(getPetTalkMessage(current))
    })()
  }

  petTalkTarget?.addEventListener('click', emitPetTalk)
  petTalkTarget?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    emitPetTalk()
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

  bagButton?.addEventListener('click', () => {
    applyShopOpen(!shopOpen)
  })

  shopCloseButton?.addEventListener('click', () => {
    applyShopOpen(false)
  })

  shopButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemKey = btn.getAttribute('data-item')
      if (itemKey !== 'straw_hat') return

      void (async () => {
        const item = SHOP_ITEMS.find((x) => x.key === itemKey)
        if (!item) return

        const prev = await loadState()
        const current = ensureToday(prev)
        const owned = current.ownedItems.includes(itemKey)

        if (!owned) {
          if (current.coins < item.price) {
            toast('코인이 부족해요')
            return
          }

          const next: PetState = {
            ...current,
            coins: current.coins - item.price,
            ownedItems: [...current.ownedItems, itemKey],
            equippedItem: itemKey,
          }

          const withLog = pushLog(next, `Shop: bought ${item.name} -${item.price} coin`)
          await saveState(withLog)
          renderState(withLog)
          toast(`${item.name} 구매 완료!`)
          return
        }

        const equipNext = current.equippedItem === itemKey ? null : itemKey
        const next: PetState = {
          ...current,
          equippedItem: equipNext,
        }

        const withLog = pushLog(
          next,
          `Shop: ${equipNext ? `equipped ${item.name}` : `unequipped ${item.name}`}`,
        )
        await saveState(withLog)
        renderState(withLog)
        toast(equipNext ? `${item.name} 착용!` : `${item.name} 해제`)
      })()
    })
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

  if (message.type === 'HIGHTON_ADD_TEST_COINS') {
    const rawAmount = (message as { amount?: unknown }).amount
    const amount =
      typeof rawAmount === 'number' && rawAmount > 0 ? Math.floor(rawAmount) : TEST_COIN_AMOUNT

    void (async () => {
      const prev = await loadState()
      const current = ensureToday(prev)
      const next: PetState = {
        ...current,
        coins: Math.max(0, current.coins + amount),
      }
      const withLog = pushLog(next, `Test coins +${amount}`)
      await saveState(withLog)
      renderState(withLog)
      toast(`테스트 코인 +${amount}`)
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
