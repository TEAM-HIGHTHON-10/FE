import { ICON_DATA_URLS } from '../../assets/iconDataUrls'
import { QUESTS } from './constants'

export const createWidgetCss = (topOffset: number) => `
    :host {
      all: initial;

      --frame-bg: rgba(34, 34, 34, 0.62);
      --frame-border: rgba(47, 47, 47, 0.58);
      --text: #ffffff;
      --muted: rgba(255, 255, 255, 0.6);
      --accent: #ff9d00;
      --accent-bg: rgba(255, 157, 0, 0.5);
      --disabled-bg: rgba(93, 93, 93, 0.2);
      --disabled-text: rgba(255, 255, 255, 0.2);
      --card-bg: rgba(34, 34, 34, 0.5);
      --card-bg-2: rgba(34, 34, 34, 0.7);
      --track: rgba(255, 255, 255, 0.12);
      --toast-top: 92px;
      --toast-left: 50%;
    }

    .frame {
      box-sizing: border-box;
      position: fixed;
      left: ${Math.max(8, window.innerWidth - 480 - 16)}px;
      top: ${topOffset}px;
      width: 480px;
      height: 580px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 14px;
      isolation: isolate;
      background: var(--frame-bg);
      border: 0;
      border-radius: 8px;
      backdrop-filter: blur(18px);
      z-index: 2147483647;
      color: var(--text);
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial,
        sans-serif;
    }

    .authGate {
      width: 432px;
      min-height: 360px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(18, 18, 20, 0.42);
      color: rgba(255, 255, 255, 0.95);
      display: none;
      align-items: center;
      justify-content: center;
      text-align: center;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.01em;
      backdrop-filter: blur(12px);
    }

    .frame[data-highton-auth='0'] .stage,
    .frame[data-highton-auth='0'] .status,
    .frame[data-highton-auth='0'] .quests {
      display: none;
    }

    .frame[data-highton-auth='0'] .authGate {
      display: flex;
    }

    .frame[data-highton-game-active='1'] {
      height: 580px;
      gap: 0;
    }

    .frame[data-highton-game-active='1'] .toolbar,
    .frame[data-highton-game-active='1'] .status,
    .frame[data-highton-game-active='1'] .quests,
    .frame[data-highton-game-active='1'] .hudPills,
    .frame[data-highton-game-active='1'] .bagBtn,
    .frame[data-highton-game-active='1'] .stageLeftBtn,
    .frame[data-highton-game-active='1'] .shopPanel,
    .frame[data-highton-game-active='1'] .gameMenu,
    .frame[data-highton-game-active='1'] .gameClose,
    .frame[data-highton-game-active='1'] .gameControls,
    .frame[data-highton-game-active='1'] .gameHint,
    .frame[data-highton-game-active='1'] .gameReward {
      display: none !important;
    }

    .frame[data-highton-game-active='1'] .stage {
      width: 432px;
      height: 532px;
      padding: 0;
      gap: 0;
      border-radius: 10px;
      background: url('${ICON_DATA_URLS.background}') center / cover no-repeat;
    }

    .frame[data-highton-game-active='1'] .stageInner {
      display: none;
    }

    .frame[data-highton-game-active='1'] .gamePanel {
      left: 0;
      right: 0;
      top: 0;
      bottom: 0;
      min-height: 100%;
      padding: 10px;
      border-radius: 0;
      border: 0;
      background: rgba(19, 22, 28, 0.78);
      display: flex;
      z-index: 10;
    }

    .frame[data-highton-game-active='1'] .gamePanel[data-mode='play'] .gamePlayView {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .frame[data-highton-game-active='1'] .gameCard {
      min-height: 100%;
      padding: 8px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(20, 20, 22, 0.46);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
    }

    .frame[data-highton-game-active='1'] .gameHud {
      justify-content: center;
      margin-bottom: 4px;
    }

    .frame[data-highton-game-active='1'] .gameScore {
      font-size: 58px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: -0.02em;
      text-shadow: 0 3px 0 rgba(0, 0, 0, 0.2);
    }

    .frame[data-highton-game-active='1'] .gameArena {
      flex: 1;
      height: auto;
      min-height: 0;
      border-radius: 14px;
      border: 0;
      background: url('${ICON_DATA_URLS.background}') center / cover no-repeat;
    }

    .frame[data-highton-game-active='1'] .gameArena::before,
    .frame[data-highton-game-active='1'] .gameArena::after {
      display: none;
    }

    .frame[data-highton-game-active='1'] .gamePlayer {
      width: 110px;
      height: 110px;
      bottom: 18px;
    }

    .frame[data-highton-game-active='1'] .gameFallingStone {
      width: 60px;
      height: 46px;
    }

    .toolbar {
      width: 100%;
      height: 22px;
      margin-top: 0;
      margin-bottom: 6px;
      padding-right: 4px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: move;
      user-select: none;
    }

    .dragDots {
      color: var(--muted);
      font-size: 12px;
      line-height: 1;
      letter-spacing: 0.2em;
      padding-left: 4px;
    }

    .toolBtn {
      width: 20px;
      height: 20px;
      border: 1px solid var(--frame-border);
      border-radius: 6px;
      background: rgba(34, 34, 34, 0.55);
      color: #d8d8d8;
      display: grid;
      place-items: center;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      padding: 0;
      margin-top: 1px;
    }

    .toolBtn:hover {
      filter: brightness(1.08);
    }

    .miniDock {
      display: none;
      width: 100%;
      height: 100%;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    .miniDockBtn {
      width: 148px;
      height: 148px;
      border-radius: 0;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      cursor: pointer;
      padding: 0;
      transition:
        transform 120ms ease,
        filter 120ms ease;
    }

    .miniDockBtn:hover {
      transform: translateY(-1px);
      filter: brightness(1.03);
    }

    .miniPetWrap {
      width: 148px;
      height: 148px;
      display: grid;
      place-items: center;
      flex: none;
      position: relative;
    }

    .miniQuestBadge {
      position: absolute;
      left: 0;
      top: 0;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.96);
      background: linear-gradient(135deg, #ff7b67 0%, #ff3f57 100%);
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 12px rgba(255, 63, 87, 0.35);
      pointer-events: none;
      z-index: 7;
      transform: translate(-50%, -50%);
    }

    .miniQuestBadge[data-open='1'] {
      display: inline-flex;
    }

    .miniPet {
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }

    .miniHat {
      position: absolute;
      width: 50px;
      height: 30px;
      left: 0;
      top: 0;
      transform: translate(-50%, 0);
      transform-origin: center center;
      margin-left: -25px;
      object-fit: contain;
      pointer-events: none;
      display: none;
    }

    .miniHoverCard {
      position: absolute;
      left: 126px;
      top: 50%;
      transform: translateY(-50%);
      min-width: 148px;
      max-width: 180px;
      display: none;
      flex-direction: column;
      gap: 4px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(8px);
      color: #2a2a2a;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.16);
      pointer-events: none;
      z-index: 6;
    }

    .miniDock.flipLeft .miniHoverCard {
      left: auto;
      right: 126px;
    }

    .miniHoverCard::after {
      content: '';
      position: absolute;
      right: 100%;
      top: 50%;
      transform: translateY(-50%);
      width: 8px;
      height: 10px;
      background: rgba(255, 255, 255, 0.94);
      clip-path: polygon(100% 50%, 0 0, 0 100%);
    }

    .miniDock.flipLeft .miniHoverCard::after {
      right: auto;
      left: 100%;
      clip-path: polygon(0 50%, 100% 0, 100% 100%);
    }

    .miniMeta {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .miniLv {
      font-weight: 700;
      font-size: 12px;
      line-height: 1.2;
    }

    .miniCoins {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #2a2a2a;
    }

    .miniLabel {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: #595959;
    }

    .frame.collapsed {
      height: 420px;
    }

    .frame.collapsed .quests {
      display: none;
    }

    .frame.minimized {
      width: 148px;
      height: 148px;
      padding: 0;
      gap: 0;
      border-radius: 999px;
      position: fixed;
      justify-content: center;
      align-items: center;
      overflow: visible;
      background: transparent;
      border: 0;
      backdrop-filter: none;
    }

    .frame.minimized .toolbar {
      display: none;
    }

    .frame.minimized .stage,
    .frame.minimized .status,
    .frame.minimized .quests {
      display: none;
    }

    .frame.minimized .miniDock {
      display: flex;
    }

    .frame.minimized:hover .miniHoverCard,
    .frame.minimized:focus-within .miniHoverCard {
      display: flex;
    }

    .stage {
      box-sizing: border-box;
      width: 432px;
      height: 360px;
      padding: 16px 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 24px;
      border: 0;
      border-radius: 8px;
      background:
        linear-gradient(0deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.08)),
        url('${ICON_DATA_URLS.background}') center / cover no-repeat;
      position: relative;
      overflow: hidden;
    }

    .stageInner {
      width: 360px;
      height: 360px;
      display: grid;
      place-items: center;
      position: relative;
    }

    .pet {
      width: 280px;
      height: 280px;
      border-radius: 0;
      background: transparent;
      border: 0;
      display: grid;
      place-items: center;
      position: relative;
      overflow: visible;
      cursor: pointer;
    }

    .petImage {
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }

    .petHat {
      position: absolute;
      width: 110px;
      height: 68px;
      left: 0;
      top: 0;
      transform: translate(-50%, 0);
      transform-origin: center center;
      object-fit: contain;
      pointer-events: none;
      z-index: 3;
      margin-left: -55px;
      display: none;
    }

    .hudPills {
      position: absolute;
      right: 12px;
      top: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      z-index: 4;
    }

    .coinPill {
      box-sizing: border-box;
      width: auto;
      min-width: 72px;
      max-width: 140px;
      height: 26px;
      padding: 4px 10px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      border: 1px solid var(--frame-border);
      border-radius: 8px;
      background: var(--card-bg-2);
    }

    .goldPill {
      box-sizing: border-box;
      width: auto;
      min-width: 72px;
      max-width: 140px;
      height: 26px;
      padding: 4px 10px;
      display: inline-flex;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      border: 1px solid rgba(248, 178, 37, 0.55);
      border-radius: 8px;
      background: rgba(48, 36, 15, 0.72);
    }

    .goldGlyphIcon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex: none;
    }

    .eggGlyphIcon {
      width: 16px;
      height: 16px;
      object-fit: contain;
      flex: none;
    }

    .coinGlyph {
      position: relative;
      width: 16px;
      height: 16px;
      flex: none;
    }

    .coinGlyph::before {
      content: '';
      position: absolute;
      width: 10.37px;
      height: 13.81px;
      left: 0;
      top: 1px;
      border-radius: 999px;
      background: #ffc98c;
    }

    .coinGlyph::after {
      content: '';
      position: absolute;
      width: 10.61px;
      height: 13.66px;
      left: 5.39px;
      top: 3.34px;
      border-radius: 999px;
      background: #f5b66e;
    }

    .coinText {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bagBtn {
      box-sizing: border-box;
      position: absolute;
      right: 12px;
      bottom: 12px;
      width: 36px;
      height: 36px;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid var(--frame-border);
      background: rgba(34, 34, 34, 0.5);
      backdrop-filter: blur(18px);
      display: grid;
      place-items: center;
      cursor: pointer;
    }

    .bagBtn:hover {
      filter: brightness(1.05);
    }

    .bagBtn[aria-pressed='true'] {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(255, 157, 0, 0.45) inset;
    }

    .bagIcon {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .stageIcon {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .stageLeftBtn {
      box-sizing: border-box;
      position: absolute;
      left: 12px;
      bottom: 12px;
      width: 36px;
      height: 36px;
      padding: 4px;
      border-radius: 8px;
      border: 1px solid var(--frame-border);
      background: rgba(34, 34, 34, 0.5);
      backdrop-filter: blur(18px);
      display: grid;
      place-items: center;
      cursor: pointer;
      color: #bbbbbb;
      font-weight: 900;
    }

    .stageLeftBtn:hover {
      filter: brightness(1.05);
    }

    .shopPanel {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      min-height: 116px;
      padding: 26px 12px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255, 157, 0, 0.55);
      background: rgba(34, 34, 34, 0.78);
      backdrop-filter: blur(14px);
      display: none;
      flex-direction: row;
      gap: 10px;
      overflow-x: auto;
      z-index: 5;
    }


    .gamePanel {
      position: absolute;
      left: 8px;
      right: 8px;
      bottom: 8px;
      min-height: 116px;
      padding: 26px 12px 12px;
      border-radius: 12px;
      border: 1px solid rgba(248, 163, 26, 0.78);
      background: rgba(34, 34, 34, 0.82);
      display: none;
      flex-direction: column;
      gap: 8px;
      overflow: hidden;
      z-index: 6;
      backdrop-filter: blur(14px);
    }

    .gamePanel[data-open='1'] {
      display: flex;
    }

    .gameCard {
      box-sizing: border-box;
      width: 100%;
      min-width: 0;
      min-height: 116px;
      border-radius: 12px;
      border: 1px solid rgba(248, 163, 26, 0.95);
      background:
        radial-gradient(circle at 50% 80%, rgba(255, 167, 50, 0.28) 0%, rgba(0, 0, 0, 0) 46%),
        linear-gradient(180deg, #be7c17 0%, #b87312 100%);
      box-shadow:
        inset 0 0 0 1px rgba(255, 230, 170, 0.2),
        0 8px 20px rgba(0, 0, 0, 0.26);
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: center;
      gap: 6px;
      position: relative;
      padding: 8px;
    }

    .gameMenu {
      width: 100%;
      display: flex;
      align-items: stretch;
    }

    .gameEnterBtn {
      width: 100%;
      min-height: 116px;
      border-radius: 10px;
      border: 1px solid rgba(248, 163, 26, 0.95);
      background:
        radial-gradient(circle at 50% 85%, rgba(255, 167, 50, 0.3) 0%, rgba(0, 0, 0, 0) 52%),
        linear-gradient(180deg, #c57d13 0%, #b87312 100%);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .gameEnterBtn:hover {
      filter: brightness(1.03);
    }

    .gameMenuStone {
      width: 68px;
      height: 52px;
      object-fit: contain;
      filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.22));
    }

    .gameMenuReward {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 20px;
      font-weight: 700;
      color: #fff;
      line-height: 1;
    }

    .gameMenuTitle {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
      color: #fff;
      line-height: 1.2;
      text-align: center;
    }

    .gamePlayView {
      display: none;
      flex-direction: column;
      gap: 8px;
    }

    .gamePanel[data-mode='menu'] .gameMenu {
      display: flex;
    }

    .gamePanel[data-mode='menu'] .gamePlayView {
      display: none;
    }

    .gamePanel[data-mode='play'] .gameMenu {
      display: none;
    }

    .gamePanel[data-mode='play'] .gamePlayView {
      display: flex;
    }

    .gameHud {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .gameScore {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 42px;
      font-weight: 900;
      color: #fff;
      line-height: 1;
      text-shadow: 0 3px 0 rgba(0, 0, 0, 0.18);
    }

    .gameArena {
      position: relative;
      height: 330px;
      border-radius: 10px;
      border: 1px solid rgba(255, 214, 142, 0.4);
      background:
        repeating-linear-gradient(
          90deg,
          rgba(97, 56, 21, 0.12) 0,
          rgba(97, 56, 21, 0.12) 2px,
          rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, 0) 36px
        ),
        linear-gradient(180deg, #c88242 0%, #bc7335 52%, #a7612c 100%);
      overflow: hidden;
    }

    .gameArena::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 48%;
      background:
        repeating-linear-gradient(
          105deg,
          rgba(120, 66, 31, 0.22) 0,
          rgba(120, 66, 31, 0.22) 2px,
          rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, 0) 40px
        ),
        linear-gradient(180deg, rgba(210, 138, 75, 0.16), rgba(150, 83, 40, 0.28));
      pointer-events: none;
    }

    .gameArena::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 54%;
      width: 140px;
      height: 64px;
      transform: translateX(-50%);
      border-radius: 40px 40px 0 0;
      background: linear-gradient(180deg, rgba(145, 174, 70, 0.95) 0%, rgba(116, 151, 52, 0.95) 100%);
      border: 3px solid rgba(176, 118, 57, 0.85);
      border-bottom: 0;
      pointer-events: none;
    }

    .gameStonesLayer {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .gameFallingStone {
      position: absolute;
      width: 44px;
      height: 34px;
      object-fit: contain;
      filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.36));
      pointer-events: none;
      will-change: transform;
    }

    .gamePlayer {
      position: absolute;
      left: 50%;
      bottom: 14px;
      width: 82px;
      height: 82px;
      object-fit: contain;
      transform: translateX(-50%);
      filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.35));
      pointer-events: none;
      z-index: 2;
    }

    .gameControls {
      display: grid;
      grid-template-columns: 1fr 1fr;
      align-items: center;
      gap: 10px;
    }

    .gameMoveBtn {
      height: 30px;
      border-radius: 8px;
      border: 1px solid rgba(255, 220, 160, 0.58);
      background: rgba(60, 26, 8, 0.45);
      color: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      padding: 0 10px;
    }

    .gameMoveBtn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .gameHint {
      text-align: center;
      font-size: 11px;
      color: rgba(255, 245, 226, 0.88);
      line-height: 1;
    }

    .gameClose {
      position: absolute;
      top: 6px;
      right: 8px;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: rgba(34, 34, 34, 0.42);
      color: #e8e8e8;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      z-index: 1;
    }

    .gameClose:hover {
      filter: brightness(1.08);
    }

    .gameStone {
      width: 28px;
      height: 22px;
      object-fit: contain;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.28));
    }

    .gameReward {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 246, 230, 0.95);
      line-height: 1;
    }


    .shopClose {
      position: absolute;
      top: 6px;
      right: 8px;
      width: 22px;
      height: 22px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      background: rgba(34, 34, 34, 0.42);
      color: #e8e8e8;
      display: grid;
      place-items: center;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      padding: 0;
    }

    .shopClose:hover {
      filter: brightness(1.08);
    }

    .shopPanel[data-open='1'] {
      display: flex;
    }

    .shopCard {
      width: 126px;
      min-width: 126px;
      border-radius: 12px;
      border: 1px solid rgba(255, 157, 0, 0.9);
      background: rgba(255, 157, 0, 0.16);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 10px 8px;
      cursor: pointer;
    }

    .shopCard:hover {
      filter: brightness(1.05);
    }

    .shopCard[data-equipped='1'] {
      border-color: #ffe8b7;
      background: rgba(255, 157, 0, 0.3);
    }

    .shopIcon {
      width: 54px;
      height: 40px;
      object-fit: contain;
      pointer-events: none;
    }

    .shopPrice {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      font-weight: 700;
      line-height: 1;
    }

    .shopName {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.2;
      text-align: center;
    }

    .shopAction {
      font-size: 11px;
      font-weight: 700;
      color: rgba(255, 255, 255, 0.9);
    }

    .status {
      width: 432px;
      height: 22px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
    }

    .statusLeft {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 12px;
      flex: 1;
      min-width: 0;
    }

    .lv {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      width: 76px;
      text-align: left;
      white-space: nowrap;
    }

    .bar {
      box-sizing: border-box;
      height: 8px;
      flex: 1;
      border: 1px solid #ffffff;
      border-radius: 4px;
      background: transparent;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      width: 0%;
      background: #ffffff;
    }

    .expText {
      font-weight: 600;
      font-size: 12px;
      line-height: 150%;
      width: 48px;
      text-align: center;
      white-space: nowrap;
    }

    .feedBtn {
      box-sizing: border-box;
      height: 22px;
      padding: 4px 12px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      border-radius: 8px;
      background: var(--accent-bg);
      border: 1px solid var(--accent);
      backdrop-filter: blur(18px);
      cursor: pointer;
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      white-space: nowrap;
    }

    .feedBtn:disabled {
      background: rgba(93, 93, 93, 0.2);
      border: 1px solid rgba(93, 93, 93, 0.2);
      color: rgba(255, 255, 255, 0.2);
      cursor: not-allowed;
    }

    .quests {
      width: 432px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
      flex: 1;
      min-height: 0;
    }

    .questList {
      width: 432px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      overflow: auto;
      padding-right: 6px;
    }

    .questList::-webkit-scrollbar {
      width: 4px;
    }

    .questList::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 2px;
    }

    .questRow {
      box-sizing: border-box;
      width: 424px;
      height: 38px;
      padding: 8px 12px;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      gap: 4px;
      border-radius: 8px;
      background: var(--card-bg);
      border: 1px solid var(--frame-border);
      backdrop-filter: blur(18px);
    }

    .questTitle {
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      letter-spacing: -0.03em;
    }

    .questRight {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }

    .questReward {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      letter-spacing: -0.03em;
    }

    .questBtn {
      box-sizing: border-box;
      height: 22px;
      padding: 4px 12px;
      border-radius: 8px;
      border: 1px solid var(--accent);
      background: var(--accent-bg);
      backdrop-filter: blur(18px);
      color: #ffffff;
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      letter-spacing: -0.03em;
      cursor: pointer;
    }

    .questBtn:disabled {
      background: rgba(93, 93, 93, 0.2);
      border: 1px solid rgba(93, 93, 93, 0.2);
      color: rgba(255, 255, 255, 0.2);
      cursor: not-allowed;
    }

    .toast {
      box-sizing: border-box;
      position: absolute;
      left: var(--toast-left);
      top: var(--toast-top);
      max-width: 230px;
      min-width: 120px;
      padding: 8px 10px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(0, 0, 0, 0.12);
      backdrop-filter: blur(8px);
      font-weight: 600;
      font-size: 12px;
      line-height: 14px;
      color: #2a2a2a;
      opacity: 0;
      transform: translate(-50%, 6px);
      transition:
        opacity 140ms ease,
        transform 140ms ease;
      pointer-events: none;
      white-space: normal;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      z-index: 4;
    }

    .toast::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      top: 100%;
      width: 10px;
      height: 8px;
      background: rgba(255, 255, 255, 0.94);
      clip-path: polygon(50% 100%, 0 0, 100% 0);
    }

    .toast[data-open='1'] {
      opacity: 1;
      transform: translate(-50%, 0);
    }

    @keyframes highton-enter {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `

