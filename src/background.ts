import {
  AUTH_STORAGE_KEY,
  BACKEND_BASE_URL,
  type AuthStatusData,
  type ApiErrorPayload,
  type AuthSession,
  type FeedResponse,
  type GameResultResponse,
  type OrgItem,
  type RepoItem,
  type RuntimeRequest,
  type RuntimeResponse,
  type StatusResponse,
  type WebhookRegisterResponse,
} from './integration'

type NullableAuthSession = AuthSession | null

const OAUTH_LOGIN_URL = `${BACKEND_BASE_URL}/oauth/github/login`
const OAUTH_CALLBACK_URL = `${BACKEND_BASE_URL}/oauth/github/callback`

const normalizeLevel = (level: unknown): AuthSession['level'] | null => {
  if (level === 'NEWBIE' || level === '입문') return 'NEWBIE'
  if (level === 'JUNIOR' || level === '주니어') return 'JUNIOR'
  if (level === 'MIDDLE' || level === '미들') return 'MIDDLE'
  if (level === 'SENIOR' || level === '시니어') return 'SENIOR'
  return null
}

const parseAuthSessionPayload = (payload: unknown): AuthSession | null => {
  if (!payload || typeof payload !== 'object') return null

  const token = (payload as { token?: unknown }).token
  const username = (payload as { username?: unknown }).username
  const xp = (payload as { xp?: unknown }).xp
  const level = normalizeLevel((payload as { level?: unknown }).level)

  if (
    typeof token !== 'string' ||
    typeof username !== 'string' ||
    typeof xp !== 'number' ||
    !level
  ) {
    return null
  }

  return { token, username, xp, level }
}

const getAuthSession = async (): Promise<NullableAuthSession> => {
  const stored = await chrome.storage.local.get([AUTH_STORAGE_KEY])
  const raw = stored[AUTH_STORAGE_KEY] as unknown
  if (!raw || typeof raw !== 'object') return null

  const token = (raw as { token?: unknown }).token
  const username = (raw as { username?: unknown }).username
  const xp = (raw as { xp?: unknown }).xp
  const level = (raw as { level?: unknown }).level
  const normalizedLevel = normalizeLevel(level)

  if (
    typeof token !== 'string' ||
    typeof username !== 'string' ||
    typeof xp !== 'number' ||
    normalizedLevel === null
  ) {
    return null
  }

  return { token, username, xp, level: normalizedLevel }
}

const setAuthSession = async (session: AuthSession) => {
  await chrome.storage.local.set({ [AUTH_STORAGE_KEY]: session })
}

const clearAuthSession = async () => {
  await chrome.storage.local.remove([AUTH_STORAGE_KEY])
}

const persistAuthSession = async (session: AuthSession) => {
  await setAuthSession(session)
  await notifyGithubTabsAuthChanged(true)
}

const notifyGithubTabsAuthChanged = async (authenticated: boolean) => {
  const tabs = await chrome.tabs.query({ url: ['*://github.com/*', '*://*.github.com/*'] })
  await Promise.all(
    tabs
      .filter((tab) => typeof tab.id === 'number')
      .map((tab) =>
        chrome.tabs
          .sendMessage(tab.id as number, { type: 'HIGHTON_AUTH_CHANGED', authenticated })
          .catch(() => void 0),
      ),
  )
}

const parseApiError = async (res: Response): Promise<{ message: string; status: number }> => {
  try {
    const data = (await res.json()) as Partial<ApiErrorPayload>
    const message = typeof data.message === 'string' ? data.message : `HTTP ${res.status}`
    return { message, status: res.status }
  } catch {
    return { message: `HTTP ${res.status}`, status: res.status }
  }
}

