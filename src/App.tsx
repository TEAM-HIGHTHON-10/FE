import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import styled from '@emotion/styled'
import { colors, radius, spacing, typography } from './design-system'
import type {
  AuthStatusData,
  BackendLevel,
  OrgItem,
  RepoItem,
  RuntimeResponse,
} from './integration'

const sendRuntime = async <T,>(message: unknown): Promise<RuntimeResponse<T>> => {
  return (await chrome.runtime.sendMessage(message)) as RuntimeResponse<T>
}

type ActionTone = 'indigo' | 'emerald' | 'amber' | 'slate'

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ActionTone
  children: ReactNode
}

const ActionButton = ({ tone = 'indigo', children, ...props }: ActionButtonProps) => {
  return (
    <ButtonShell type="button" {...props} tone={tone}>
      {children}
    </ButtonShell>
  )
}

export const App = () => {
  const TEST_COIN_AMOUNT = 200
  const [auth, setAuth] = useState<AuthStatusData>({
    authenticated: false,
    username: null,
    level: null,
  })
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [repos, setRepos] = useState<RepoItem[]>([])
  const [selectedOrg, setSelectedOrg] = useState('')
  const [selectedRepoFullName, setSelectedRepoFullName] = useState('')
  const [statusText, setStatusText] = useState('')

  const refreshAuthStatus = async () => {
    const response = await sendRuntime<AuthStatusData>({ type: 'HIGHTON_AUTH_STATUS' })
    if (!response.ok) {
      setStatusText(response.error)
      return
    }

    setAuth(response.data)
  }

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const response = await sendRuntime<AuthStatusData>({ type: 'HIGHTON_AUTH_STATUS' })
      if (cancelled) return

      if (!response.ok) {
        setStatusText(response.error)
        return
      }

      setAuth(response.data)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const handleToggleWidget = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.tabs.sendMessage(tab.id, { type: 'HIGHTON_TOGGLE_WIDGET' })
  }

  const handleResetState = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.tabs.sendMessage(tab.id, {
      type: 'HIGHTON_RESET_STATE',
    })
  }

  const handleAddTestCoins = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.tabs.sendMessage(tab.id, {
      type: 'HIGHTON_ADD_TEST_COINS',
      amount: TEST_COIN_AMOUNT,
    })
  }

  const handleLogin = async () => {
    setStatusText('GitHub 로그인 창을 여는 중...')
    const response = await sendRuntime<{ username: string; level: BackendLevel }>({
      type: 'HIGHTON_AUTH_START',
    })

    if (!response.ok) {
      setStatusText(response.error)
      return
    }

    setStatusText(`로그인 완료: ${response.data.username} (${response.data.level})`)
    await refreshAuthStatus()
    await handleLoadOrgs()
  }

  const handleLogout = async () => {
    const response = await sendRuntime<{ success: boolean }>({ type: 'HIGHTON_AUTH_LOGOUT' })
    if (!response.ok) {
      setStatusText(response.error)
      return
    }

    setStatusText('로그아웃 완료')
    setOrgs([])
    setRepos([])
    setSelectedOrg('')
    setSelectedRepoFullName('')
    await refreshAuthStatus()
  }

  const handleLoadOrgs = async () => {
    const response = await sendRuntime<OrgItem[]>({ type: 'HIGHTON_API_GET_ORGS' })
    if (!response.ok) {
      setStatusText(response.error)
      return
    }

    setOrgs(response.data)
    if (response.data.length === 0) {
      setStatusText('소속된 Organization이 없어요.')
      setRepos([])
      setSelectedOrg('')
      setSelectedRepoFullName('')
      return
    }

    const firstOrg = response.data[0].login
    setSelectedOrg(firstOrg)
    setStatusText(`${response.data.length}개의 Organization을 불러왔어요.`)
    await handleLoadRepos(firstOrg)
  }

  const handleLoadRepos = async (org: string) => {
    const response = await sendRuntime<RepoItem[]>({
      type: 'HIGHTON_API_GET_REPOS',
      org,
    })
    if (!response.ok) {
      setStatusText(response.error)
      return
    }

    setRepos(response.data)
    if (response.data.length === 0) {
      setSelectedRepoFullName('')
      setStatusText(`${org}의 레포가 없어요.`)
      return
    }

    setSelectedRepoFullName(response.data[0].full_name)
    setStatusText(`${org} 레포 ${response.data.length}개를 불러왔어요.`)
  }

  const handleSelectOrg = async (org: string) => {
    setSelectedOrg(org)
    setSelectedRepoFullName('')
    await handleLoadRepos(org)
  }

  const handleRegisterWebhook = async () => {
    if (!selectedRepoFullName.includes('/')) {
      setStatusText('Webhook 등록할 레포를 먼저 선택해주세요.')
      return
    }

    const [owner, repo] = selectedRepoFullName.split('/')
    if (!owner || !repo) {
      setStatusText('레포 정보가 올바르지 않아요.')
      return
    }

    const response = await sendRuntime<{ id: number }>({
      type: 'HIGHTON_API_REGISTER_WEBHOOK',
      owner,
      repo,
    })

    if (!response.ok) {
      setStatusText(response.error)
      return
    }

    setStatusText(
      response.data.id === -1
        ? `이미 등록된 Webhook이에요. (${selectedRepoFullName})`
        : `Webhook 등록 완료: ${selectedRepoFullName} (id=${response.data.id})`,
    )
  }

  const selectedRepo = repos.find((repo) => repo.full_name === selectedRepoFullName)

  return (
    <Container>
      <HeroCard>
        <HeroTop>
          <TitleWrap>
            <GitHubMark aria-hidden="true" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M12 2C6.477 2 2 6.477 2 12a9.998 9.998 0 0 0 6.838 9.488c.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.605-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.907-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.944 0-1.092.39-1.986 1.03-2.686-.103-.253-.447-1.273.098-2.654 0 0 .84-.269 2.75 1.026A9.563 9.563 0 0 1 12 6.84c.85.004 1.705.115 2.504.337 1.909-1.295 2.747-1.026 2.747-1.026.547 1.381.203 2.401.1 2.654.642.7 1.029 1.594 1.029 2.686 0 3.843-2.339 4.688-4.566 4.936.359.309.679.92.679 1.854 0 1.337-.012 2.416-.012 2.744 0 .268.18.58.688.481A10.002 10.002 0 0 0 22 12c0-5.523-4.477-10-10-10z"
              />
            </GitHubMark>
            <Title>GitTama</Title>
          </TitleWrap>
          <LevelPill active={auth.authenticated}>
            {auth.authenticated ? (auth.level ?? 'CONNECTED') : 'OFFLINE'}
          </LevelPill>
        </HeroTop>
        <Description>
          GitHub OAuth 로그인 후 GiTama 백엔드와 연동됩니다. 위젯 토글, webhook 등록, 테스트 액션을
          한 곳에서 관리하세요.
        </Description>
        <ActionButton tone="slate" onClick={handleToggleWidget}>
          위젯 표시/숨김
        </ActionButton>
      </HeroCard>

      <SectionCard>
        <SectionTitle>Auth</SectionTitle>
        <AuthStatus active={auth.authenticated}>
          {auth.authenticated
            ? `로그인됨: ${auth.username ?? '-'} (${auth.level ?? '-'})`
            : '로그인이 필요해요.'}
        </AuthStatus>
        <ActionGrid>
          <ActionButton tone="indigo" onClick={handleLogin}>
            <ButtonLabel>
              <GitHubMarkSmall aria-hidden="true" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 2C6.477 2 2 6.477 2 12a9.998 9.998 0 0 0 6.838 9.488c.5.092.682-.217.682-.482 0-.237-.009-.866-.014-1.7-2.782.605-3.369-1.341-3.369-1.341-.454-1.154-1.11-1.462-1.11-1.462-.907-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.944 0-1.092.39-1.986 1.03-2.686-.103-.253-.447-1.273.098-2.654 0 0 .84-.269 2.75 1.026A9.563 9.563 0 0 1 12 6.84c.85.004 1.705.115 2.504.337 1.909-1.295 2.747-1.026 2.747-1.026.547 1.381.203 2.401.1 2.654.642.7 1.029 1.594 1.029 2.686 0 3.843-2.339 4.688-4.566 4.936.359.309.679.92.679 1.854 0 1.337-.012 2.416-.012 2.744 0 .268.18.58.688.481A10.002 10.002 0 0 0 22 12c0-5.523-4.477-10-10-10z"
                />
              </GitHubMarkSmall>
              GitHub 로그인
            </ButtonLabel>
          </ActionButton>
          <ActionButton tone="slate" onClick={refreshAuthStatus}>
            상태 새로고침
          </ActionButton>
          <ActionButton tone="amber" onClick={handleLogout}>
            로그아웃
          </ActionButton>
        </ActionGrid>
      </SectionCard>

      <SectionCard>
        <SectionTitle>Webhook</SectionTitle>
        <MetaText>1) Org 조회 → 2) 레포 선택 → 3) Webhook 등록</MetaText>
        <ActionButton tone="emerald" onClick={handleLoadOrgs}>
          Organization 불러오기
        </ActionButton>
        <Select
          value={selectedOrg}
          onChange={(e) => {
            void handleSelectOrg(e.target.value)
          }}
        >
          {orgs.length === 0 ? <option value="">Organization 없음</option> : null}
          {orgs.map((org) => (
            <option key={org.id} value={org.login}>
              {org.login}
            </option>
          ))}
        </Select>
        <Select
          value={selectedRepoFullName}
          onChange={(e) => {
            setSelectedRepoFullName(e.target.value)
          }}
        >
          {repos.length === 0 ? <option value="">레포 없음</option> : null}
          {repos.map((repo) => (
            <option key={repo.full_name} value={repo.full_name}>
              {repo.full_name}
            </option>
          ))}
        </Select>
        <RepoMeta>
          {selectedRepo
            ? `${selectedRepo.private ? 'Private' : 'Public'} • ${selectedRepo.language ?? 'Unknown language'}`
            : '선택된 레포 정보가 없어요.'}
        </RepoMeta>
        <ActionButton tone="indigo" onClick={handleRegisterWebhook}>
          Webhook 등록
        </ActionButton>
      </SectionCard>

      <SectionCard>
        <SectionTitle>State</SectionTitle>
        <ButtonRow>
          <ActionButton tone="emerald" onClick={handleAddTestCoins}>
            테스트 코인 +{TEST_COIN_AMOUNT}
          </ActionButton>
          <ActionButton tone="amber" onClick={handleResetState}>
            Reset
          </ActionButton>
        </ButtonRow>
      </SectionCard>

      <StatusBanner>{statusText || '준비됨'}</StatusBanner>
    </Container>
  )
}

