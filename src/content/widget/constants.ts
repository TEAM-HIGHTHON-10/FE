import type { AccessoryKey, HatAnchor, Mood, QuestKey, SimEvent, TierKey } from './types'

export const ROOT_ID = 'highton-github-widget-root'
export const STORAGE_KEY = 'highton_pet_state_v2'
export const MINIMIZE_KEY = 'highton_widget_minimized'
export const POSITION_KEY = 'highton_widget_position'

export const DEBUG = false

export const EXP_PER_LEVEL = 100
export const LEVELS_PER_TIER = 1
export const TIERS: ReadonlyArray<{ key: TierKey }> = [
  { key: 'Newbie' },
  { key: 'Junior' },
  { key: 'Mid' },
  { key: 'Senior' },
]
export const MAX_LEVEL_INDEX = TIERS.length * LEVELS_PER_TIER - 1
export const MAX_TOTAL_EXP = (MAX_LEVEL_INDEX + 1) * EXP_PER_LEVEL

export const COMMIT_COOLDOWN_MS = 60_000
export const TEST_COIN_AMOUNT = 200

export const SHOP_ITEMS: Array<{ key: AccessoryKey; name: string; price: number }> = [
  { key: 'straw_hat', name: '밀짚모자', price: 100 },
]

export const QUEST_ORDER: readonly QuestKey[] = ['commit1', 'pr1', 'review1'] as const

export const QUESTS: Record<QuestKey, { title: string; rewardCoins: number }> = {
  commit1: { title: 'commit 1회 하기', rewardCoins: 10 },
  pr1: { title: 'PR 1회 보내기', rewardCoins: 10 },
  review1: { title: 'Issue 1회 등록하기', rewardCoins: 10 },
}

export const EVENT_REWARDS: Record<SimEvent, { coins: number; exp: number; label: string }> = {
  COMMIT: { coins: 2, exp: 8, label: 'Commit' },
  PULL_REQUEST: { coins: 5, exp: 25, label: 'PR Open' },
  REVIEW: { coins: 3, exp: 15, label: 'Review' },
}

export const HAT_ANCHORS: Record<TierKey, HatAnchor> = {
  Newbie: {
    x: 3,
    y: 10,
    headRatio: 0.4,
    hatWidth: 55,
    toastGap: 20,
    toastNoHatGap: 50,
    miniX: 2,
    miniY: 5,
    miniHeadRatio: 0.42,
    miniHatWidth: 34,
    miniBadgeX: 22,
    miniBadgeY: -4,

  },
  Junior: {
    x: -5,
    y: 30,
    headRatio: 0.32,
    hatWidth: 55,
    toastGap: 10,
    toastNoHatGap: 20,
    miniX: -2,
    miniY: 10,
    miniHeadRatio: 0.36,
    miniHatWidth: 38,
    miniBadgeX: 24,
    miniBadgeY: -6,

  },
  Mid: {
    x: -10,
    y: 10,
    headRatio: 0.28,
    hatWidth: 100,
    toastGap: 20,
    toastNoHatGap: 60,
    miniX: -5,
    miniY: 1,
    miniHeadRatio: 0.32,
    miniHatWidth: 60,
    miniBadgeX: 28,
    miniBadgeY: -4,

  },
  Senior: {
    x: -25,
    y: 1,
    headRatio: 0.22,
    hatWidth: 130,
    toastGap: 15,
    toastNoHatGap: 70,
    miniX: -15,
    miniY: -5,
    miniHeadRatio: 0.26,
    miniHatWidth: 70,
    miniBadgeX: 32,
    miniBadgeY: -2,

  },
}

