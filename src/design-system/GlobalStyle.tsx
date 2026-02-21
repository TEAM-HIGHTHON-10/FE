import { Global, css } from '@emotion/react'
import { theme } from './theme'

export const GlobalStyle = () => {
  return (
    <Global
      styles={css`
        :root {
          font-family: ${theme.typography.fontFamily};
          line-height: ${theme.typography.lineHeight};
          font-weight: 400;
          font-synthesis: none;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          color: ${theme.colors.textPrimary};
          background: ${theme.colors.background};
        }
      `}
    />
  )
}