export default App

const Container = styled.main`
  width: 320px;
  min-height: 220px;
  padding: ${spacing.md};
  border-radius: ${radius.md};
  border: 1px solid ${colors.border};
  background:
    radial-gradient(circle at top right, rgba(82, 134, 255, 0.18) 0%, rgba(82, 134, 255, 0) 48%),
    linear-gradient(180deg, #f9fbff 0%, #eef3fb 100%);
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
`

const HeroCard = styled.section`
  padding: ${spacing.md};
  border-radius: ${radius.md};
  border: 1px solid rgba(86, 119, 170, 0.25);
  background: linear-gradient(140deg, rgba(255, 255, 255, 0.92) 0%, rgba(241, 247, 255, 0.92) 100%);
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  box-shadow: 0 8px 24px rgba(40, 69, 118, 0.09);
`

const HeroTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${spacing.sm};
`

const TitleWrap = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
`

const Title = styled.h1`
  margin: 0;
  font-size: 42px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #1a2540;
`

const GitHubMark = styled.svg`
  width: 32px;
  height: 32px;
  color: #111827;
`

const GitHubMarkSmall = styled.svg`
  width: 16px;
  height: 16px;
  color: currentColor;
`

const ButtonLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
`

const LevelPill = styled.span<{ active: boolean }>`
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  background: ${(props) => (props.active ? 'rgba(57, 182, 116, 0.16)' : 'rgba(82, 98, 123, 0.12)')};
  color: ${(props) => (props.active ? '#118a52' : '#5c6a7e')};
