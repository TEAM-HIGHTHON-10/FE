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
  type BackendLevel,
  type FeedResponse,
  type GameResultResponse,
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

const handleAuthExpired = async (message: string) => {
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
  if (miniGoldEggs) miniGoldEggs.textContent = formatCompactNumber(normalized.goldenEggs)
  if (miniCoins) miniCoins.textContent = formatCompactNumber(normalized.coins)
  if (miniExp) miniExp.textContent = `${info.expInLevel} / ${info.expMax}`
  if (feedCost) feedCost.textContent = formatCompactNumber(normalized.coins)
  if (feedButton) feedButton.disabled = normalized.coins <= 0
  if (miniPet) {
    miniPet.src = getPetAssetByTier(info.tierKey)
    miniPet.alt = `${info.tierKey} pet`
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
  panel.innerHTML = createWidgetHtml()

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
  void syncStatusFromBackend(false)
  void connectQuestSocket()

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
  const gamePlayButton = mounted.shadow.querySelector<HTMLElement>('[data-highton="gamePlay"]')
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

  applyGameOpen = (open: boolean) => {
    gameOpen = open
    if (gamePanel) {
      gamePanel.setAttribute('data-open', open ? '1' : '0')
    }
    if (gameButton) {
      gameButton.setAttribute('aria-pressed', open ? 'true' : 'false')
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
        toast('먼저 퀘스트에서 보상을 받아야 밥주기를 할 수 있어요.')
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
        toast(`밥주기 완료! 레벨업 🎉 (-${response.data.eggsConsumed} eggs)`)
      } else {
        toast(`밥주기 완료! -${response.data.eggsConsumed} eggs`)
      }
    })()
  })

  gameButton?.addEventListener('click', () => {
    if (!gameOpen) {
      applyShopOpen(false)
    }
    applyGameOpen(!gameOpen)
  })

  gameCloseButton?.addEventListener('click', () => {
    applyGameOpen(false)
  })

  const playStoneDodge = async () => {
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

    const response = await runtimeRequest<GameResultResponse>({
      type: 'HIGHTON_API_GAME_RESULT',
      result: 'SUCCESS',
    })

    if (!response.ok) {
      const fallbackReward = 10
      const fallbackState: PetState = {
        ...withCostLog,
        goldenEggs: withCostLog.goldenEggs + fallbackReward,
      }
      const withLog = pushLog(
        fallbackState,
        `Game reward (fallback): +${fallbackReward} golden eggs`,
      )
      await saveState(withLog)
      renderState(withLog)
      toast(`돌 피하기 완료! 달걀 -${GAME_PLAY_COST}, 황금 달걀 +${fallbackReward}`)
      return
    }

    const reward = Math.max(0, Math.floor(response.data.eggs_earned))
    const next: PetState = {
      ...withCostLog,
      goldenEggs: withCostLog.goldenEggs + reward,
    }
    const withLog = pushLog(next, `Game reward: +${reward} golden eggs`)
    await saveState(withLog)
    renderState(withLog)
    toast(`돌 피하기 완료! 달걀 -${GAME_PLAY_COST}, 황금 달걀 +${reward}`)
  }

  gamePlayButton?.addEventListener('click', () => {
    void playStoneDodge()
  })

  gamePlayButton?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    void playStoneDodge()
  })

  bagButton?.addEventListener('click', () => {
    if (!shopOpen) {
      applyGameOpen(false)
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
        disconnectQuestSocket()
        return
      }

      await syncStatusFromBackend(true)
      await connectQuestSocket()
    })()
  }
})

if (DEBUG) {
  console.log('[Highton] content script loaded:', window.location.href)
}