export const PET_TALKS: Record<TierKey, Record<Mood, string[]>> = {
  Newbie: {
    GOOD: [
      '웃어주셔서 저도 꼬리가 절로 흔들려요!',
      '오늘은 함께 있는 것만으로도 참 좋아요!',
      '햇살 좋은 날 같아서 마음이 따뜻해져요.',
      '눈을 마주치면 기분이 몽글몽글해져요.',
      '정말 잘하고 계세요. 오늘도 행복 스탬프 하나 찍어요!',
    ],
    NORMAL: [
      '괜찮아요. 천천히 하셔도 제가 옆에 있을게요.',
      '잠깐 숨 고르시고 제 머리도 한번 쓰다듬어주세요!',
      '우리 페이스대로 천천히 걸어가면 돼요.',
      '지금 이 순간도 충분히 소중해요.',
      '조용히 함께 있는 것만으로도 힘이 돼요.',
    ],
    BAD: [
      '오늘 마음이 무거우시면 제 곁에서 잠깐 쉬어가세요.',
      '괜찮아요. 당신의 속도는 언제나 옳아요.',
      '힘드시면 제가 먼저 꼭 안아드릴게요.',
      '천천히 하셔도 괜찮아요. 저는 기다릴 수 있어요.',
      '표정이 다시 밝아질 때까지 옆에 있을게요.',
    ],
  },
  Junior: {
    GOOD: [
      '함께 있으면 하루가 반짝반짝 빛나요!',
      '좋은 에너지가 느껴져서 저도 신나요!',
      '지금 분위기가 정말 포근하고 좋아요.',
      '작은 성취도 함께 기뻐하고 싶어요!',
      '오늘은 기분 좋은 바람이 부는 날 같아요!',
    ],
    NORMAL: [
      '저희 차분하게 하나씩 해보아요.',
      '서두르지 않으셔도 괜찮아요. 저는 늘 당신 편이에요.',
      '따뜻한 차 한 모금 같은 순간이에요.',
      '오늘도 우리만의 리듬으로 가보아요.',
      '평온해 보이시면 저도 행복해요.',
    ],
    BAD: [
      '괜찮아요. 오늘은 제가 마음을 지켜드릴게요.',
      '잠깐 눈 감고 쉬셔도 돼요. 저는 여기 있어요.',
      '흔들리는 날에는 더 천천히 걸으면 돼요.',
      '너무 애쓰지 않으셔도 돼요. 충분히 잘하고 계세요.',
      '힘드실 땐 제 이름을 한번 불러주세요.',
    ],
  },
  Mid: {
    GOOD: [
      '눈빛이 반짝여서 저도 덩달아 행복해요!',
      '오늘 모습이 정말 멋지고 따뜻해 보여요.',
      '지금 이 순간을 오래 기억하고 싶어요!',
      '함께 있는 시간이 큰 힘이 돼요.',
      '우리의 하루가 예쁘게 차곡차곡 쌓이고 있어요.',
    ],
    NORMAL: [
      '심호흡 한 번 하시고, 다시 함께 가요.',
      '하루에 작은 미소를 더해드릴게요.',
      '차분한 오늘도 충분히 아름다워요.',
      '곁을 지키는 게 제 가장 큰 일상이에요.',
      '함께라면 평범한 순간도 특별해져요.',
    ],
    BAD: [
      '마음이 지치실 땐 제 옆에 기대셔도 돼요.',
      '오늘은 버텨낸 것만으로도 충분해요.',
      '괜찮아질 때까지 조용히 기다릴게요.',
      '조금 울적해도 우리는 함께예요.',
      '힘드시면 잠깐 멈춰도 돼요. 저는 도망가지 않아요.',
    ],
  },
  Senior: {
    GOOD: [
      '함께해 주셔서 제 세상도 단단해져요.',
      '오늘 모습은 보는 것만으로도 힘이 돼요.',
      '함께 걸어온 시간들이 반짝이고 있어요.',
      '그 미소를 오래오래 지켜드리고 싶어요.',
      '지금처럼만 우리 행복하게 가요.',
    ],
    NORMAL: [
      '천천히, 그러나 따뜻하게. 그게 우리 방식이에요!',
      '편안해 보이시면 저도 마음이 놓여요.',
      '조용히 옆에 앉아 있는 지금이 참 좋아요.',
      '오늘도 충분히 멋진 하루예요.',
      '서두르지 않아도 충분히 잘 해내실 수 있어요.',
    ],
    BAD: [
      '지친 마음은 제가 살살 달래드릴게요.',
      '오늘은 아무것도 하지 않으셔도 괜찮아요.',
      '다시 웃으실 때까지 곁을 지킬게요.',
      '힘이 빠지실 땐 제 온기로 쉬어가세요.',
      '괜찮아요. 우리는 언제든 다시 시작할 수 있어요.',
    ],
  },
}
