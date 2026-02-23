import {
  BUFF_DURATION_MS,
  DEBUG,
  GAME_REVIVE_COST,
  HAT_ANCHORS,
  MINIMIZE_KEY,
  POSITION_KEY,
  QUEST_TEMPLATE_POOL,
  QUEST_REROLL_COST,
  QUEST_ORDER,
  ROOT_ID,
  SHOP_ITEMS,
  TEST_COIN_AMOUNT,
  clamp,
  clampExp,
  clampPosition,
  createWidgetCss,
  createWidgetHtml,
  createDefaultState,
  ensureToday,
  formatCompactNumber,
  getGamePetAssetByTier,
  getLevelInfo,
  getPetAssetByTier,
  getPetTalkMessage,
  getQuestDefinition,
  improveMood,
  isQuestCompleted,
  loadState,
  pushLog,
  saveState,
} from './widget'
import {
  AUTH_STORAGE_KEY,
  BACKEND_WS_URL,
  type AuthStatusData,
  type BackendLevel,
  type QuestCompletedEvent,
  type RuntimeResponse,
  type StatusResponse,
} from '../integration'
import type { AccessoryKey, PetState, QuestKey, ShopItemKey } from './widget'

const getMounted = () => {
  const root = document.getElementById(ROOT_ID)
  const shadow = root?.shadowRoot
  if (!shadow) return null
  const panel = shadow.querySelector<HTMLElement>('[data-highton="panel"]')
  if (!panel) return null
  return { root, shadow, panel }
}

let toastTimerId: number | null = null
const GAME_PLAY_COST = 10
const GAME_PLAY_COST_DISCOUNT = 3
const GAME_BUFF_DISCOUNT = 2
const GAME_REWARD_BASE_MULTIPLIER = 0.5

type GameDifficulty = 'easy' | 'normal' | 'hard'

const HARD_GIANT_STONE_CHANCE = 0.22

const GAME_DIFFICULTIES: Record<
  GameDifficulty,
  {
    label: string
    rewardMultiplier: number
    spawnMs: number
    speedMin: number
    speedRange: number
    scoreStep: number
    costDelta: number
  }
> = {
  easy: {
    label: '쉬움',
    rewardMultiplier: 1,
    spawnMs: 680,
    speedMin: 130,
    speedRange: 90,
    scoreStep: 5,
    costDelta: -1,
  },
  normal: {
    label: '보통',
    rewardMultiplier: 1.2,
    spawnMs: 540,
    speedMin: 155,
    speedRange: 115,
    scoreStep: 5,
    costDelta: 0,
  },
  hard: {
    label: '어려움',
    rewardMultiplier: 1.5,
    spawnMs: 430,
    speedMin: 210,
    speedRange: 140,
    scoreStep: 5,
    costDelta: 2,
  },
}

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

