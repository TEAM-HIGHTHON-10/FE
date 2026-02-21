# FE Development Guide (Highton Extension)

## Core Direction

- Build a GitHub-injected pet widget with a game-like loop (growth, quests, feed, cosmetic items).
- Keep UI logic in `src/content/githubWidget.ts` and popup controls in `src/App.tsx`.
- Preserve the current visual style (Figma-inspired stage + card layout) while iterating quickly.

## Current Product Scope

- Chrome extension (MV3) with GitHub content-script widget.
- Popup actions for:
  - widget toggle
  - reset state
  - test coin increase
- Pet progression:
  - tiers: `Newbie`, `Junior`, `Mid`, `Senior`
  - 3 levels per tier
  - 100 EXP per level
- Daily quest system (`commit1`, `pr1`, `review1`) with claim rewards.
- Feed action consumes coin and gives EXP.
- Minimize/restore + draggable widget position persistence.
- Shop flow:
  - open from bag icon
  - close with top-right X
  - purchase/equip hat item
  - hat overlays on pet icon (main and minimized)

## Data Persistence Rules

- Main game state is stored in `chrome.storage.local` under `highton_pet_state_v2`.
- UI state is stored in `localStorage`:
  - `highton_widget_minimized`
  - `highton_widget_position`
- Do not use cookies for game state.

## State Model (Must Keep Compatible)

- `PetState` fields:
  - `coins`, `exp`, `mood`
  - `lastCommitAt`, `dayKey`
  - `counts` (commit/pr/review)
  - `quests`
  - `logs`
  - `ownedItems`
  - `equippedItem`

## Runtime Message Contracts

- `HIGHTON_TOGGLE_WIDGET`
- `HIGHTON_RESET_STATE`
- `HIGHTON_ADD_TEST_COINS`
- `HIGHTON_SIMULATE_EVENT` (legacy/manual test path)

When adding new popup controls, always add a message handler in `githubWidget.ts` and update UI immediately via `renderState`.

## Design System and Styling Rules

- Use Emotion (`@emotion/react`, `@emotion/styled`).
- Keep styled blocks at file bottom in component files.
- Prefer design-system tokens for popup app (`src/design-system/*`).
- For content script CSS inside template strings, keep constants and class names predictable and grouped by feature area.

## Asset Strategy

- Icons are TSX SVG components in `src/assets`.
- Convert TSX icons to data URLs via `src/assets/iconDataUrls.tsx`.
- Avoid separate "precomposed" pet+hat images unless layering becomes impossible.
- Cosmetic overlays use anchor tuning per tier (see `HAT_ANCHORS` in `githubWidget.ts`).

## Interaction and UX Rules

- Pet click shows speech-bubble style toast.
- Pet dialogue tone is polite Korean (존댓말).
- Minimized mode shows pet-only floating icon.
- Hover/focus in minimized mode shows compact speech-bubble progress card.
- Minimized icon:
  - click restores
  - drag moves widget
  - dragging must not trigger accidental restore click

## Shop Behavior Rules

- Bag icon toggles shop panel open/close.
- Shop panel has explicit close button (X).
- Buying checks coin balance and persists ownership.
- Re-click owned item toggles equip/unequip.
- Render both state and visuals right after purchase/equip changes.

## Verification Checklist (After Each Meaningful Change)

- Run:
  - `yarn format`
  - `yarn lint`
  - `yarn build`
- If a UI feature is changed, also verify behavior directly on GitHub page:
  - mount/unmount
  - minimize/drag/restore
  - toast visibility
  - shop purchase/equip updates

## Notes for Future Backend Integration

- Client-only GitHub polling logic has been intentionally removed.
- Backend event integration should feed normalized events into content script via explicit message contract, then reuse existing reward/state update paths.
