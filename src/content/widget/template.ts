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

    .coinPill {
      box-sizing: border-box;
      position: absolute;
      right: 12px;
      top: 12px;
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

    <section class="miniDock" data-highton="miniDock" aria-label="minimized widget">
      <button class="miniDockBtn" type="button" data-highton="miniRestore" aria-label="restore widget">
        <span class="miniPetWrap" aria-hidden="true">
          <img class="miniPet" data-highton="miniPet" src="${ICON_DATA_URLS.newbie}" alt="Newbie pet" />
          <img class="miniHat" data-highton="miniHat" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
        </span>
      </button>

      <div class="miniHoverCard" data-highton="miniHover">
        <div class="miniMeta">
          <div class="miniLv" data-highton="miniHoverLv">LV 1. Newbie</div>
          <div class="miniCoins">
            <span class="miniLabel">Coin</span>
            <span class="coinGlyph" aria-hidden="true"></span>
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
      <div class="coinPill" aria-label="coins">
        <span class="coinGlyph" aria-hidden="true"></span>
        <span class="coinText" data-highton="coins">360</span>
      </div>
      <button class="bagBtn" type="button" data-highton="bag" aria-label="bag">
        <img class="bagIcon" src="${ICON_DATA_URLS.cart}" alt="" aria-hidden="true" />
      </button>
      <button class="stageLeftBtn" type="button" data-highton="collapse" aria-label="collapse">
        <img class="stageIcon" src="${ICON_DATA_URLS.game}" alt="" aria-hidden="true" />
      </button>
      <section class="shopPanel" data-highton="shopPanel" aria-label="shop">
        <button class="shopClose" type="button" data-highton="shopClose" aria-label="close shop">×</button>
        <button class="shopCard" type="button" data-highton="shop-item" data-item="straw_hat">
          <img class="shopIcon" src="${ICON_DATA_URLS.hat}" alt="" aria-hidden="true" />
          <div class="shopPrice">
            <span class="coinGlyph" aria-hidden="true"></span>
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
        <span class="coinGlyph" aria-hidden="true"></span>
        <span data-highton="feedCost">0</span>
        <span>밥주기</span>
      </button>
    </section>

    <section class="quests" aria-label="quests">
      <div class="questList">
        <div class="questRow" data-highton="q_commit1">
          <div class="questTitle" data-highton="q_title">${QUESTS.commit1.title}</div>
          <div class="questRight">
            <div class="questReward">
              <span>보상:</span>
              <span class="coinGlyph" aria-hidden="true"></span>
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
              <span class="coinGlyph" aria-hidden="true"></span>
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
              <span class="coinGlyph" aria-hidden="true"></span>
              <span data-highton="q_reward">${QUESTS.review1.rewardCoins}</span>
            </div>
            <button class="questBtn" type="button" data-highton="q_claim" data-quest="review1">받기</button>
          </div>
        </div>
      </div>
    </section>
  `
