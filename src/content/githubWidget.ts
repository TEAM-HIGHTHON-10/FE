import {
  DEBUG,
  HAT_ANCHORS,
  MINIMIZE_KEY,
  POSITION_KEY,
  QUESTS,
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
  type FeedResponse,
  type QuestCompletedEvent,
  type RuntimeResponse,
  type StatusResponse,
} from '../integration'
import type { PetState, QuestKey } from './widget'

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

const applyAuthUi = (authenticated: boolean) => {
  const mounted = getMounted()
  if (!mounted) return

  mounted.panel.setAttribute('data-highton-auth', authenticated ? '1' : '0')
  if (!authenticated) {
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

const applyBackendStatus = async (status: StatusResponse | FeedResponse, logText: string) => {
  const prev = await loadState()
  const current = ensureToday(prev)
  const serverEggs = Math.max(0, Math.floor(status.eggCount))
  const lockedEggs = Math.min(Math.max(0, current.lockedEggs), serverEggs)
  const next: PetState = {
    ...current,
    coins: Math.max(0, serverEggs - lockedEggs),
    lockedEggs,
    exp: clampExp(toUiExp(status.level, status.currentLevelXp)),
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
      data = JSON.parse(event.data) as QuestCompletedEvent
    } catch {
      return
    }

    if (!data || data.type !== 'QUEST_COMPLETED') return

    void (async () => {
      const prev = await loadState()
      const current = ensureToday(prev)
      const serverTotalEggs = Math.max(0, Math.floor(data.totalEggs))
      const earned = Math.max(0, Math.floor(data.eggsEarned))
      const unitReward = QUESTS.commit1.rewardCoins
      const claimUnits = Math.max(1, Math.floor(earned / unitReward))

      const nextCounts = {
        ...current.counts,
      }

      let lockDelta = 0

      if (data.questType === 'COMMIT') {
        nextCounts.commit += claimUnits
        lockDelta += earned
      }
      if (data.questType === 'PR') {
        nextCounts.pr += claimUnits
        lockDelta += earned
      }
      if (data.questType === 'ISSUE' || data.questType === 'REVIEW') {
        nextCounts.review += claimUnits
        lockDelta += earned
      }

      const nextLockedEggs = Math.min(serverTotalEggs, Math.max(0, current.lockedEggs + lockDelta))

      const next: PetState = {
        ...current,
        coins: Math.max(0, serverTotalEggs - nextLockedEggs),
        lockedEggs: nextLockedEggs,
        counts: nextCounts,
      }
      if (data.questType === 'GAME') {
        next.goldenEggs = current.goldenEggs + Math.max(0, data.eggsEarned)
      }
      const withLog = pushLog(next, `Quest complete: ${data.questType} (claim available)`)
      await saveState(withLog)
      renderState(withLog)
      if (data.questType === 'COMMIT') toast('커밋 퀘스트 완료! 받기를 눌러 코인을 받으세요.')
      else if (data.questType === 'PR') toast('PR 퀘스트 완료! 받기를 눌러 코인을 받으세요.')
      else if (data.questType === 'ISSUE' || data.questType === 'REVIEW') {
        toast('이슈 퀘스트 완료! 받기를 눌러 코인을 받으세요.')
      } else if (data.questType === 'GAME') {
        toast(`게임 승리! 황금 달걀 +${data.eggsEarned}`)
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

    if (title) title.textContent = QUESTS[key].title
    if (reward) reward.textContent = String(QUESTS[key].rewardCoins)
    if (claim) {
      claim.disabled = !done
      claim.textContent = '받기'
    }
  }

  applyQuestRow('commit1')
  applyQuestRow('pr1')
  applyQuestRow('review1')

  const claimableQuestCount = Math.max(
    0,
    normalized.counts.commit + normalized.counts.pr + normalized.counts.review,
  )
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
    const prevRect = mounted.panel.getBoundingClientRect()
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
  const shopCloseButton = mounted.shadow.querySelector<HTMLButtonElement>(
    '[data-highton="shopClose"]',
  )
  const shopButtons = mounted.shadow.querySelectorAll<HTMLButtonElement>(
    '[data-highton="shop-item"]',
  )

  let shopOpen = false
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
      const statusResponse = await runtimeRequest<StatusResponse>({
        type: 'HIGHTON_API_GET_STATUS',
      })
      if (!statusResponse.ok) {
        if (statusResponse.status === 401 || statusResponse.status === 403) {
          await handleAuthExpired('로그인이 만료되었어요. 다시 로그인해주세요.')
          return
        }
        toast(statusResponse.error)
        return
      }

      if (statusResponse.data.eggCount <= 0) {
        await applyBackendStatus(statusResponse.data, 'Sync: no eggs to feed')
        toast('알이 없어요. 퀘스트를 완료해 알을 모아주세요.')
        return
      }

      const local = ensureToday(await loadState())
      const lockedEggs = Math.min(
        Math.max(0, local.lockedEggs),
        Math.max(0, statusResponse.data.eggCount),
      )
      const spendableEggs = Math.max(0, statusResponse.data.eggCount - lockedEggs)
      if (spendableEggs <= 0) {
        await applyBackendStatus(statusResponse.data, 'Sync: all eggs are locked by quests')
        toast('먼저 퀘스트에서 보상을 받아야 성장을 할 수 있어요.')
        return
      }

      const response = await runtimeRequest<FeedResponse>({ type: 'HIGHTON_API_FEED' })
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await handleAuthExpired('로그인이 만료되었어요. 다시 로그인해주세요.')
          return
        }
        toast(response.error)
        return
      }

      await applyBackendStatus(
        response.data,
        `Feed: consumed=${response.data.eggsConsumed} leveledUp=${response.data.leveledUp}`,
      )
      if (response.data.leveledUp) {
        toast(`성장 완료! 레벨업 🎉 (-${response.data.eggsConsumed} eggs)`)
      } else {
        toast(`성장 완료! -${response.data.eggsConsumed} eggs`)
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

  const moveGamePlayer = (delta: number) => {
    if (!gameArena || !gamePlayer) return
    const arenaW = gameArena.clientWidth
    const playerW = gamePlayer.clientWidth || 38
    const minX = playerW / 2
    const maxX = Math.max(minX, arenaW - playerW / 2)
    gamePlayerX = clamp(gamePlayerX + delta, minX, maxX)
    gamePlayer.style.left = `${Math.round(gamePlayerX)}px`
  }

  const clearStones = () => {
    stones.forEach((stone) => stone.element.remove())
    stones = []
  }

  const spawnStone = () => {
    if (!gameRunning || !gameArena || !gameStonesLayer) return
    const arenaW = gameArena.clientWidth
    if (arenaW <= 10) return

    const width = 44
    const height = 34
    const minX = 4
    const maxX = Math.max(minX, arenaW - width - 4)
    const x = Math.floor(minX + Math.random() * (maxX - minX + 1))
    const y = -height - 2
    const speed = 155 + Math.random() * 115

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
    clearGameTimers()
    if (gameEnterButton) gameEnterButton.disabled = false
    if (gameMoveLeftButton) gameMoveLeftButton.disabled = false
    if (gameMoveRightButton) gameMoveRightButton.disabled = false

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
      const reward = Math.max(0, Math.floor(gameScore))
      const next: PetState = {
        ...current,
        goldenEggs: current.goldenEggs + reward,
      }
      const withLog = pushLog(next, `Game reward: +${reward} golden eggs (score)`)
      await saveState(withLog)
      renderState(withLog)
      await setGamePlayerSprite(true)
      setGameMode('menu')
      setGameActive(false)
      toast(`게임 오버! 점수 ${reward}, 황금 달걀 +${reward}`)
    })()
  }

  const runGameFrame = (now: number) => {
    if (!gameRunning || !gameArena || !gamePlayer) return
    if (lastFrameTime === 0) lastFrameTime = now
    const dt = Math.max(0.008, Math.min(0.05, (now - lastFrameTime) / 1000))
    lastFrameTime = now

    const arenaH = gameArena.clientHeight
    const playerW = gamePlayer.clientWidth || 82
    const playerH = gamePlayer.clientHeight || 82
    const playerRect = {
      width: playerW,
      height: playerH,
      x: gamePlayerX - playerW / 2,
      y: arenaH - playerH - 14,
    }

    for (const stone of stones) {
      stone.y += stone.speed * dt
      stone.element.style.top = `${Math.round(stone.y)}px`
    }

    let collided = false
    stones = stones.filter((stone) => {
      const sx = stone.x
      const sy = stone.y
      const hit =
        sx < playerRect.x + playerRect.width &&
        sx + stone.width > playerRect.x &&
        sy < playerRect.y + playerRect.height &&
        sy + stone.height > playerRect.y

      if (hit) {
        collided = true
        stone.element.remove()
        return false
      }

      if (sy > arenaH + 4) {
        stone.element.remove()
        gameScore += 10
        syncGameScoreUi()
        return false
      }

      return true
    })

    if (collided) {
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
    if (current.coins < GAME_PLAY_COST) {
      toast(`달걀이 부족해요. 돌 피하기는 달걀 ${GAME_PLAY_COST}개가 필요해요.`)
      return
    }

    const paidState: PetState = {
      ...current,
      coins: current.coins - GAME_PLAY_COST,
    }
    const withCostLog = pushLog(paidState, `Game cost: -${GAME_PLAY_COST} eggs`)
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

    gameSpawnTimerId = window.setInterval(spawnStone, 540)
    gameFrameId = window.requestAnimationFrame(runGameFrame)
    toast('게임 시작! 좌우 버튼/키보드 화살표로 돌을 피하세요.')
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
      if (itemKey !== 'straw_hat') return

      void (async () => {
        const item = SHOP_ITEMS.find((x) => x.key === itemKey)
        if (!item) return

        const prev = await loadState()
        const current = ensureToday(prev)
        const owned = current.ownedItems.includes(itemKey)

        if (!owned) {
          if (current.goldenEggs < item.price) {
            toast('황금 달걀이 부족해요')
            return
          }

          const next: PetState = {
            ...current,
            goldenEggs: current.goldenEggs - item.price,
            ownedItems: [...current.ownedItems, itemKey],
            equippedItem: itemKey,
          }

          const withLog = pushLog(next, `Shop: bought ${item.name} -${item.price} golden eggs`)
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

        const nextCounts = { ...current.counts }
        if (key === 'commit1') {
          nextCounts.commit = Math.max(0, nextCounts.commit - 1)
        } else if (key === 'pr1') {
          nextCounts.pr = Math.max(0, nextCounts.pr - 1)
        } else {
          nextCounts.review = Math.max(0, nextCounts.review - 1)
        }

        const released = Math.min(QUESTS[key].rewardCoins, current.lockedEggs)

        const next: PetState = {
          ...current,
          coins: current.coins + released,
          lockedEggs: Math.max(0, current.lockedEggs - QUESTS[key].rewardCoins),
          counts: nextCounts,
        }

        const withLog = pushLog(next, `Quest claimed: ${key} +${released} spendable eggs`)
        await saveState(withLog)
        renderState(withLog)
        toast(`보상 받기 완료! +${released}`)
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