`

const Description = styled.p`
  margin: 0;
  color: #5b6880;
  font-size: ${typography.body};
  line-height: 1.45;
`

const SectionCard = styled.section`
  padding: ${spacing.sm};
  border-radius: ${radius.md};
  border: 1px solid rgba(90, 116, 163, 0.2);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 6px 14px rgba(39, 62, 101, 0.06);
  display: flex;
  flex-direction: column;
  gap: ${spacing.xs};
`

const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${typography.caption};
  color: #5f6c81;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
`

const MetaText = styled.p`
  margin: 0;
  color: #70809a;
  font-size: 12px;
`

const RepoMeta = styled.p`
  margin: 0;
  color: #4e5d74;
  font-size: 12px;
  font-weight: 600;
`

const ButtonRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing.sm};
`

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${spacing.sm};
`

const AuthStatus = styled.p<{ active: boolean }>`
  margin: 0;
  padding: 8px 10px;
  border-radius: ${radius.sm};
  border: 1px solid
    ${(props) => (props.active ? 'rgba(39, 171, 103, 0.32)' : 'rgba(120, 133, 156, 0.3)')};
  background: ${(props) =>
    props.active ? 'rgba(39, 171, 103, 0.1)' : 'rgba(120, 133, 156, 0.08)'};
  color: ${(props) => (props.active ? '#1e7f4f' : '#5e6a7e')};
  font-size: ${typography.caption};
  font-weight: 600;
`

