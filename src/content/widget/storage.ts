import { QUEST_ORDER, STORAGE_KEY, WEEKLY_STATS_KEY } from './constants'
import { buildDailyQuestDefs, clampExp, createDefaultState, ensureToday, getDayKey } from './logic'
import type {
  ActiveBuffs,
  AccessoryKey,
  DailyCounts,
  LogItem,
  Mood,
  PetState,
  QuestDefinition,
  QuestState,
} from './types'

type WeeklySnapshot = {
  commit: number
  pr: number
  review: number
  exp: number
  goldenEggs: number
  updatedAt: number
}

type WeeklyStats = Record<string, WeeklySnapshot>

const MAX_WEEKLY_STATS_DAYS = 35

const toNonNegativeInt = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

const normalizeWeeklyStats = (raw: unknown): WeeklyStats => {
  if (!raw || typeof raw !== 'object') return {}

  const entries = Object.entries(raw as Record<string, unknown>)
  const normalized: WeeklyStats = {}

  for (const [dayKey, snapshot] of entries) {
    if (typeof dayKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue
    if (!snapshot || typeof snapshot !== 'object') continue

    const candidate = snapshot as Record<string, unknown>
    normalized[dayKey] = {
      commit: toNonNegativeInt(candidate.commit),
      pr: toNonNegativeInt(candidate.pr),
      review: toNonNegativeInt(candidate.review),
      exp: toNonNegativeInt(candidate.exp),
      goldenEggs: toNonNegativeInt(candidate.goldenEggs),
      updatedAt: toNonNegativeInt(candidate.updatedAt),
    }
  }

  return normalized
}

const pruneWeeklyStats = (stats: WeeklyStats): WeeklyStats => {
  const ordered = Object.entries(stats)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-MAX_WEEKLY_STATS_DAYS)

  return Object.fromEntries(ordered)
}

export const loadState = async (): Promise<PetState> => {
  const result = await chrome.storage.local.get([STORAGE_KEY])
  const raw = result[STORAGE_KEY] as unknown
  if (!raw || typeof raw !== 'object') {
    const s = createDefaultState()
    await chrome.storage.local.set({ [STORAGE_KEY]: s })
    return s
  }

  const coins = (raw as { coins?: unknown }).coins
  const goldenEggsRaw = (raw as { goldenEggs?: unknown }).goldenEggs
  const lockedEggsRaw = (raw as { lockedEggs?: unknown }).lockedEggs
  const exp = (raw as { exp?: unknown }).exp
  if (typeof coins !== 'number' || typeof exp !== 'number') {
    const s = createDefaultState()
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
          game:
            typeof (countsRaw as { game?: unknown }).game === 'number'
              ? (countsRaw as DailyCounts).game
              : 0,
          feed:
            typeof (countsRaw as { feed?: unknown }).feed === 'number'
              ? (countsRaw as DailyCounts).feed
              : 0,
        }
      : { commit: 0, pr: 0, review: 0, game: 0, feed: 0 }

  const questDefsRaw = (raw as { questDefs?: unknown }).questDefs
  const questDefs: QuestDefinition[] = Array.isArray(questDefsRaw)
    ? questDefsRaw
        .filter(
          (item): item is QuestDefinition =>
            !!item &&
            typeof item === 'object' &&
            ((item as { key?: unknown }).key === 'commit1' ||
              (item as { key?: unknown }).key === 'pr1' ||
              (item as { key?: unknown }).key === 'review1') &&
            ((item as { metric?: unknown }).metric === 'commit' ||
              (item as { metric?: unknown }).metric === 'pr' ||
              (item as { metric?: unknown }).metric === 'review' ||
              (item as { metric?: unknown }).metric === 'game' ||
              (item as { metric?: unknown }).metric === 'feed') &&
            typeof (item as { target?: unknown }).target === 'number' &&
            typeof (item as { rewardCoins?: unknown }).rewardCoins === 'number' &&
            typeof (item as { title?: unknown }).title === 'string',
        )
        .slice(0, 3)
    : []

  const orderedQuestDefs = QUEST_ORDER.map((key) =>
    questDefs.find((item) => item.key === key),
  ).filter((item): item is QuestDefinition => !!item)

  const questDefsByDay =
    orderedQuestDefs.length === 3
      ? orderedQuestDefs
      : buildDailyQuestDefs(typeof dayKeyRaw === 'string' ? dayKeyRaw : getDayKey())

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

  const quests: QuestState[] = QUEST_ORDER.map((key) => ({
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
    ? ownedItemsRaw.filter(
        (x): x is AccessoryKey =>
          x === 'straw_hat' || x === 'sprint_shoes' || x === 'lucky_clover' || x === 'stone_guard',
      )
    : []

  const equippedItemRaw = (raw as { equippedItem?: unknown }).equippedItem
  const equippedItem: AccessoryKey | null =
    equippedItemRaw === 'straw_hat' && ownedItems.includes('straw_hat') ? equippedItemRaw : null

  const activeBuffsRaw = (raw as { activeBuffs?: unknown }).activeBuffs
  const activeBuffs: ActiveBuffs = {
    questBoost:
      activeBuffsRaw &&
      typeof activeBuffsRaw === 'object' &&
      typeof (activeBuffsRaw as { questBoost?: unknown }).questBoost === 'number'
        ? Math.max(0, Math.floor((activeBuffsRaw as { questBoost: number }).questBoost))
        : 0,
    gameDiscount:
      activeBuffsRaw &&
      typeof activeBuffsRaw === 'object' &&
      typeof (activeBuffsRaw as { gameDiscount?: unknown }).gameDiscount === 'number'
        ? Math.max(0, Math.floor((activeBuffsRaw as { gameDiscount: number }).gameDiscount))
        : 0,
    feedBoost:
      activeBuffsRaw &&
      typeof activeBuffsRaw === 'object' &&
      typeof (activeBuffsRaw as { feedBoost?: unknown }).feedBoost === 'number'
        ? Math.max(0, Math.floor((activeBuffsRaw as { feedBoost: number }).feedBoost))
        : 0,
  }

  const state: PetState = {
    coins,
    goldenEggs: typeof goldenEggsRaw === 'number' ? Math.max(0, Math.floor(goldenEggsRaw)) : 0,
    lockedEggs: typeof lockedEggsRaw === 'number' ? Math.max(0, Math.floor(lockedEggsRaw)) : 0,
    exp: clampExp(exp),
    mood,
    lastCommitAt: typeof lastCommitAt === 'number' ? lastCommitAt : 0,
    dayKey: typeof dayKeyRaw === 'string' ? dayKeyRaw : getDayKey(),
    counts,
    activeBuffs,
    questDefs: questDefsByDay,
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

export const saveState = async (state: PetState): Promise<void> => {
  const dayKey = typeof state.dayKey === 'string' ? state.dayKey : getDayKey()
  const previous = await chrome.storage.local.get([WEEKLY_STATS_KEY])
  const weekly = normalizeWeeklyStats(previous[WEEKLY_STATS_KEY] as unknown)

  weekly[dayKey] = {
    commit: toNonNegativeInt(state.counts.commit),
    pr: toNonNegativeInt(state.counts.pr),
    review: toNonNegativeInt(state.counts.review),
    exp: toNonNegativeInt(state.exp),
    goldenEggs: toNonNegativeInt(state.goldenEggs),
    updatedAt: Date.now(),
  }

  await chrome.storage.local.set({
    [STORAGE_KEY]: state,
    [WEEKLY_STATS_KEY]: pruneWeeklyStats(weekly),
  })
}
