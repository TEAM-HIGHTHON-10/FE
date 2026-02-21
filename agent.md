# FE Development Guide

## Core Direction

- Manage UI foundations through a design system.
- Prefer consistency and reusability over one-off styling.

## Design System Rules

- Centralize color, typography, spacing, radius, and shadow tokens.
- Keep global styles in one place and apply them at app root.
- Build reusable UI components (Button, Input, Card, Modal, etc.) on top of tokens.
- Avoid hard-coded values in feature components when a token can be used.

## Recommended Structure

```txt
src/
  design-system/
    tokens/
      colors.ts
      typography.ts
      spacing.ts
      radius.ts
    theme.ts
    GlobalStyle.tsx
    components/
      Button.tsx
      Input.tsx
      ...
```

## Emotion Code Ordering Rule

- For each component file, place component logic first.
- Place `styled` declarations at the bottom of the file.
- Example order:
  1. imports
  2. types/constants/hooks
  3. `export const Main = () => { ... }`
  4. `const Wrapper = styled.div\`...\`` and other styled blocks

## Styling Conventions

- Use Emotion (`@emotion/react`, `@emotion/styled`) for styling.
- Use semantic token names (for example: `primary`, `surface`, `textMuted`).
- Keep responsive rules and state styles (`:hover`, `:disabled`) inside styled blocks.
- Minimize inline styles; prefer styled components.

## Collaboration Notes

- When adding new UI, check design-system tokens/components first.
- If a required style pattern repeats, promote it into design-system component.
- Keep naming clear and predictable to scale with team usage.
