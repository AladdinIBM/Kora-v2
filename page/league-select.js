import { align } from '@zos/ui'
import { ASSETS, COLORS, LEAGUES } from '../shared/constants.js'
import { isRtl, t } from '../device/locale.js'
import {
  goBack,
  parseRouteParams,
  pushRoute,
  ROUTES,
} from '../device/navigation.js'
import {
  createImage,
  createImageButton,
  createRect,
  createText,
  preparePage,
  SCREEN_WIDTH,
  SIDE_PADDING,
  WidgetRegistry,
} from '../device/ui.js'

const LOCALIZED_LEAGUE = {
  'eng.1': { name: 'premier_league', country: 'england' },
  'esp.1': { name: 'la_liga', country: 'spain' },
}

const CARD_ACCENTS = {
  'eng.1': 0x8e24aa,
  'esp.1': 0xff453a,
}

Page({
    state: {
      registry: null,
      mode: 'first',
    },

    onInit(params) {
      this.state.registry = new WidgetRegistry()
      this.state.mode = parseRouteParams(params).mode || 'first'
    },

    build() {
      const registry = this.state.registry
      const rtl = isRtl()
      const addMode = this.state.mode === 'add'
      preparePage(registry)

      if (addMode) {
        createImageButton(registry, {
          x: rtl ? 326 : SIDE_PADDING,
          y: 24,
          w: 40,
          h: 40,
          src: rtl ? 'back-right.png' : 'back-left.png',
          onClick: goBack,
        })
      }

      createImage(registry, {
        x: 171,
        y: 31,
        w: 48,
        h: 48,
        src: ASSETS.appIcon,
      })
      createText(registry, {
        x: SIDE_PADDING,
        y: 80,
        w: SCREEN_WIDTH - SIDE_PADDING * 2,
        h: 40,
        text: t('choose_league'),
        size: 32,
        alignH: align.CENTER_H,
      })
      createText(registry, {
        x: SIDE_PADDING,
        y: 121,
        w: SCREEN_WIDTH - SIDE_PADDING * 2,
        h: 34,
        text: t('add_more_later'),
        color: COLORS.textMuted,
        size: 18,
        alignH: align.CENTER_H,
      })

      LEAGUES.forEach((league, index) => {
        const y = 178 + index * 122
        const accent = CARD_ACCENTS[league.code] || COLORS.fallbackAccent
        const onClick = () =>
          pushRoute(ROUTES.teams, {
            leagueCode: league.code,
            mode: this.state.mode,
          })
        createRect(registry, {
          x: 30,
          y,
          w: 325,
          h: 107,
          color: accent,
          radius: 20,
          onClick,
        })
        createRect(registry, {
          x: rtl ? 30 : 34,
          y,
          w: 321,
          h: 107,
          color: COLORS.surfacePrimary,
          radius: 20,
          onClick,
        })
        if (league.code === 'eng.1') {
          createImage(registry, {
            x: rtl ? 269 : 49,
            y: y + 14,
            w: 72,
            h: 72,
            src: league.localLogoPath,
            onClick,
          })
        } else {
          createImage(registry, {
            x: rtl ? 280 : 52,
            y: y + 22,
            w: 58,
            h: 60,
            src: league.localLogoPath,
            onClick,
          })
        }
        createText(registry, {
          x: rtl ? 94 : 130,
          y: y + 23,
          w: 166,
          h: 36,
          text:
            league.code === 'esp.1' && !rtl
              ? 'LaLiga'
              : t(LOCALIZED_LEAGUE[league.code].name),
          size: 22,
          alignH: rtl ? align.RIGHT : align.LEFT,
          onClick,
        })
        createText(registry, {
          x: rtl ? 94 : 130,
          y: y + 59,
          w: 166,
          h: 28,
          text: t(LOCALIZED_LEAGUE[league.code].country),
          color: COLORS.textMuted,
          size: 16,
          alignH: rtl ? align.RIGHT : align.LEFT,
          onClick,
        })
        createImage(registry, {
          x: rtl ? 43 : 315,
          y: y + 37,
          w: 32,
          h: 32,
          src: rtl ? 'chevron-left.png' : 'chevron-right.png',
          onClick,
        })
      })
    },

    onDestroy() {
      this.state.registry?.clear()
    },
})
