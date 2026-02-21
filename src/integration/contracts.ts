export const BACKEND_BASE_URL = 'https://dev.taisu.site'
export const BACKEND_WS_URL = 'wss://dev.taisu.site/ws'
export const AUTH_STORAGE_KEY = 'highton_auth_session_v1'

export type BackendLevel = 'NEWBIE' | 'JUNIOR' | 'MIDDLE' | 'SENIOR'
export type QuestType = 'COMMIT' | 'PR' | 'ISSUE' | 'REVIEW' | 'FOLLOWER' | 'GAME'

export type AuthSession = {
  token: string
  username: string
  xp: number
  level: BackendLevel
}

export type OAuthCallbackLevelKo = '입문' | '주니어' | '미들' | '시니어'

export type OAuthCallbackResponse = {
  token: string
  username: string
  xp: number
  level: OAuthCallbackLevelKo | BackendLevel
}

export type StatusResponse = {
  username: string
  level: BackendLevel
  currentLevelXp: number
  xpToNextLevel: number
  eggCount: number
  totalXp: number
}

export type FeedResponse = {
  username: string
  level: BackendLevel
  currentLevelXp: number
  xpToNextLevel: number
  eggCount: number
  totalXp: number
  eggsConsumed: number
  leveledUp: boolean
}

export type GameResult = 'SUCCESS' | 'FAIL'

export type GameResultResponse = {
  result: GameResult
  eggs_earned: number
  total_eggs: number
}

export type WebhookRegisterResponse = {
  id: number
  type: string
  name: string
  active: boolean
  events: string[]
  config?: {
    url: string
    content_type: string
  }
}

export type OrgItem = {
  login: string
  id: number
  avatar_url: string
  description: string | null
}

export type RepoItem = {
  name: string
  full_name: string
  private: boolean
  html_url: string
  language: string | null
}

export type ApiErrorPayload = {
  status: number
  message: string
  timestamp: string
}

export type RuntimeRequest =
  | { type: 'HIGHTON_AUTH_START' }
  | { type: 'HIGHTON_AUTH_STATUS' }
  | { type: 'HIGHTON_AUTH_LOGOUT' }
  | { type: 'HIGHTON_API_GET_STATUS' }
  | { type: 'HIGHTON_API_FEED' }
  | { type: 'HIGHTON_API_GET_ORGS' }
  | { type: 'HIGHTON_API_GET_REPOS'; org: string }
  | { type: 'HIGHTON_API_REGISTER_WEBHOOK'; owner: string; repo: string }
  | { type: 'HIGHTON_API_GAME_RESULT'; result: GameResult }

export type RuntimeResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }

export type AuthStatusData = {
  authenticated: boolean
  username: string | null
  level: BackendLevel | null
}

export type QuestCompletedEvent = {
  type: 'QUEST_COMPLETED'
  questType: QuestType
  eggsEarned: number
  totalEggs: number
}