export const createWidgetHtml = () => `
    <section class="toolbar" data-highton="dragHandle" aria-label="widget toolbar">
      <span class="dragDots" aria-hidden="true">•••</span>
      <button class="toolBtn" type="button" data-highton="minimize" aria-label="minimize">—</button>
    </section>

    <section class="authGate" aria-label="auth gate">GitHub 로그인을 해주세요</section>

    <section class="miniDock" data-highton="miniDock" aria-label="minimized widget">
      <button class="miniDockBtn" type="button" data-highton="miniRestore" aria-label="restore widget">
        <span class="miniPetWrap" aria-hidden="true">
          <img class="miniPet" data-highton="miniPet" src="${ICON_DATA_URLS.newbie}" alt="Newbie pet" />
          <img class="miniHat" data-highton="miniHat" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
          <span class="miniQuestBadge" data-highton="miniQuestBadge" aria-hidden="true">0</span>
        </span>
      </button>

      <div class="miniHoverCard" data-highton="miniHover">
        <div class="miniMeta">
          <div class="miniLv" data-highton="miniHoverLv">LV 1. Newbie</div>
          <div class="miniCoins">
            <span class="miniLabel">Gold</span>
            <img class="goldGlyphIcon" src="${ICON_DATA_URLS.goldEgg}" alt="" aria-hidden="true" />
            <span data-highton="miniHoverGoldEggs">0</span>
          </div>
          <div class="miniCoins">
            <span class="miniLabel">Coin</span>
            <img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />
            <span data-highton="miniHoverCoins">360</span>
          </div>
          <div class="miniCoins"><span class="miniLabel">EXP</span> <span data-highton="miniHoverExp">0 / 100</span></div>
        </div>
      </div>
    </section>

    <section class="stage" aria-label="stage" data-highton="toggle-area">
      <div class="stageInner">
        <div class="pet" data-highton="petTalk" data-highton-no-drag="1" role="button" tabindex="0" aria-label="pet talk">
          <img class="petImage" data-highton="petImage" src="${ICON_DATA_URLS.newbie}" alt="Newbie pet" />
          <img class="petHat" data-highton="petHat" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
        </div>
      </div>
      <div class="hudPills" aria-label="currencies">
        <div class="goldPill" aria-label="gold eggs">
          <img class="goldGlyphIcon" src="${ICON_DATA_URLS.goldEgg}" alt="" aria-hidden="true" />
          <span class="coinText" data-highton="goldEggs">0</span>
        </div>
        <div class="coinPill" aria-label="eggs">
          <img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />
          <span class="coinText" data-highton="coins">360</span>
        </div>
      </div>
      <button class="bagBtn" type="button" data-highton="bag" aria-label="bag">
        <img class="bagIcon" src="${ICON_DATA_URLS.cart}" alt="" aria-hidden="true" />
      </button>
      <button class="stageLeftBtn" type="button" data-highton="game" aria-label="open game panel">
        <img class="stageIcon" src="${ICON_DATA_URLS.game}" alt="" aria-hidden="true" />
      </button>

      <section class="gamePanel" data-highton="gamePanel" data-mode="menu" aria-label="game panel">
        <button class="gameClose" type="button" data-highton="gameClose" aria-label="close game panel">×</button>
        <div class="gameCard" aria-label="stone dodge game">
          <div class="gameMenu" data-highton="gameMenu">
            <button class="gameEnterBtn" type="button" data-highton="gameEnter" aria-label="enter stone game">
              <img class="gameMenuStone" src="${ICON_DATA_URLS.stone}" alt="stone" />
              <div class="gameMenuReward"><img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />10</div>
              <div class="gameMenuTitle">돌 피하기</div>
            </button>
          </div>
          <div class="gamePlayView" data-highton="gamePlayView">
            <div class="gameHud">
              <div class="gameScore"><span data-highton="gameScore">0</span>점</div>
              <div class="gameReward">
                <img class="goldGlyphIcon" src="${ICON_DATA_URLS.goldEgg}" alt="" aria-hidden="true" />
                점수=보상
                <img class="gameStone" src="${ICON_DATA_URLS.stone}" alt="" aria-hidden="true" />
              </div>
            </div>
            <div class="gameArena" data-highton="gameArena">
              <div class="gameStonesLayer" data-highton="gameStones"></div>
              <img class="gamePlayer" data-highton="gamePlayer" src="${ICON_DATA_URLS.newbieGame}" alt="game character" />
            </div>
            <div class="gameControls">
              <button class="gameMoveBtn" type="button" data-highton="gameMoveLeft" aria-label="move left">◀ 왼쪽</button>
              <button class="gameMoveBtn" type="button" data-highton="gameMoveRight" aria-label="move right">오른쪽 ▶</button>
            </div>
            <div class="gameHint">키보드 ← → 로도 이동 가능, 돌 1개 회피 시 +10점</div>
          </div>
        </div>
      </section>

      <section class="shopPanel" data-highton="shopPanel" aria-label="shop">
        <button class="shopClose" type="button" data-highton="shopClose" aria-label="close shop">×</button>
        <button class="shopCard" type="button" data-highton="shop-item" data-item="straw_hat">
          <img class="shopIcon" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
          <div class="shopPrice">
            <img class="goldGlyphIcon" src="${ICON_DATA_URLS.goldEgg}" alt="" aria-hidden="true" />
            <span data-highton="shop-price">100</span>
          </div>
          <div class="shopName">밀짚모자</div>
          <div class="shopAction" data-highton="shop-action">구매하기</div>
        </button>
      </section>
      <div class="toast" data-highton="toast"></div>
    </section>

    <section class="status" aria-label="status">
      <div class="statusLeft">
        <div class="lv" data-highton="lv">LV 1. Newbie</div>
        <div class="bar" data-highton="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <div class="fill" data-highton="fill" style="width: 0%"></div>
        </div>
        <div class="expText" data-highton="expText">0 / 100</div>
      </div>
      <button class="feedBtn" type="button" data-highton="feed">
        <img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />
        <span data-highton="feedCost">0</span>
        <span>성장하기</span>
      </button>
    </section>

    <section class="quests" aria-label="quests">
      <div class="questList">
        <div class="questRow" data-highton="q_commit1">
          <div class="questTitle" data-highton="q_title">${QUESTS.commit1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />
              <span data-highton="q_reward">${QUESTS.commit1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="commit1">받기</button>
          </div>
        </div>

        <div class="questRow" data-highton="q_pr1">
          <div class="questTitle" data-highton="q_title">${QUESTS.pr1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />
              <span data-highton="q_reward">${QUESTS.pr1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="pr1">받기</button>
          </div>
        </div>

        <div class="questRow" data-highton="q_review1">
          <div class="questTitle" data-highton="q_title">${QUESTS.review1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <img class="eggGlyphIcon" src="${ICON_DATA_URLS.egg}" alt="" aria-hidden="true" />
              <span data-highton="q_reward">${QUESTS.review1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="review1">받기</button>
          </div>
        </div>
      </div>
    </section>
  `
