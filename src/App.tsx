import { Global, css } from '@emotion/react'
import styled from '@emotion/styled'

const Container = styled.main`
  width: 320px;
  min-height: 180px;
  box-sizing: border-box;
  padding: 16px;
`

const Title = styled.h1`
  margin: 0;
  font-size: 20px;
`

const Description = styled.p`
  margin-top: 8px;
`

function App() {
  return (
    <>
      <Global
        styles={css`
          :root {
            font-family: sans-serif;
            line-height: 1.5;
            font-weight: 400;
            font-synthesis: none;
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          body {
            margin: 0;
          }
        `}
      />
      <Container>
        <Title>Highton</Title>
        <Description>Chrome extension base is ready.</Description>
      </Container>
    </>
  )
}

export default App
