import { useEffect, useState } from 'react'
import styled from '@emotion/styled'
import { Button, colors, radius, spacing, typography } from './design-system'
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
          <Title>GiTama</Title>
          <LevelPill active={auth.authenticated}>
            {auth.authenticated ? (auth.level ?? 'CONNECTED') : 'OFFLINE'}
          </LevelPill>
        </HeroTop>
        <Description>
          GitHub OAuth 로그인 후 GiTama 백엔드와 연동됩니다. 위젯 토글, webhook 등록, 테스트 액션을
          한 곳에서 관리하세요.
        </Description>
        <Button type="button" onClick={handleToggleWidget}>
          GitHub 위젯 토글
        </Button>
      </HeroCard>

      <SectionCard>
        <SectionTitle>Auth</SectionTitle>
        <AuthStatus active={auth.authenticated}>
          {auth.authenticated
            ? `로그인됨: ${auth.username ?? '-'} (${auth.level ?? '-'})`
            : '로그인이 필요해요.'}
        </AuthStatus>
        <ActionGrid>
          <Button type="button" onClick={handleLogin}>
            GitHub 로그인
          </Button>
          <Button type="button" onClick={refreshAuthStatus}>
            상태 새로고침
          </Button>
          <Button type="button" onClick={handleLogout}>
            로그아웃
          </Button>
        </ActionGrid>
      </SectionCard>

      <SectionCard>
        <SectionTitle>Webhook</SectionTitle>
        <MetaText>1) Org 조회 → 2) 레포 선택 → 3) Webhook 등록</MetaText>
        <Button type="button" onClick={handleLoadOrgs}>
          Organization 불러오기
        </Button>
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
        <Button type="button" onClick={handleRegisterWebhook}>
          Webhook 등록
        </Button>
      </SectionCard>

      <SectionCard>
        <SectionTitle>State</SectionTitle>
        <ButtonRow>
          <Button type="button" onClick={handleAddTestCoins}>
            테스트 코인 +{TEST_COIN_AMOUNT}
          </Button>
          <Button type="button" onClick={handleResetState}>
            Reset
          </Button>
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

const Title = styled.h1`
  margin: 0;
  font-size: 42px;
  line-height: 1;
  letter-spacing: -0.02em;
  color: #1a2540;
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
