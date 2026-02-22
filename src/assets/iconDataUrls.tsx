import { createElement, type ComponentType, type SVGProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Background } from './Background'
import { Cart } from './Cart'
import { Game } from './Game'
import { Junior } from './Junior'
import { JuniorHat } from './JuniorHat'
import { Mid } from './Mid'
import { MidHat } from './MidHat'
import { Newbie } from './Newbie'
import { NewbieHat } from './NewbieHat'
import { Senior } from './Senior'
import { SeniorHat } from './SeniorHat'
import { Hat } from './Hat'
import { Stone } from './Stone'
import { GoldEgg } from './GoldEgg'
import { Egg } from './Egg'
import { NewbieGame } from './NewbieGame'
import { JuniorGame } from './JuniorGame'
import { MidGame } from './MidGame'
import { NewbieGameDie } from './NewbieGameDie'
import { JuniorGameDie } from './JuniorGameDie'
import { MidGameDie } from './MidGameDie'
import { SeniorGameDie } from './SeniorGameDie'
import { NewbieGameHat } from './NewbieGameHat'
import { JuniorGameHat } from './JuniorGameHat'
import { MidGameHat } from './MidGameHat'
import { SeniorGameHat } from './SeniorGameHat'
import { Senior as SeniorGame } from './SeniorGame'

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>

const toDataUrl = (Icon: SvgComponent) => {
  const markup = renderToStaticMarkup(createElement(Icon))
  return `data:image/svg+xml,${encodeURIComponent(markup)}`
}

export const ICON_DATA_URLS = {
  background: toDataUrl(Background),
  game: toDataUrl(Game),
  cart: toDataUrl(Cart),
  newbie: toDataUrl(Newbie),
  newbieHat: toDataUrl(NewbieHat),
  junior: toDataUrl(Junior),
  juniorHat: toDataUrl(JuniorHat),
  mid: toDataUrl(Mid),
  midHat: toDataUrl(MidHat),
  senior: toDataUrl(Senior),
  seniorHat: toDataUrl(SeniorHat),
  hat: toDataUrl(Hat),
  stone: toDataUrl(Stone),
  goldEgg: toDataUrl(GoldEgg),
  egg: toDataUrl(Egg),
  newbieGame: toDataUrl(NewbieGame),
  juniorGame: toDataUrl(JuniorGame),
  midGame: toDataUrl(MidGame),
  seniorGame: toDataUrl(SeniorGame),
  newbieGameDie: toDataUrl(NewbieGameDie),
  juniorGameDie: toDataUrl(JuniorGameDie),
  midGameDie: toDataUrl(MidGameDie),
  seniorGameDie: toDataUrl(SeniorGameDie),
  newbieGameHat: toDataUrl(NewbieGameHat),
  juniorGameHat: toDataUrl(JuniorGameHat),
  midGameHat: toDataUrl(MidGameHat),
  seniorGameHat: toDataUrl(SeniorGameHat),
} as const
