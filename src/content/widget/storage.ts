import { QUEST_ORDER, STORAGE_KEY } from './constants'
import { clampExp, createDefaultState, ensureToday, getDayKey } from './logic'
import type { AccessoryKey, DailyCounts, LogItem, Mood, PetState, QuestState } from './types'

export const loadState = async (): Promise<PetState> => {
  const result = await chrome.storage.local.get([STORAGE_KEY])
  const raw = result[STORAGE_KEY] as unknown
  if (!raw || typeof raw !== 'object') {
    const s = createDefaultState()
    await chrome.storage.local.set({ [STORAGE_KEY]: s })
    return s
  }

  const coins = (raw as { coins?: unknown }).coins
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

export const saveState = async (state: PetState): Promise<void> => {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}
