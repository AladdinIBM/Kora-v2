import { LocalStorage } from '@zos/storage'
import {
  align,
  createWidget,
  deleteWidget,
  event,
  text_style,
  widget,
} from '@zos/ui'
import { push } from '@zos/router'
import { ASSETS, COLORS, STORAGE_KEYS } from '../shared/constants.js'
import { readableAccent, hexToNumber } from '../shared/color.js'
import { safeParseJson } from '../shared/storage-migrations.js'
import {
  formatLastUpdated,
  formatLocalDayDate,
  formatLocalTime,
  formatScore,
  formatStatusWithMinute,
  isRtl,
  t,
} from '../device/locale.js'

const storage = new LocalStorage()
const widgets = []

function add(instance, onOpen) {
  widgets.push(instance)
  if (onOpen) {
    instance.addEventListener(event.CLICK_DOWN, onOpen)
  }
  return instance
}

function clearWidgets() {
  for (const instance of widgets) {
    try {
      deleteWidget(instance)
    } catch {
      // Widget host may already own teardown.
    }
  }
  widgets.length = 0
}

function readSnapshot() {
  const followedTeams = safeParseJson(
    storage.getItem(STORAGE_KEYS.followedTeams, null),
    [],
  )
  const logoIndex = safeParseJson(
    storage.getItem(STORAGE_KEYS.logoIndex, null),
    {},
  )
  const lastViewed = storage.getItem(STORAGE_KEYS.lastViewedTeamId, null)
  const team =
    followedTeams.find((entry) => entry && entry.id === lastViewed) ||
    followedTeams[0] ||
    null
  if (!team) {
    return { team: null, cache: null }
  }
  const dynamic = logoIndex[team.id]
  const resolvedTeam = {
    ...team,
    localLogoPath:
      team.localLogoPath || (dynamic && dynamic.localPath) || null,
  }
  const cache = safeParseJson(
    storage.getItem(STORAGE_KEYS.fixtureCache(team.id), null),
    null,
  )
  return { team: resolvedTeam, cache }
}

function text(options, onOpen) {
  return add(
    createWidget(widget.TEXT, {
      color: COLORS.textPrimary,
      text_size: 18,
      align_v: align.CENTER_V,
      text_style: text_style.ELLIPSIS,
      ...options,
    }),
    onOpen,
  )
}

function image(options, onOpen) {
  return add(
    createWidget(widget.IMG, {
      auto_scale: true,
      auto_scale_obj_fit: false,
      ...options,
    }),
    onOpen,
  )
}

function rect(options, onOpen) {
  return add(
    createWidget(widget.FILL_RECT, {
      angle: 0,
      radius: 0,
      ...options,
    }),
    onOpen,
  )
}

function stroke(options, onOpen) {
  return add(
    createWidget(widget.STROKE_RECT, {
      id: `widget-stroke-${options.x}-${options.y}`,
      angle: 0,
      line_width: 2,
      ...options,
    }),
    onOpen,
  )
}

function drawEmpty(onOpen, team = null, message = t('open_app_load_match')) {
  rect({ x: 0, y: 0, w: 390, h: 450, color: COLORS.background }, onOpen)
  image(
    {
      x: 147,
      y: 82,
      w: 96,
      h: 96,
      src: team?.localLogoPath || ASSETS.appIcon,
    },
    onOpen,
  )
  text(
    {
      x: 24,
      y: 194,
      w: 342,
      h: 44,
      text: team?.name || t('app_name'),
      text_size: 28,
      align_h: align.CENTER_H,
    },
    onOpen,
  )
  text(
    {
      x: 42,
      y: 248,
      w: 306,
      h: 90,
      text: message,
      color: COLORS.textMuted,
      text_size: 18,
      align_h: align.CENTER_H,
      align_v: align.CENTER_V,
      text_style: text_style.WRAP,
    },
    onOpen,
  )
}