const runtimeRequest = async <T>(message: unknown): Promise<RuntimeResponse<T>> => {
  try {
    return (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>
  } catch {
    return { ok: false, error: '백그라운드와 통신에 실패했어요.' }
  }
}

const hasItem = (state: PetState, key: 'sprint_shoes' | 'lucky_clover' | 'stone_guard') => {
  return state.ownedItems.includes(key)
}

const isBuffActive = (state: PetState, buff: 'questBoost' | 'gameDiscount' | 'feedBoost') => {
  return state.activeBuffs[buff] > Date.now()
}

const formatRemaining = (until: number) => {
  const remainMs = Math.max(0, until - Date.now())
  const totalMinutes = Math.ceil(remainMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}분`
  return `${hours}시간 ${minutes}분`
}

const isShopItemKey = (value: string | null): value is ShopItemKey => {
  if (!value) return false
  return SHOP_ITEMS.some((item) => item.key === value)
}

const isAccessoryKey = (key: ShopItemKey): key is AccessoryKey => {
  return (
    key === 'straw_hat' || key === 'sprint_shoes' || key === 'lucky_clover' || key === 'stone_guard'
  )
}

const rerollQuestDefinition = (state: PetState, key: QuestKey) => {
  const current = getQuestDefinition(state, key)
  const occupiedByOther = new Set(
    state.questDefs
      .filter((quest) => quest.key !== key)
      .map((quest) => `${quest.metric}:${quest.target}:${quest.title}`),
  )

  const candidates = QUEST_TEMPLATE_POOL.filter((template) => {
    const token = `${template.metric}:${template.target}:${template.title}`
    if (token === `${current.metric}:${current.target}:${current.title}`) return false
    return !occupiedByOther.has(token)
  })

  const picked =
    candidates[Math.floor(Math.random() * candidates.length)] ??
    QUEST_TEMPLATE_POOL[Math.floor(Math.random() * QUEST_TEMPLATE_POOL.length)]

  return {
    key,
    metric: picked.metric,
    target: picked.target,
    rewardCoins: picked.rewardCoins,
    title: picked.title,
  }
}

const getGameCost = (state: PetState, difficulty: GameDifficulty) => {
  const discounted = hasItem(state, 'sprint_shoes')
    ? GAME_PLAY_COST - GAME_PLAY_COST_DISCOUNT
    : GAME_PLAY_COST
  const buffDiscount = isBuffActive(state, 'gameDiscount') ? GAME_BUFF_DISCOUNT : 0
  return Math.max(1, discounted - buffDiscount + GAME_DIFFICULTIES[difficulty].costDelta)
}

const applyAuthUi = (authenticated: boolean) => {
  const mounted = getMounted()
  if (!mounted) return

  mounted.panel.setAttribute('data-highton-auth', authenticated ? '1' : '0')
  if (!authenticated) {
    mounted.panel.classList.remove('minimized')
    const minimizeBtn = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="minimize"]')
    if (minimizeBtn) {
      minimizeBtn.textContent = '—'
      minimizeBtn.setAttribute('aria-label', 'minimize')
    }
    try {
      window.localStorage.setItem(MINIMIZE_KEY, '0')
    } catch {
      void 0
    }
    mounted.panel.removeAttribute('data-highton-game-active')
    const gamePanel = mounted.shadow.querySelector<HTMLElement>('[data-highton="gamePanel"]')
    const shopPanel = mounted.shadow.querySelector<HTMLElement>('[data-highton="shopPanel"]')
    gamePanel?.setAttribute('data-open', '0')
    gamePanel?.setAttribute('data-mode', 'menu')
    shopPanel?.setAttribute('data-open', '0')
  }
}

const handleAuthExpired = async (message: string) => {
  applyAuthUi(false)
  toast(message)
  disconnectQuestSocket()
  await runtimeRequest<{ success: boolean }>({ type: 'HIGHTON_AUTH_LOGOUT' })
}

const toUiExp = (level: BackendLevel, currentLevelXp: number) => {
  const perLevel = 100
  const normalizedCurrent = Math.max(0, Math.floor(currentLevelXp)) % perLevel

  if (level === 'NEWBIE') return normalizedCurrent
  if (level === 'JUNIOR') return perLevel + normalizedCurrent
  if (level === 'MIDDLE') return perLevel * 2 + normalizedCurrent
  return perLevel * 3 + Math.min(perLevel - 1, normalizedCurrent)
}

const applyBackendStatus = async (status: StatusResponse, logText: string) => {
  const prev = await loadState()
  const current = ensureToday(prev)
  const next: PetState = {
    ...current,
    exp: clampExp(Math.max(current.exp, toUiExp(status.level, status.currentLevelXp))),
  }
  const withLog = pushLog(next, logText)
  await saveState(withLog)
  renderState(withLog)
}

const syncStatusFromBackend = async (showErrorToast: boolean) => {
  const response = await runtimeRequest<StatusResponse>({ type: 'HIGHTON_API_GET_STATUS' })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await handleAuthExpired('로그인이 만료되었어요. 다시 로그인해주세요.')
      return false
    }
    if (showErrorToast) {
      toast(response.error)
    }
    return false
  }

  await applyBackendStatus(response.data, `Sync: status level=${response.data.level}`)
  return true
}

const getAuthToken = async (): Promise<string | null> => {
  const stored = await chrome.storage.local.get([AUTH_STORAGE_KEY])
  const raw = stored[AUTH_STORAGE_KEY] as unknown
  if (!raw || typeof raw !== 'object') return null
  const token = (raw as { token?: unknown }).token
  return typeof token === 'string' && token.length > 0 ? token : null
}

let questSocket: WebSocket | null = null
let questSocketToken: string | null = null
let questSocketRetryId: number | null = null

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const normalizeQuestType = (value: unknown): QuestCompletedEvent['questType'] | null => {
  if (typeof value !== 'string' || value.trim().length === 0) return null
  const raw = value.trim().toUpperCase()

  if (raw === 'COMMIT') return 'COMMIT'
  if (raw === 'PR' || raw === 'PULL_REQUEST' || raw === 'PULLREQUEST') return 'PR'
  if (raw === 'ISSUE') return 'ISSUE'
  if (raw === 'REVIEW' || raw === 'PULL_REQUEST_REVIEW') return 'REVIEW'
  if (raw === 'FOLLOWER') return 'FOLLOWER'
  if (raw === 'GAME') return 'GAME'
  return null
}

const normalizeQuestCompletedEvent = (payload: unknown): QuestCompletedEvent | null => {
  if (!payload || typeof payload !== 'object') return null

  const container = payload as {
    type?: unknown
    event?: unknown
    data?: unknown
    payload?: unknown
  }

  const inner =
    container.data && typeof container.data === 'object'
      ? container.data
      : container.payload && typeof container.payload === 'object'
        ? container.payload
        : payload

  const type = container.type ?? container.event ?? (inner as { type?: unknown }).type
  if (type !== 'QUEST_COMPLETED') return null

  const questType = normalizeQuestType(
    (inner as { questType?: unknown; quest_type?: unknown }).questType ??
      (inner as { quest_type?: unknown }).quest_type,
  )
  if (!questType) return null

  const eggsEarned = toFiniteNumber(
    (inner as { eggsEarned?: unknown; eggs_earned?: unknown }).eggsEarned ??
      (inner as { eggs_earned?: unknown }).eggs_earned,
  )
  const totalEggs = toFiniteNumber(
    (inner as { totalEggs?: unknown; total_eggs?: unknown }).totalEggs ??
      (inner as { total_eggs?: unknown }).total_eggs,
  )

  return {
    type: 'QUEST_COMPLETED',
    questType,
    eggsEarned: eggsEarned ?? 0,
    totalEggs: totalEggs ?? 0,
  }
}

const clearQuestSocketRetry = () => {
  if (questSocketRetryId !== null) {
    window.clearTimeout(questSocketRetryId)
    questSocketRetryId = null
  }
}

const disconnectQuestSocket = () => {
  clearQuestSocketRetry()
  if (questSocket) {
    questSocket.onopen = null
    questSocket.onmessage = null
    questSocket.onerror = null
    questSocket.onclose = null
    questSocket.close()
  }
  questSocket = null
  questSocketToken = null
}

const connectQuestSocket = async () => {
  const token = await getAuthToken()
  if (!token) {
    disconnectQuestSocket()
    return
  }

  if (
    questSocket &&
    questSocketToken === token &&
    (questSocket.readyState === WebSocket.OPEN || questSocket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }

  disconnectQuestSocket()
  questSocketToken = token
  const ws = new WebSocket(`${BACKEND_WS_URL}?token=${encodeURIComponent(token)}`)
  questSocket = ws

  ws.onmessage = (event) => {
    let data: QuestCompletedEvent | null = null
    try {
      data = normalizeQuestCompletedEvent(JSON.parse(event.data))
    } catch {
      return
    }

    if (!data) return

    void (async () => {
      const prev = await loadState()
      const current = ensureToday(prev)

      const nextCounts = {
        ...current.counts,
      }

      if (data.questType === 'COMMIT') {
        nextCounts.commit += 1
      }
      if (data.questType === 'PR') {
        nextCounts.pr += 1
      }
      if (data.questType === 'ISSUE' || data.questType === 'REVIEW') {
        nextCounts.review += 1
      }
      if (data.questType === 'GAME') {
        nextCounts.game += 1
      }

      const next: PetState = {
        ...current,
        counts: nextCounts,
      }
      const withLog = pushLog(next, `Quest complete: ${data.questType} (claim available)`)
      await saveState(withLog)
      renderState(withLog)
      if (data.questType === 'COMMIT') toast('커밋 퀘스트 완료! 받기를 눌러 코인을 받으세요.')
      else if (data.questType === 'PR') toast('PR 퀘스트 완료! 받기를 눌러 코인을 받으세요.')
      else if (data.questType === 'ISSUE' || data.questType === 'REVIEW') {
        toast('이슈 퀘스트 완료! 받기를 눌러 코인을 받으세요.')
      } else if (data.questType === 'GAME') {
        toast('게임 플레이 퀘스트 진행 +1')
      }
    })()
  }

  ws.onerror = () => {
    ws.close()
  }

  ws.onclose = (event) => {
    if (questSocket !== ws) return
    questSocket = null

    if (event.code === 1008) {
      void handleAuthExpired('세션이 만료되어 연결이 종료됐어요. 다시 로그인해주세요.')
      return
    }

    clearQuestSocketRetry()
    questSocketRetryId = window.setTimeout(() => {
      void connectQuestSocket()
    }, 5000)
  }
}

const renderState = (state: PetState) => {
  const mounted = getMounted()
  if (!mounted) return

  const normalized = ensureToday(state)
  const info = getLevelInfo(normalized.exp)
  const equippedHat = normalized.equippedItem === 'straw_hat'
  const percent = Math.max(0, Math.min(100, (info.expInLevel / info.expMax) * 100))

  const coins = mounted.shadow.querySelector<HTMLElement>('[data-highton="coins"]')
  const goldEggs = mounted.shadow.querySelector<HTMLElement>('[data-highton="goldEggs"]')
  const lv = mounted.shadow.querySelector<HTMLElement>('[data-highton="lv"]')
  const expText = mounted.shadow.querySelector<HTMLElement>('[data-highton="expText"]')
  const fill = mounted.shadow.querySelector<HTMLElement>('[data-highton="fill"]')
  const bar = mounted.shadow.querySelector<HTMLElement>('[data-highton="bar"]')
  const petImage = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="petImage"]')
  const petHat = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="petHat"]')
  const miniLv = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHoverLv"]')
  const miniGoldEggs = mounted.shadow.querySelector<HTMLElement>(
    '[data-highton="miniHoverGoldEggs"]',
  )
  const miniCoins = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHoverCoins"]')
  const miniExp = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHoverExp"]')
  const miniQuestBadge = mounted.shadow.querySelector<HTMLElement>(
    '[data-highton="miniQuestBadge"]',
  )
  const miniPet = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="miniPet"]')
  const gamePlayer = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="gamePlayer"]')
  const miniHat = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="miniHat"]')
  const feedCost = mounted.shadow.querySelector<HTMLElement>('[data-highton="feedCost"]')
  const feedButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="feed"]')

  if (coins) coins.textContent = formatCompactNumber(normalized.coins)
  if (goldEggs) goldEggs.textContent = formatCompactNumber(normalized.goldenEggs)
  if (lv) lv.textContent = info.lvLabel
  if (expText) expText.textContent = `${info.expInLevel} / ${info.expMax}`
  if (fill) fill.style.width = `${percent}%`
  if (bar) bar.setAttribute('aria-valuenow', String(info.expInLevel))
  if (petImage) {
    petImage.src = getPetAssetByTier(info.tierKey, equippedHat)
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
    const equipped = equippedHat
    const hatW = anchor.hatWidth
    const hatH = Math.round(hatW * 0.62)

    const headCenterX = imgRect.left - stageRect.left + imgRect.width / 2 + anchor.x
    const headTopY = imgRect.top - stageRect.top + imgRect.height * anchor.headRatio
    const toastTop = equipped ? headTopY - hatH - anchor.toastGap : headTopY - anchor.toastNoHatGap

    mounted.panel.style.setProperty('--toast-left', `${Math.round(headCenterX)}px`)
    mounted.panel.style.setProperty('--toast-top', `${Math.round(clamp(toastTop, 10, 130))}px`)

    if (petHat) {
      petHat.style.display = 'none'
    }
  }

  requestAnimationFrame(() => updateStageAnchors(0))
  if (miniLv) miniLv.textContent = info.lvLabel
  if (miniGoldEggs) miniGoldEggs.textContent = formatCompactNumber(normalized.goldenEggs)
  if (miniCoins) miniCoins.textContent = formatCompactNumber(normalized.coins)
  if (miniExp) miniExp.textContent = `${info.expInLevel} / ${info.expMax}`
  if (feedCost) feedCost.textContent = formatCompactNumber(normalized.coins)
  if (feedButton) feedButton.disabled = normalized.coins <= 0
  if (miniPet) {
    miniPet.src = getPetAssetByTier(info.tierKey, equippedHat)
    miniPet.alt = `${info.tierKey} pet`
  }
  if (gamePlayer) {
    gamePlayer.src = getGamePetAssetByTier(info.tierKey, equippedHat, false)
    gamePlayer.alt = `${info.tierKey} game pet`
  }
  if (miniQuestBadge && miniPet) {
    const anchor = HAT_ANCHORS[info.tierKey]
    const miniRect = miniPet.getBoundingClientRect()
    const wrap = miniPet.parentElement
    const wrapRect = wrap?.getBoundingClientRect()

    if (wrapRect && miniRect.width > 0) {
      const localCenterX = miniRect.left - wrapRect.left + miniRect.width / 2
      const headTopLocal = miniRect.top - wrapRect.top + miniRect.height * anchor.miniHeadRatio
      miniQuestBadge.style.left = `${Math.round(localCenterX + anchor.miniBadgeX)}px`
      miniQuestBadge.style.top = `${Math.round(headTopLocal + anchor.miniBadgeY)}px`
    }
  }
  if (miniHat) {
    miniHat.style.display = 'none'
  }

  const shopButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="shop-item"]',
  )
  const now = Date.now()
  shopButtons.forEach((btn) => {
    const itemKey = btn.getAttribute('data-item')
    if (!isShopItemKey(itemKey)) return
    const item = SHOP_ITEMS.find((x) => x.key === itemKey)
    if (!item) return

    const owned =
      !item.buffKey && isAccessoryKey(item.key) ? normalized.ownedItems.includes(item.key) : false
    const equipped =
      !item.passive && !item.buffKey && isAccessoryKey(item.key)
        ? normalized.equippedItem === item.key
        : false
    const price = btn.querySelector<HTMLElement>('[data-highton="shop-price"]')
    const action = btn.querySelector<HTMLElement>('[data-highton="shop-action"]')
    const desc = btn.querySelector<HTMLElement>('[data-highton="shop-desc"]')
    const buffActive = item.buffKey ? normalized.activeBuffs[item.buffKey] > now : false

    if (price) {
      price.textContent = String(item.price)
      price.style.opacity = owned || buffActive ? '0.6' : '1'
    }
    if (desc) {
      desc.textContent =
        item.buffKey && buffActive
          ? `${item.description} (남은 시간 ${formatRemaining(normalized.activeBuffs[item.buffKey])})`
          : item.description
    }
    if (action) {
      if (item.buffKey) action.textContent = buffActive ? '연장하기' : '구매하기'
      else if (item.passive) action.textContent = owned ? '적용 중' : '구매하기'
      else action.textContent = equipped ? '착용 중' : owned ? '착용하기' : '구매하기'
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
    const reroll = row.querySelector<HTMLButtonElement>('[data-highton="q_reroll"]')

    const done = isQuestCompleted(normalized, key)
    const def = getQuestDefinition(normalized, key)
    const rewardMultiplier =
      1 +
      (normalized.ownedItems.includes('lucky_clover') ? 0.2 : 0) +
      (isBuffActive(normalized, 'questBoost') ? 0.1 : 0)
    const rewardPreview = Math.max(1, Math.floor(def.rewardCoins * rewardMultiplier))

    if (title) {
      const progress = Math.min(normalized.counts[def.metric], def.target)
      title.textContent = `${def.title} (${progress}/${def.target})`
    }
    if (reward) reward.textContent = String(rewardPreview)
    if (claim) {
      claim.disabled = !done
      claim.textContent = '받기'
    }
    if (reroll) {
      reroll.disabled = normalized.goldenEggs < QUEST_REROLL_COST
      reroll.textContent = `교체(${QUEST_REROLL_COST})`
    }
  }

  applyQuestRow('commit1')
  applyQuestRow('pr1')
  applyQuestRow('review1')

  const claimableQuestCount = QUEST_ORDER.reduce((acc, key) => {
    return acc + (isQuestCompleted(normalized, key) ? 1 : 0)
  }, 0)
  if (miniQuestBadge) {
    if (claimableQuestCount > 0) {
      miniQuestBadge.textContent = claimableQuestCount > 99 ? '99+' : String(claimableQuestCount)
      miniQuestBadge.setAttribute('data-open', '1')
    } else {
      miniQuestBadge.textContent = '0'
      miniQuestBadge.removeAttribute('data-open')
    }
  }
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
  style.textContent = createWidgetCss(topOffset)

  const panel = document.createElement('section')
  panel.className = 'frame'
  panel.setAttribute('data-highton', 'panel')
  panel.setAttribute('data-highton-auth', '1')
  panel.innerHTML = createWidgetHtml()

  shadow.append(style, panel)
}

const unmountWidget = () => {
  document.getElementById(ROOT_ID)?.remove()
}

const wireUi = async () => {
  const mounted = getMounted()
  if (!mounted) return

  const auth = await runtimeRequest<AuthStatusData>({ type: 'HIGHTON_AUTH_STATUS' })
  const authenticated = auth.ok && auth.data.authenticated
  applyAuthUi(authenticated)

  if (authenticated) {
    const state = await loadState()
    renderState(state)
    void syncStatusFromBackend(false)
    void connectQuestSocket()
  } else {
    disconnectQuestSocket()
  }

  let applyShopOpen: (open: boolean) => void = () => {
    void 0
  }
  let applyGameOpen: (open: boolean) => void = () => {
    void 0
  }

  const miniDock = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniDock"]')
  const miniHover = mounted.shadow.querySelector<HTMLElement>('[data-highton="miniHover"]')

  const updateMiniHoverDirection = () => {
    if (!miniDock || !miniHover || !mounted.panel.classList.contains('minimized')) {
      miniDock?.classList.remove('flipLeft')
      return
    }

    const panelRect = mounted.panel.getBoundingClientRect()
    const hoverWidth = Math.max(miniHover.getBoundingClientRect().width, 180)
    const rightOverflow = panelRect.left + 126 + hoverWidth > window.innerWidth - 8

    if (rightOverflow) {
      miniDock.classList.add('flipLeft')
    } else {
      miniDock.classList.remove('flipLeft')
    }
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

    requestAnimationFrame(updateMiniHoverDirection)
  }

  const applyMinimized = (minimized: boolean) => {
    const authenticated = mounted.panel.getAttribute('data-highton-auth') === '1'
    const nextMinimized = authenticated ? minimized : false
    const prevRect = mounted.panel.getBoundingClientRect()
    mounted.panel.classList.toggle('minimized', nextMinimized)
    const minimizeBtn = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="minimize"]')
    if (minimizeBtn) {
      minimizeBtn.textContent = nextMinimized ? '□' : '—'
      minimizeBtn.setAttribute('aria-label', nextMinimized ? 'restore' : 'minimize')
    }

    try {
      window.localStorage.setItem(MINIMIZE_KEY, nextMinimized ? '1' : '0')
    } catch {
      void 0
    }

    if (nextMinimized) {
      applyShopOpen(false)
      applyGameOpen(false)
    }

    const rect = mounted.panel.getBoundingClientRect()
    const nextLeft = prevRect.right - rect.width
    applyPosition(nextLeft, prevRect.top)
    rerenderByCurrentState()
    requestAnimationFrame(updateMiniHoverDirection)
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
  const gameButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="game"]')
  const gamePanel = mounted.shadow.querySelector<HTMLElement>('[data-highton="gamePanel"]')
  const gameCloseButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="gameClose"]',
  )
  const gameEnterButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="gameEnter"]',
  )
  const gameDifficultyButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="gameDifficultyBtn"]',
  )
  const gameMeta = mounted.shadow.querySelector<HTMLElement>('[data-highton="gameMeta"]')
  const gameRewardMultiplier = mounted.shadow.querySelector<HTMLElement>(
    '[data-highton="gameRewardMultiplier"]',
  )
  const gameCostText = mounted.shadow.querySelector<HTMLElement>('[data-highton="gameCost"]')
  const gameMoveLeftButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="gameMoveLeft"]',
  )
  const gameMoveRightButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="gameMoveRight"]',
  )
  const gameArena = mounted.shadow.querySelector<HTMLElement>('[data-highton="gameArena"]')
  const gameStonesLayer = mounted.shadow.querySelector<HTMLElement>('[data-highton="gameStones"]')
  const gamePlayer = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="gamePlayer"]')
  const gameScoreText = mounted.shadow.querySelector<HTMLElement>('[data-highton="gameScore"]')
  const bagButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="bag"]')
  const shopPanel = mounted.shadow.querySelector<HTMLElement>('[data-highton="shopPanel"]')
  const shopTabButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="shop-tab"]',
  )
  const shopCloseButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="shopClose"]',
  )
  const shopButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="shop-item"]',
  )

  let shopOpen = false
  let shopMode: 'cosmetic' | 'upgrade' = 'cosmetic'
  let gameOpen = false

  const setGameMode = (mode: 'menu' | 'play') => {
    if (gamePanel) {
      gamePanel.setAttribute('data-mode', mode)
    }
  }

  const setGameActive = (active: boolean) => {
    mounted.panel.setAttribute('data-highton-game-active', active ? '1' : '0')
  }

  applyGameOpen = (open: boolean) => {
    gameOpen = open
    if (gamePanel) {
      gamePanel.setAttribute('data-open', open ? '1' : '0')
    }
    if (gameButton) {
      gameButton.setAttribute('aria-pressed', open ? 'true' : 'false')
    }
    if (!open) {
      setGameMode('menu')
      setGameActive(false)
    }
  }
  applyGameOpen(false)

  applyShopOpen = (open: boolean) => {
    shopOpen = open
    if (shopPanel) {
      shopPanel.setAttribute('data-open', open ? '1' : '0')
    }
    if (bagButton) {
      bagButton.setAttribute('aria-pressed', open ? 'true' : 'false')
    }
  }

  const applyShopMode = (mode: 'cosmetic' | 'upgrade') => {
    shopMode = mode

    shopTabButtons.forEach((btn) => {
      const active = btn.getAttribute('data-mode') === mode
      btn.setAttribute('data-active', active ? '1' : '0')
      btn.setAttribute('aria-pressed', active ? 'true' : 'false')
    })

    shopButtons.forEach((btn) => {
      const category = btn.getAttribute('data-category')
      const visible = category === mode
      btn.setAttribute('data-visible', visible ? '1' : '0')
    })
  }

  shopTabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode')
      if (mode === 'cosmetic' || mode === 'upgrade') {
        applyShopMode(mode)
      }
    })
  })

  applyShopOpen(false)
  applyShopMode(shopMode)

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

  window.addEventListener('resize', updateMiniHoverDirection)

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

  const feedButton = mounted.shadow.querySelector<HTMLButtonElement>('[data-highton="feed"]')
  feedButton?.addEventListener('click', () => {
    void (async () => {
      const current = ensureToday(await loadState())
      if (current.coins <= 0) {
        toast('달걀이 없어요. 퀘스트를 완료해 달걀을 모아주세요.')
        return
      }

      const spent = current.coins
      const expGain = spent
      const previousLevel = getLevelInfo(current.exp)

      const next: PetState = {
        ...current,
        coins: 0,
        exp: clampExp(current.exp + expGain),
        mood: improveMood(current.mood),
        counts: {
          ...current.counts,
          feed: current.counts.feed + 1,
        },
      }

      const withLog = pushLog(next, `Feed(local): -${spent} egg, +${expGain} exp`)
      await saveState(withLog)
      renderState(withLog)

      const nextLevel = getLevelInfo(withLog.exp)
      if (nextLevel.lvLabel !== previousLevel.lvLabel) {
        toast(`성장 완료! 레벨업 🎉 (+${expGain} EXP)`)
      } else {
        toast(`성장 완료! +${expGain} EXP`)
      }
    })()
  })

  gameButton?.addEventListener('click', () => {
    if (!gameOpen) {
      applyShopOpen(false)
      setGameMode('menu')
      setGameActive(false)
    }
    applyGameOpen(!gameOpen)
  })

  gameCloseButton?.addEventListener('click', () => {
    if (gameRunning) {
      endGame(false)
    }
    setGameActive(false)
    applyGameOpen(false)
  })

  type StoneEntity = {
    id: number
    x: number
    y: number
    speed: number
    width: number
    height: number
    element: HTMLImageElement
  }

  let gameRunning = false
  let gameScore = 0
  let gamePlayerX = 0
  let gameStoneGuardActive = false
  let gameReviveUsed = false
  let gameRevivePending = false
  let gameInvincibleUntil = 0
  let selectedDifficulty: GameDifficulty = 'normal'
  let activeRunDifficulty: GameDifficulty = 'normal'
  let gameFrameId: number | null = null
  let gameSpawnTimerId: number | null = null
  let lastFrameTime = 0
  let stoneSeq = 0
  let stones: StoneEntity[] = []

  const clearGameTimers = () => {
    if (gameFrameId !== null) {
      window.cancelAnimationFrame(gameFrameId)
      gameFrameId = null
    }
    if (gameSpawnTimerId !== null) {
      window.clearInterval(gameSpawnTimerId)
      gameSpawnTimerId = null
    }
  }

  const syncGameScoreUi = () => {
    if (gameScoreText) gameScoreText.textContent = String(gameScore)
  }

  const updateDifficultyUi = (difficulty: GameDifficulty) => {
    selectedDifficulty = difficulty
    const config = GAME_DIFFICULTIES[difficulty]

    gameDifficultyButtons.forEach((btn) => {
      const active = btn.getAttribute('data-level') === difficulty
      btn.setAttribute('data-active', active ? '1' : '0')
      btn.setAttribute('aria-pressed', active ? 'true' : 'false')
    })

    if (gameRewardMultiplier) {
      gameRewardMultiplier.textContent = config.rewardMultiplier.toFixed(1)
    }
    if (gameMeta) {
      gameMeta.textContent = `${config.label} · 난이도 배율 x${config.rewardMultiplier.toFixed(1)} `
    }

    void (async () => {
      const current = ensureToday(await loadState())
      const cost = getGameCost(current, difficulty)
      if (gameCostText) gameCostText.textContent = String(cost)
    })()
  }

  const moveGamePlayer = (delta: number) => {
    if (!gameArena || !gamePlayer) return
    const arenaW = gameArena.clientWidth
    const playerW = gamePlayer.clientWidth || 30
    const minX = playerW / 2
    const maxX = Math.max(minX, arenaW - playerW / 2)
    gamePlayerX = clamp(gamePlayerX + delta, minX, maxX)
    gamePlayer.style.left = `${Math.round(gamePlayerX)}px`
  }

  gameDifficultyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (gameRunning) return
      const level = btn.getAttribute('data-level')
      if (level === 'easy' || level === 'normal' || level === 'hard') {
        updateDifficultyUi(level)
      }
    })
  })

  updateDifficultyUi('normal')

  const clearStones = () => {
    stones.forEach((stone) => stone.element.remove())
    stones = []
  }

  const spawnStone = () => {
    if (!gameRunning || !gameArena || !gameStonesLayer) return
    const config = GAME_DIFFICULTIES[activeRunDifficulty]
    const arenaW = gameArena.clientWidth
    if (arenaW <= 10) return

    const giant = activeRunDifficulty === 'hard' && Math.random() < HARD_GIANT_STONE_CHANCE
    const width = giant ? 88 : 44
    const height = giant ? 68 : 34
    const minX = 4
    const maxX = Math.max(minX, arenaW - width - 4)
    const x = Math.floor(minX + Math.random() * (maxX - minX + 1))
    const y = -height - 2
    const speed = giant
      ? config.speedMin * 0.82 + Math.random() * (config.speedRange * 0.85)
      : config.speedMin + Math.random() * config.speedRange

    const element = document.createElement('img')
    element.className = 'gameFallingStone'
    element.src = mounted.shadow.querySelector<HTMLImageElement>('.gameStone')?.src || ''
    if (!element.src) {
      const fallback = mounted.shadow.querySelector<HTMLImageElement>('[data-highton="bag"] img')
      element.src = fallback?.src ?? ''
    }
    element.alt = ''
    element.setAttribute('aria-hidden', 'true')
    element.style.left = `${x}px`
    element.style.top = `${y}px`
    if (giant) {
      element.style.width = `${width}px`
      element.style.height = `${height}px`
      element.style.opacity = '0.95'
    }

    gameStonesLayer.appendChild(element)

    stones.push({
      id: ++stoneSeq,
      x,
      y,
      speed,
      width,
      height,
      element,
    })
  }

  const setGamePlayerSprite = async (dead: boolean) => {
    if (!gamePlayer) return
    const state = ensureToday(await loadState())
    const levelInfo = getLevelInfo(state.exp)
    const withHat = state.equippedItem === 'straw_hat'
    gamePlayer.src = getGamePetAssetByTier(levelInfo.tierKey, withHat, dead)
  }

  const endGame = (rewardPlayer: boolean) => {
    gameRunning = false
    gameStoneGuardActive = false
    gameRevivePending = false
    clearGameTimers()
    if (gameEnterButton) gameEnterButton.disabled = false
    if (gameMoveLeftButton) gameMoveLeftButton.disabled = false
    if (gameMoveRightButton) gameMoveRightButton.disabled = false
    gameDifficultyButtons.forEach((btn) => {
      btn.disabled = false
    })

    clearStones()
    void (async () => {
      if (!rewardPlayer) {
        await setGamePlayerSprite(false)
        setGameMode('menu')
        setGameActive(false)
        toast('게임 종료')
        return
      }

      await setGamePlayerSprite(true)

      const prev = await loadState()
      const current = ensureToday(prev)
      const config = GAME_DIFFICULTIES[activeRunDifficulty]
      const reward = Math.max(
        0,
        Math.floor(gameScore * config.rewardMultiplier * GAME_REWARD_BASE_MULTIPLIER),
      )
      const next: PetState = {
        ...current,
        goldenEggs: current.goldenEggs + reward,
        counts: {
          ...current.counts,
          game: current.counts.game + 1,
        },
      }
      const withLog = pushLog(next, `Game reward: +${reward} golden eggs (score)`)
      await saveState(withLog)
      renderState(withLog)
      await setGamePlayerSprite(true)
      setGameMode('menu')
      setGameActive(false)
      toast(
        `게임 오버! ${config.label} 난이도 점수 ${gameScore}, 황금 달걀 +${reward} (x${(config.rewardMultiplier * GAME_REWARD_BASE_MULTIPLIER).toFixed(2)})`,
      )
    })()
  }

  const runGameFrame = (now: number) => {
    if (!gameRunning || !gameArena || !gamePlayer) return
    if (lastFrameTime === 0) lastFrameTime = now
    const dt = Math.max(0.008, Math.min(0.05, (now - lastFrameTime) / 1000))
    lastFrameTime = now

    const arenaH = gameArena.clientHeight
    const playerW = gamePlayer.clientWidth || 68
    const playerH = gamePlayer.clientHeight || 68
    const collisionScale = gameStoneGuardActive ? 0.88 : 1
    const collisionW = playerW * collisionScale
    const collisionH = playerH * collisionScale
    const playerRect = {
      width: collisionW,
      height: collisionH,
      x: gamePlayerX - collisionW / 2,
      y: arenaH - collisionH - 14,
    }

    for (const stone of stones) {
      stone.y += stone.speed * dt
      stone.element.style.top = `${Math.round(stone.y)}px`
    }

    let collided = false
    const invincible = now < gameInvincibleUntil
    stones = stones.filter((stone) => {
      const sx = stone.x
      const sy = stone.y
      const hit =
        sx < playerRect.x + playerRect.width &&
        sx + stone.width > playerRect.x &&
        sy < playerRect.y + playerRect.height &&
        sy + stone.height > playerRect.y

      if (hit && invincible) {
        stone.element.remove()
        return false
      }

      if (hit) {
        collided = true
        stone.element.remove()
        return false
      }

      if (sy > arenaH + 4) {
        stone.element.remove()
        gameScore += GAME_DIFFICULTIES[activeRunDifficulty].scoreStep
        syncGameScoreUi()
        return false
      }

      return true
    })

    if (collided) {
      if (!gameReviveUsed && !gameRevivePending) {
        gameRevivePending = true
        void (async () => {
          const prev = await loadState()
          const current = ensureToday(prev)

          if (current.goldenEggs < GAME_REVIVE_COST) {
            gameRevivePending = false
            endGame(true)
            return
          }

          const revived: PetState = {
            ...current,
            goldenEggs: current.goldenEggs - GAME_REVIVE_COST,
          }
          const withLog = pushLog(revived, `Game revive: -${GAME_REVIVE_COST} golden eggs`)
          await saveState(withLog)
          renderState(withLog)

          gameReviveUsed = true
          gameRevivePending = false
          gameInvincibleUntil = performance.now() + 1200
          clearStones()
          toast(`재도전 보험 발동! 황금 달걀 -${GAME_REVIVE_COST}`)
          gameFrameId = window.requestAnimationFrame(runGameFrame)
        })()
        return
      }

      endGame(true)
      return
    }

    gameFrameId = window.requestAnimationFrame(runGameFrame)
  }

  const startStoneGame = async () => {
    if (!gameArena || !gamePlayer || !gameStonesLayer) return
    if (gameRunning) return

    const prev = await loadState()
    const current = ensureToday(prev)
    activeRunDifficulty = selectedDifficulty
    const config = GAME_DIFFICULTIES[activeRunDifficulty]
    const gameCost = getGameCost(current, activeRunDifficulty)
    gameStoneGuardActive = hasItem(current, 'stone_guard')
    gameReviveUsed = false
    gameRevivePending = false
    gameInvincibleUntil = 0
    if (current.coins < gameCost) {
      toast(`달걀이 부족해요. 돌 피하기는 달걀 ${gameCost}개가 필요해요.`)
      return
    }

    const paidState: PetState = {
      ...current,
      coins: current.coins - gameCost,
    }
    const withCostLog = pushLog(paidState, `Game cost: -${gameCost} eggs`)
    await saveState(withCostLog)
    renderState(withCostLog)

    clearGameTimers()
    clearStones()
    gameScore = 0
    syncGameScoreUi()
    gameRunning = true
    lastFrameTime = 0
    setGameMode('play')
    setGameActive(true)

    const arenaW = gameArena.clientWidth
    gamePlayerX = Math.max(20, Math.floor(arenaW / 2))
    gamePlayer.style.left = `${gamePlayerX}px`
    await setGamePlayerSprite(false)

    if (gameEnterButton) gameEnterButton.disabled = true
    gameDifficultyButtons.forEach((btn) => {
      btn.disabled = true
    })

    gameSpawnTimerId = window.setInterval(spawnStone, config.spawnMs)
    gameFrameId = window.requestAnimationFrame(runGameFrame)
    toast(`${config.label} 난이도 시작! 좌우 버튼/키보드 화살표로 돌을 피하세요.`)
  }

  gameEnterButton?.addEventListener('click', () => {
    void startStoneGame()
  })

  gameMoveLeftButton?.addEventListener('click', () => {
    moveGamePlayer(-20)
  })

  gameMoveRightButton?.addEventListener('click', () => {
    moveGamePlayer(20)
  })

  window.addEventListener('keydown', (event) => {
    if (!gameOpen) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveGamePlayer(-16)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveGamePlayer(16)
    }
  })

  bagButton?.addEventListener('click', () => {
    if (!shopOpen) {
      applyGameOpen(false)
      setGameActive(false)
    }
    applyShopOpen(!shopOpen)
  })

  shopCloseButton?.addEventListener('click', () => {
    applyShopOpen(false)
  })

  shopButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemKey = btn.getAttribute('data-item')
      if (!isShopItemKey(itemKey)) return

      void (async () => {
        const item = SHOP_ITEMS.find((x) => x.key === itemKey)
        if (!item) return

        const prev = await loadState()
        const current = ensureToday(prev)

        if (item.buffKey) {
          if (current.goldenEggs < item.price) {
            toast('황금 달걀이 부족해요')
            return
          }

          const now = Date.now()
          const nextUntil = Math.max(now, current.activeBuffs[item.buffKey]) + BUFF_DURATION_MS
          const next: PetState = {
            ...current,
            goldenEggs: current.goldenEggs - item.price,
            activeBuffs: {
              ...current.activeBuffs,
              [item.buffKey]: nextUntil,
            },
          }

          const withLog = pushLog(next, `Buff: ${item.name} +24h (-${item.price} golden eggs)`)
          await saveState(withLog)
          renderState(withLog)
          toast(`${item.name} 적용! (남은 ${formatRemaining(nextUntil)})`)
          return
        }

        if (!isAccessoryKey(item.key)) return

        const accessoryKey = item.key

        const owned = current.ownedItems.includes(accessoryKey)

        if (!owned) {
          if (current.goldenEggs < item.price) {
            toast('황금 달걀이 부족해요')
            return
          }

          const next: PetState = {
            ...current,
            goldenEggs: current.goldenEggs - item.price,
            ownedItems: [...current.ownedItems, accessoryKey],
            equippedItem: item.passive ? current.equippedItem : accessoryKey,
          }

          const withLog = pushLog(next, `Shop: bought ${item.name} -${item.price} golden eggs`)
          await saveState(withLog)
          renderState(withLog)
          toast(`${item.name} 구매 완료!`)
          return
        }

        if (item.passive) {
          toast(`${item.name}는 패시브 아이템이라 항상 적용돼요!`)
          return
        }

        const equipNext: AccessoryKey | null =
          current.equippedItem === accessoryKey ? null : accessoryKey
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

        const questDef = getQuestDefinition(current, key)

        const nextCounts = { ...current.counts }
        nextCounts[questDef.metric] = Math.max(0, nextCounts[questDef.metric] - questDef.target)

        const luckyBonus = hasItem(current, 'lucky_clover') ? 0.2 : 0
        const buffBonus = isBuffActive(current, 'questBoost') ? 0.1 : 0
        const totalReward = Math.max(
          1,
          Math.floor(questDef.rewardCoins * (1 + luckyBonus + buffBonus)),
        )
        const bonusReward = totalReward - questDef.rewardCoins

        const next: PetState = {
          ...current,
          coins: current.coins + totalReward,
          counts: nextCounts,
        }

        const withLog = pushLog(next, `Quest claimed: ${key} +${totalReward} eggs`)
        await saveState(withLog)
        renderState(withLog)
        toast(
          bonusReward > 0
            ? `보상 받기 완료! +${totalReward} (보너스 +${bonusReward})`
            : `보상 받기 완료! +${totalReward}`,
        )
      })()
    })
  })

  const rerollButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="q_reroll"]',
  )
  rerollButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-quest')
      if (key !== 'commit1' && key !== 'pr1' && key !== 'review1') return

      void (async () => {
        const prev = await loadState()
        const current = ensureToday(prev)
        if (current.goldenEggs < QUEST_REROLL_COST) {
          toast(`황금 달걀 ${QUEST_REROLL_COST}개가 필요해요.`)
          return
        }

        const nextDefs = current.questDefs.map((quest) =>
          quest.key === key ? rerollQuestDefinition(current, key) : quest,
        )

        const next: PetState = {
          ...current,
          goldenEggs: current.goldenEggs - QUEST_REROLL_COST,
          questDefs: nextDefs,
        }

        const withLog = pushLog(next, `Quest reroll: ${key} (-${QUEST_REROLL_COST} golden eggs)`)
        await saveState(withLog)
        renderState(withLog)
        toast('퀘스트를 새로 교체했어요!')
      })()
    })
  })
}

const ensureMounted = () => {
  mountWidget()
  const root = document.getElementById(ROOT_ID)
  if (!root) return

  const shadow = root.shadowRoot
  const hasNewGameUi =
    !!shadow?.querySelector('[data-highton="gameEnter"]') &&
    !!shadow?.querySelector('[data-highton="gameArena"]') &&
    !!shadow?.querySelector('[data-highton="gamePlayer"]')

  if (!hasNewGameUi) {
    unmountWidget()
    mountWidget()
    if (!document.getElementById(ROOT_ID)) return
  }

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
      const next = createDefaultState()
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

  if (message.type === 'HIGHTON_AUTH_CHANGED') {
    void (async () => {
      const authenticated = (message as { authenticated?: unknown }).authenticated === true
      if (!authenticated) {
        applyAuthUi(false)
        disconnectQuestSocket()
        return
      }

      applyAuthUi(true)
      await syncStatusFromBackend(true)
      await connectQuestSocket()
    })()
  }
})

if (DEBUG) {
  console.log('[Highton] content script loaded:', window.location.href)
}
