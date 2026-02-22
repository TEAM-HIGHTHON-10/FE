import { ICON_DATA_URLS } from '../../assets/iconDataUrls'
import {
  DEFAULT_QUESTS,
  EXP_PER_LEVEL,
  LEVELS_PER_TIER,
  MAX_LEVEL_INDEX,
  MAX_TOTAL_EXP,
  PET_TALKS,
  QUEST_TEMPLATE_POOL,
  QUEST_ORDER,
  TIERS,
} from './constants'
import type { Mood, PetState, QuestDefinition, QuestKey, TierKey, WidgetPosition } from './types'

export const getDayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const createDefaultState = (): PetState => {
  const dayKey = getDayKey()
  return {
    coins: 0,
    goldenEggs: 0,
    lockedEggs: 0,
    exp: 0,
    mood: 'NORMAL',
    lastCommitAt: 0,
    dayKey,
    counts: { commit: 0, pr: 0, review: 0, game: 0, feed: 0 },
    activeBuffs: {
      questBoost: 0,
      gameDiscount: 0,
      feedBoost: 0,
    },
    questDefs: buildDailyQuestDefs(dayKey),
    quests: QUEST_ORDER.map((key) => ({ key, claimed: false })),
    logs: [],
    ownedItems: [],
    equippedItem: null,
  }
}

export const getMoodModifier = (mood: Mood) => {
  if (mood === 'GOOD') return 1.1
  if (mood === 'BAD') return 0.9
  return 1
}

export const improveMood = (mood: Mood): Mood => {
  if (mood === 'BAD') return 'NORMAL'
  if (mood === 'NORMAL') return 'GOOD'
  return 'GOOD'
}

export const clampExp = (exp: number) => {
  return Math.max(0, Math.min(MAX_TOTAL_EXP, exp))
}

export const clampPosition = (
  left: number,
  top: number,
  width: number,
  height: number,
): WidgetPosition => {
  const margin = 0
  const maxLeft = Math.max(margin, window.innerWidth - width - margin)
  const maxTop = Math.max(margin, window.innerHeight - height - margin)

  return {
    left: Math.min(Math.max(left, margin), maxLeft),
    top: Math.min(Math.max(top, margin), maxTop),
  }
}

export const ensureToday = (state: PetState): PetState => {
  const today = getDayKey()
  if (state.dayKey === today) return state

  return {
    ...state,
    dayKey: today,
    counts: { commit: 0, pr: 0, review: 0, game: 0, feed: 0 },
    questDefs: buildDailyQuestDefs(today),
    quests: state.quests.map((q) => ({ ...q, claimed: false })),
  }
}

const hashDayKey = (dayKey: string): number => {
  let hash = 2166136261
  for (let i = 0; i < dayKey.length; i += 1) {
    hash ^= dayKey.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return hash >>> 0
}

const nextSeed = (seed: number): number => {
  return (seed * 1664525 + 1013904223) >>> 0
}

export const buildDailyQuestDefs = (dayKey: string): QuestDefinition[] => {
  const available = [...QUEST_TEMPLATE_POOL]
  let seed = hashDayKey(dayKey)

  const defs: QuestDefinition[] = QUEST_ORDER.map((key, idx) => {
    if (available.length === 0) return DEFAULT_QUESTS[key]
    seed = nextSeed(seed + idx)
    const pickIndex = seed % available.length
    const picked = available.splice(pickIndex, 1)[0]
    return {
      key,
      metric: picked.metric,
      target: picked.target,
      rewardCoins: picked.rewardCoins,
      title: picked.title,
    }
  })

  return defs
}

export const getQuestDefinition = (state: PetState, key: QuestKey): QuestDefinition => {
  return state.questDefs.find((item) => item.key === key) ?? DEFAULT_QUESTS[key]
}

export const isQuestCompleted = (state: PetState, key: QuestKey) => {
  const quest = getQuestDefinition(state, key)
  return state.counts[quest.metric] >= quest.target
}

export const isQuestClaimed = (state: PetState, key: QuestKey) => {
  return state.quests.find((q) => q.key === key)?.claimed ?? false
}

export const pushLog = (state: PetState, text: string): PetState => {
  const nextLogs = [{ at: Date.now(), text }, ...state.logs].slice(0, 3)
  return { ...state, logs: nextLogs }
}

export const formatCompactNumber = (value: number) => {
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

export const getLevelInfo = (totalExp: number) => {
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

export const getPetAssetByTier = (tierKey: TierKey, withHat = false) => {
  if (tierKey === 'Junior') return withHat ? ICON_DATA_URLS.juniorHat : ICON_DATA_URLS.junior
  if (tierKey === 'Mid') return withHat ? ICON_DATA_URLS.midHat : ICON_DATA_URLS.mid
  if (tierKey === 'Senior') return withHat ? ICON_DATA_URLS.seniorHat : ICON_DATA_URLS.senior
  return withHat ? ICON_DATA_URLS.newbieHat : ICON_DATA_URLS.newbie
}

export const getGamePetAssetByTier = (tierKey: TierKey, withHat = false, dead = false) => {
  if (tierKey === 'Junior') {
    if (dead) return ICON_DATA_URLS.juniorGameDie
    return withHat ? ICON_DATA_URLS.juniorGameHat : ICON_DATA_URLS.juniorGame
  }
  if (tierKey === 'Mid') {
    if (dead) return ICON_DATA_URLS.midGameDie
    return withHat ? ICON_DATA_URLS.midGameHat : ICON_DATA_URLS.midGame
  }
  if (tierKey === 'Senior') {
    if (dead) return ICON_DATA_URLS.seniorGameDie
    return withHat ? ICON_DATA_URLS.seniorGameHat : ICON_DATA_URLS.seniorGame
  }
  if (dead) return ICON_DATA_URLS.newbieGameDie
  return withHat ? ICON_DATA_URLS.newbieGameHat : ICON_DATA_URLS.newbieGame
}

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export const pickRandom = <T>(arr: T[]): T => {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const getPetTalkMessage = (state: PetState) => {
  const tierKey = getLevelInfo(state.exp).tierKey
  const moodLine = pickRandom(PET_TALKS[tierKey][state.mood])
  return moodLine
}