function drawMatch(team, cache, onOpen) {
  const rtl = isRtl()
  const accent = hexToNumber(
    readableAccent(team.color, team.alternateColor),
  )
  const fixture = cache.primaryFixture
  rect({ x: 0, y: 0, w: 390, h: 450, color: COLORS.background }, onOpen)
  image(
    {
      x: rtl ? 326 : 24,
      y: 22,
      w: 40,
      h: 40,
      src: team.localLogoPath || ASSETS.fallbackCrest,
    },
    onOpen,
  )
  text(
    {
      x: rtl ? 24 : 76,
      y: 17,
      w: 240,
      h: 50,
      text: team.shortName || team.name,
      text_size: 22,
      align_h: rtl ? align.RIGHT : align.LEFT,
    },
    onOpen,
  )
  rect({ x: 24, y: 76, w: 342, h: 2, color: accent, radius: 1 }, onOpen)
  text(
    {
      x: 28,
      y: 88,
      w: 210,
      h: 30,
      text:
        fixture.competitionShortName || fixture.competitionName || '—',
      color: COLORS.textMuted,
      text_size: 15,
      align_h: rtl ? align.RIGHT : align.LEFT,
    },
    onOpen,
  )
  text(
    {
      x: 242,
      y: 88,
      w: 120,
      h: 30,
      text: formatStatusWithMinute(fixture),
      text_size: 15,
      align_h: rtl ? align.LEFT : align.RIGHT,
    },
    onOpen,
  )
  rect(
    {
      x: 24,
      y: 124,
      w: 342,
      h: 230,
      color: COLORS.surfacePrimary,
      radius: 22,
    },
    onOpen,
  )
  stroke(
    {
      x: 24,
      y: 124,
      w: 342,
      h: 230,
      color: accent,
      radius: 22,
    },
    onOpen,
  )
  image(
    {
      x: 49,
      y: 153,
      w: 64,
      h: 64,
      src: fixture.homeTeam.localLogoPath || ASSETS.fallbackCrest,
    },
    onOpen,
  )
  image(
    {
      x: 277,
      y: 153,
      w: 64,
      h: 64,
      src: fixture.awayTeam.localLogoPath || ASSETS.fallbackCrest,
    },
    onOpen,
  )
  const scoreOrTime =
    fixture.status === 'scheduled'
      ? formatLocalTime(fixture.startTimeUtc)
      : ['postponed', 'suspended', 'cancelled'].includes(fixture.status)
        ? formatStatusWithMinute(fixture)
        : formatScore(fixture)
  text(
    {
      x: 125,
      y: 160,
      w: 140,
      h: 58,
      text: scoreOrTime,
      text_size: 40,
      align_h: align.CENTER_H,
    },
    onOpen,
  )
  text(
    {
      x: 34,
      y: 224,
      w: 110,
      h: 46,
      text: fixture.homeTeam.name,
      text_size: 16,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    },
    onOpen,
  )
  text(
    {
      x: 246,
      y: 224,
      w: 110,
      h: 46,
      text: fixture.awayTeam.name,
      text_size: 16,
      align_h: align.CENTER_H,
      text_style: text_style.WRAP,
    },
    onOpen,
  )
  text(
    {
      x: 88,
      y: 280,
      w: 214,
      h: 28,
      text: `${formatLocalDayDate(fixture.startTimeUtc)} • ${formatLocalTime(
        fixture.startTimeUtc,
      )}`,
      color: COLORS.textMuted,
      text_size: 14,
      align_h: align.CENTER_H,
    },
    onOpen,
  )
  text(
    {
      x: 44,
      y: 314,
      w: 74,
      h: 25,
      text: t('home'),
      color: COLORS.textMuted,
      text_size: 13,
      align_h: align.CENTER_H,
    },
    onOpen,
  )
  text(
    {
      x: 272,
      y: 314,
      w: 74,
      h: 25,
      text: t('away'),
      color: COLORS.textMuted,
      text_size: 13,
      align_h: align.CENTER_H,
    },
    onOpen,
  )
  text(
    {
      x: 24,
      y: 380,
      w: 342,
      h: 30,
      text: `${t('last_updated')} ${formatLastUpdated(cache.fetchedAt)}`,
      color: COLORS.textMuted,
      text_size: 14,
      align_h: align.CENTER_H,
    },
    onOpen,
  )
}

SecondaryWidget({
  state: {
    snapshot: null,
  },

  onInit() {
    try {
      this.state.snapshot = readSnapshot()
    } catch (error) {
      console.log(`[ClubPulse] widget storage error: ${error.message}`)
      this.state.snapshot = { team: null, cache: null }
    }
  },

  build() {
    this.render()
  },

  render() {
    clearWidgets()
    const { team, cache } = this.state.snapshot || {}
    const onOpen = () =>
      push({
        url: team ? 'page/club-home' : 'page/index',
        params: team ? { teamId: team.id } : undefined,
      })
    if (!team || !cache) {
      drawEmpty(onOpen)
      return
    }
    if (!cache.primaryFixture) {
      drawEmpty(onOpen, team, t('no_matches'))
      return
    }
    drawMatch(team, cache, onOpen)
  },

  onResume() {
    try {
      this.state.snapshot = readSnapshot()
      this.render()
    } catch (error) {
      console.log(`[ClubPulse] widget refresh error: ${error.message}`)
    }
  },

  onPause() {},

  onDestroy() {
    clearWidgets()
    this.state.snapshot = null
  },
})
