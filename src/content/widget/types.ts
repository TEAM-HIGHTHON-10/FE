export type Mood = 'GOOD' | 'NORMAL' | 'BAD'
export type SimEvent = 'COMMIT' | 'PULL_REQUEST' | 'REVIEW'
export type QuestKey = 'commit1' | 'pr1' | 'review1'
export type AccessoryKey = 'straw_hat' | 'sprint_shoes' | 'lucky_clover' | 'stone_guard'
export type BuffKey = 'questBoost' | 'gameDiscount' | 'feedBoost'
export type BuffItemKey = 'quest_boost_24h' | 'game_discount_24h' | 'feed_boost_24h'
export type ShopItemKey = AccessoryKey | BuffItemKey
export type QuestMetric = 'commit' | 'pr' | 'review' | 'game' | 'feed'

export type ActiveBuffs = Record<BuffKey, number>

export type QuestDefinition = {
  key: QuestKey
  metric: QuestMetric
  target: number
  rewardCoins: number
  title: string
}

export type DailyCounts = {
  commit: number
  pr: number
  review: number
  game: number
  feed: number
}

export type QuestState = {
  key: QuestKey
  claimed: boolean
}

export type LogItem = {
  at: number
  text: string
}

export type PetState = {
  coins: number
  goldenEggs: number
  lockedEggs: number
  exp: number
  mood: Mood
  lastCommitAt: number
  dayKey: string
  counts: DailyCounts
  activeBuffs: ActiveBuffs
  questDefs: QuestDefinition[]
  quests: QuestState[]
  logs: LogItem[]
  ownedItems: AccessoryKey[]
  equippedItem: AccessoryKey | null
}

export type WidgetPosition = {
  left: number
  top: number
}

export type TierKey = 'Newbie' | 'Junior' | 'Mid' | 'Senior'

export type HatAnchor = {
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
  miniBadgeX: number
  miniBadgeY: number
}