const Select = styled.select`
  width: 100%;
  box-sizing: border-box;
  padding: ${spacing.sm};
  border-radius: ${radius.sm};
  border: 1px solid rgba(86, 112, 156, 0.26);
  background: rgba(255, 255, 255, 0.95);
  color: #1e2a40;
  font-size: ${typography.body};
`

const StatusBanner = styled.p`
  margin: 0;
  border-radius: ${radius.sm};
  border: 1px solid rgba(90, 115, 159, 0.28);
  background: rgba(255, 255, 255, 0.82);
  padding: 8px 10px;
  color: #56657d;
  font-size: ${typography.caption};
  word-break: break-word;
`

const ButtonShell = styled.button<{ tone: ActionTone }>`
  border: 1px solid transparent;
  border-radius: ${radius.md};
  padding: ${spacing.sm} ${spacing.lg};
  font-size: ${typography.body};
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #ffffff;
  cursor: pointer;
  transition:
    transform 120ms ease,
    filter 120ms ease,
    box-shadow 120ms ease;

  background: ${(props) => {
    if (props.tone === 'emerald') {
      return 'linear-gradient(135deg, #1fbf8f 0%, #0f8f7b 100%)'
    }
    if (props.tone === 'amber') {
      return 'linear-gradient(135deg, #ff9f43 0%, #ef6c3f 100%)'
    }
    if (props.tone === 'slate') {
      return 'linear-gradient(135deg, #6b7a95 0%, #4f5d78 100%)'
    }
    return 'linear-gradient(135deg, #3f7cff 0%, #355fda 100%)'
  }};

  box-shadow: ${(props) => {
    if (props.tone === 'emerald') return '0 8px 14px rgba(22, 162, 122, 0.25)'
    if (props.tone === 'amber') return '0 8px 14px rgba(239, 108, 63, 0.26)'
    if (props.tone === 'slate') return '0 8px 14px rgba(79, 93, 120, 0.24)'
    return '0 8px 14px rgba(53, 95, 218, 0.25)'
  }};

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.04);
  }

  &:active {
    transform: translateY(0);
  }
`
