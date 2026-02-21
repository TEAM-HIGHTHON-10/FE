export type Mood = 'GOOD' | 'NORMAL' | 'BAD'
export type SimEvent = 'COMMIT' | 'PULL_REQUEST' | 'REVIEW'
export type QuestKey = 'commit1' | 'pr1' | 'review1'
export type AccessoryKey = 'straw_hat'

export type DailyCounts = {
  commit: number
  pr: number
  review: number
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
}