const fetchWithAuth = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const session = await getAuthSession()
  if (!session) {
    throw new Error('로그인이 필요해요. 먼저 GitHub 로그인 해주세요.')
  }

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.token}`)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(`${BACKEND_BASE_URL}${path}`, {
      ...init,
      headers,
    })
  } catch {
    throw new Error('서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.')
  }

  if (!res.ok) {
    const { message, status } = await parseApiError(res)
    if (status === 401 || status === 403) {
      await clearAuthSession()
      await notifyGithubTabsAuthChanged(false)
    }
    const err = new Error(message) as Error & { status?: number }
    err.status = status
    throw err
  }

  return (await res.json()) as T
}

const parseJsonText = (text: string): unknown => {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const candidate = trimmed.slice(start, end + 1)
      try {
        return JSON.parse(candidate)
      } catch {
        return null
      }
    }
    return null
  }
}

const parseSessionFromLooseText = (text: string): AuthSession | null => {
  const tokenMatch = text.match(/"token"\s*:\s*"([^"]+)"/)
  const usernameMatch = text.match(/"username"\s*:\s*"([^"]+)"/)
  const xpMatch = text.match(/"xp"\s*:\s*(\d+)/)
  const levelMatch = text.match(/"level"\s*:\s*"([^"]+)"/)

  if (!tokenMatch || !usernameMatch || !xpMatch || !levelMatch) return null

  return parseAuthSessionPayload({
    token: tokenMatch[1],
    username: usernameMatch[1],
    xp: Number(xpMatch[1]),
    level: levelMatch[1],
  })
}

const tryReadSessionFromCallbackTab = async (tabId: number): Promise<AuthSession | null> => {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const bodyText = document.body?.innerText ?? ''
        const bodyRaw = document.body?.textContent ?? ''
        const docText = document.documentElement?.innerText ?? ''
        const docRaw = document.documentElement?.textContent ?? ''
        const preText = Array.from(document.querySelectorAll('pre'))
          .map((el) => el.textContent ?? '')
          .join('\n')

        return [bodyText, bodyRaw, docText, docRaw, preText]
      },
    })

    for (const frameResult of result) {
      const texts = frameResult.result
      if (!Array.isArray(texts)) continue

      for (const text of texts) {
        if (typeof text !== 'string' || text.trim().length === 0) continue

        const parsed = parseJsonText(text)
        const parsedSession = parseAuthSessionPayload(parsed)
        if (parsedSession) return parsedSession

        const looseSession = parseSessionFromLooseText(text)
        if (looseSession) return looseSession
      }
    }

    return null
  } catch {
    return null
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const waitForSessionFromCallbackTab = async (tabId: number): Promise<AuthSession | null> => {
  for (let i = 0; i < 60; i += 1) {
    const session = await tryReadSessionFromCallbackTab(tabId)
    if (session) return session
    await sleep(200)
  }
  return null
}

const startOAuthLogin = async (): Promise<AuthSession> => {
  const [previousTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  const previousTabId = typeof previousTab?.id === 'number' ? previousTab.id : null

  const tab = await chrome.tabs.create({ url: OAUTH_LOGIN_URL, active: true })
  if (typeof tab.id !== 'number') {
    throw new Error('로그인 탭을 열 수 없어요.')
  }

  const loginTabId = tab.id

  return await new Promise<AuthSession>((resolve, reject) => {
    let done = false
    let handlingCallback = false

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.tabs.onRemoved.removeListener(onRemoved)
      clearTimeout(timeoutId)
    }

    const settle = (cb: () => void) => {
      if (done) return
      done = true
      cleanup()
      cb()
    }

    const onRemoved = (tabId: number) => {
      if (tabId !== loginTabId) return
      settle(() => reject(new Error('로그인 창이 닫혔어요.')))
    }

    const onUpdated = (
      tabId: number,
      changeInfo: chrome.tabs.OnUpdatedInfo,
      updatedTab: chrome.tabs.Tab,
    ) => {
      if (tabId !== loginTabId) return
      const currentUrl = changeInfo.url ?? updatedTab.url
      if (!currentUrl || !currentUrl.startsWith(OAUTH_CALLBACK_URL)) return
      if (handlingCallback) return

      const isCallbackReady = changeInfo.status === 'complete' || updatedTab.status === 'complete'
      if (!isCallbackReady) return

      handlingCallback = true

      void (async () => {
        try {
          if (previousTabId !== null) {
            await chrome.tabs.update(previousTabId, { active: true }).catch(() => void 0)
          }

          const fromTab = await waitForSessionFromCallbackTab(loginTabId)

          if (!fromTab) {
            throw new Error(
              '로그인 콜백 데이터를 읽지 못했어요. 확장 프로그램을 새로고침 후 다시 시도해주세요.',
            )
          }

          await persistAuthSession(fromTab)
          await chrome.tabs.update(loginTabId, { url: 'about:blank' }).catch(() => void 0)
          await chrome.tabs.remove(loginTabId).catch(() => void 0)
          settle(() => resolve(fromTab))
        } catch (error) {
          const message =
            error instanceof Error ? error.message : '로그인 처리 중 오류가 발생했어요.'
          settle(() => reject(new Error(message)))
        } finally {
          handlingCallback = false
        }
      })()
    }

    const timeoutId = setTimeout(() => {
      settle(() => reject(new Error('로그인 시간이 초과됐어요. 다시 시도해주세요.')))
    }, 180_000)

    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.onRemoved.addListener(onRemoved)
  })
}

const withRuntimeResponse = async <T>(work: () => Promise<T>): Promise<RuntimeResponse<T>> => {
  try {
    const data = await work()
    return { ok: true, data }
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'
    const status = (error as { status?: unknown }).status
    return {
      ok: false,
      error: message,
      status: typeof status === 'number' ? status : undefined,
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('Chick hub extension installed')
})

chrome.runtime.onMessage.addListener((message: RuntimeRequest, _sender, sendResponse) => {
  void (async () => {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      sendResponse({
        ok: false,
        error: '유효하지 않은 요청이에요.',
      } satisfies RuntimeResponse<never>)
      return
    }

    if (message.type === 'HIGHTON_AUTH_START') {
      sendResponse(await withRuntimeResponse(startOAuthLogin))
      return
    }

    if (message.type === 'HIGHTON_AUTH_STATUS') {
      sendResponse(
        await withRuntimeResponse(async () => {
          const session = await getAuthSession()
          const data: AuthStatusData = {
            authenticated: !!session,
            username: session?.username ?? null,
            level: session?.level ?? null,
          }
          return data
        }),
      )
      return
    }

    if (message.type === 'HIGHTON_AUTH_LOGOUT') {
      sendResponse(
        await withRuntimeResponse(async () => {
          await clearAuthSession()
          await notifyGithubTabsAuthChanged(false)
          return { success: true }
        }),
      )
      return
    }

    if (message.type === 'HIGHTON_API_GET_STATUS') {
      sendResponse(await withRuntimeResponse(() => fetchWithAuth<StatusResponse>('/api/me/status')))
      return
    }

    if (message.type === 'HIGHTON_API_FEED') {
      sendResponse(
        await withRuntimeResponse(() =>
          fetchWithAuth<FeedResponse>('/api/me/feed', {
            method: 'POST',
          }),
        ),
      )
      return
    }

    if (message.type === 'HIGHTON_API_GET_ORGS') {
      sendResponse(await withRuntimeResponse(() => fetchWithAuth<OrgItem[]>('/api/orgs')))
      return
    }

    if (message.type === 'HIGHTON_API_GET_REPOS') {
      sendResponse(
        await withRuntimeResponse(() =>
          fetchWithAuth<RepoItem[]>(`/api/orgs/${encodeURIComponent(message.org)}/repos`),
        ),
      )
      return
    }

    if (message.type === 'HIGHTON_API_REGISTER_WEBHOOK') {
      sendResponse(
        await withRuntimeResponse(async () => {
          try {
            return await fetchWithAuth<WebhookRegisterResponse>('/api/webhook/register', {
              method: 'POST',
              body: JSON.stringify({ owner: message.owner, repo: message.repo }),
            })
          } catch (error) {
            const status = (error as { status?: unknown }).status
            const messageText = error instanceof Error ? error.message : ''
            const alreadyExists =
              messageText.includes('Hook already exists') ||
              messageText.toLowerCase().includes('already exists') ||
              status === 409

            if (alreadyExists) {
              return {
                id: -1,
                type: 'Repository',
                name: 'web',
                active: true,
                events: ['issues', 'member', 'pull_request', 'push'],
              }
            }
            throw error
          }
        }),
      )
      return
    }

    if (message.type === 'HIGHTON_API_GAME_RESULT') {
      sendResponse(
        await withRuntimeResponse(() =>
          fetchWithAuth<GameResultResponse>('/api/game/result', {
            method: 'POST',
            body: JSON.stringify({ result: message.result }),
          }),
        ),
      )
      return
    }

    sendResponse({ ok: false, error: '지원하지 않는 요청이에요.' } satisfies RuntimeResponse<never>)
  })()

  return true
})
