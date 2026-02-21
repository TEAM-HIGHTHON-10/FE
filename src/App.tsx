import styled from '@emotion/styled'
import { Button, colors, radius, spacing, typography } from './design-system'

export const App = () => {
  const handleToggleWidget = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.tabs.sendMessage(tab.id, { type: 'HIGHTON_TOGGLE_WIDGET' })
  }

  const handleSimulateEvent = async (eventType: 'COMMIT' | 'PULL_REQUEST' | 'REVIEW') => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.tabs.sendMessage(tab.id, {
      type: 'HIGHTON_SIMULATE_EVENT',
      eventType,
    })
  }

  const handleResetState = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return

    await chrome.tabs.sendMessage(tab.id, {
      type: 'HIGHTON_RESET_STATE',
    })
  }

  return (
    <Container>
      <Title>Highton</Title>
      <Description>
        GitHub 페이지에서는 강아지 위젯이 자동으로 뜨고, 아래 버튼으로 숨김/표시를 토글할 수 있어.
      </Description>
      <Button type="button" onClick={handleToggleWidget}>
        GitHub 위젯 토글
      </Button>

      <SectionTitle>Scenario (No Backend)</SectionTitle>
      <ButtonRow>
        <Button type="button" onClick={() => handleSimulateEvent('COMMIT')}>
          커밋
        </Button>
        <Button type="button" onClick={() => handleSimulateEvent('PULL_REQUEST')}>
          PR
        </Button>
      </ButtonRow>
      <ButtonRow>
        <Button type="button" onClick={() => handleSimulateEvent('REVIEW')}>
          Review
        </Button>
        <Button type="button" onClick={handleResetState}>
          Reset
        </Button>
      </ButtonRow>
    </Container>
  )
}

export default App

const Container = styled.main`
  width: 320px;
  min-height: 180px;
  padding: ${spacing.lg};
  border-radius: ${radius.md};
  border: 1px solid ${colors.border};
  background: ${colors.surface};
`

const Title = styled.h1`
  margin: 0;
  font-size: ${typography.heading};
`

const Description = styled.p`
  margin: ${spacing.sm} 0 ${spacing.md};
  color: ${colors.textSecondary};
  font-size: ${typography.body};
`

const SectionTitle = styled.h2`
  margin: ${spacing.lg} 0 ${spacing.sm};
  font-size: ${typography.caption};
  color: ${colors.textSecondary};
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
`

const ButtonRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${spacing.sm};
  margin-top: ${spacing.sm};
`
