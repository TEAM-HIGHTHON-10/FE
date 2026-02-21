# Highton

Chrome extension starter built with React + Vite + TypeScript (Manifest V3).

## Stack

- React 19
- TypeScript
- Vite
- Emotion (`@emotion/react`, `@emotion/styled`)
- `@crxjs/vite-plugin` for Chrome extension packaging
- ESLint + Prettier

## Scripts

- `yarn dev` - Vite dev server
- `yarn build` - typecheck + production extension build
- `yarn lint` - ESLint
- `yarn format` - Prettier write
- `yarn format:check` - Prettier check

## Load extension in Chrome

1. Run `yarn install`
2. Run `yarn build`
3. Open `chrome://extensions`
4. Enable Developer mode
5. Click Load unpacked
6. Select `dist` folder

## Current baseline

- Popup UI from React entry (`index.html`)
- Background service worker (`src/background.ts`)
- MV3 manifest config (`src/manifest.ts`)
