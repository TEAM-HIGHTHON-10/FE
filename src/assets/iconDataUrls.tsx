import { createElement, type ComponentType, type SVGProps } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Background } from './Background'
import { Cart } from './Cart'
import { Game } from './Game'
import { Junior } from './Junior'
import { Mid } from './Mid'
import { Newbie } from './Newbie'
import { Senior } from './Senior'
import { Hat } from './Hat'
import { Stone } from './Stone'
import { GoldEgg } from './GoldEgg'
import { Egg } from './Egg'

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
  junior: toDataUrl(Junior),
  mid: toDataUrl(Mid),
  senior: toDataUrl(Senior),
  hat: toDataUrl(Hat),
  stone: toDataUrl(Stone),
  goldEgg: toDataUrl(GoldEgg),
  egg: toDataUrl(Egg),
} as const
