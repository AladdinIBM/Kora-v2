import { align, createWidget, text_style, widget } from '@zos/ui'
import { ASSETS, COLORS, LEAGUES } from '../shared/constants.js'
import { hexToNumber, readableAccent } from '../shared/color.js'
import { orderMyTeams } from '../shared/team-state.js'
import { isRtl, t } from '../device/locale.js'
import {
  goBack,
  pushRoute,
  replaceRoute,
  ROUTES,
} from '../device/navigation.js'
import {
  getFollowedTeams,
  getLastViewedTeamId,
  setLastViewedTeamId,
} from '../device/storage.js'
import {
  createBackHeader,
  preparePage,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  SIDE_PADDING,
  WidgetRegistry,
} from '../device/ui.js'

const LIST_WIDTH = SCREEN_WIDTH - SIDE_PADDING * 2

function leagueLabel(code) {
  const league = LEAGUES.find((entry) => entry.code === code)
  return league?.abbreviation || code
}

function teamConfig(typeId, current, rtl) {
  return {
    type_id: typeId,
    item_height: 72,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 16,
    fill_view: current
      ? [
          {
            x: rtl ? LIST_WIDTH - 4 : 0,
            y: 0,
            w: 4,
            h: 72,
            key: 'accent',
            radius: 2,
          },
        ]
      : [],
    fill_view_count: current ? 1 : 0,
    image_view: [
      {
        x: rtl ? 280 : 14,
        y: 14,
        w: 44,
        h: 44,
        key: 'logo',
        action: true,
      },
      {
        x: rtl ? 16 : 296,
        y: 20,
        w: 32,
        h: 32,
        key: 'indicator',
        action: true,
      },
    ],
    image_view_count: 2,
    text_view: [
      {
        x: rtl ? 62 : 72,
        y: 7,
        w: 204,
        h: 35,
        key: 'name',
        color: COLORS.textPrimary,
        text_size: 19,
        align_h: rtl ? align.RIGHT : align.LEFT,
        text_style: text_style.ELLIPSIS,
        action: true,
      },
      {
        x: rtl ? 62 : 72,
        y: 39,
        w: 204,
        h: 25,
        key: 'league',
        color: COLORS.textMuted,
        text_size: 14,
        align_h: rtl ? align.RIGHT : align.LEFT,
        action: true,
      },
    ],
    text_view_count: 2,
  }
}

function addConfig(rtl) {
  return {
    type_id: 3,
    item_height: 72,
    item_bg_color: COLORS.surfaceSecondary,
    item_bg_radius: 16,
    image_view: [
      {
        x: rtl ? 286 : 16,
        y: 16,
        w: 40,
        h: 40,
        key: 'logo',
        action: true,
      },
      {
        x: rtl ? 16 : 296,
        y: 20,
        w: 32,
        h: 32,
        key: 'indicator',
        action: true,
      },
    ],
    image_view_count: 2,
    text_view: [
      {
        x: rtl ? 62 : 72,
        y: 0,
        w: 214,
        h: 72,
        key: 'name',
        color: COLORS.textPrimary,
        text_size: 19,
        align_h: rtl ? align.RIGHT : align.LEFT,
        action: true,
      },
    ],
    text_view_count: 1,
  }
}

Page({
    state: {
      registry: null,
      teams: [],
      currentTeamId: null,
    },

    onInit() {
      this.state.registry = new WidgetRegistry()
      this.loadTeams()
    },

    loadTeams() {
      this.state.currentTeamId = getLastViewedTeamId()
      this.state.teams = orderMyTeams(
        getFollowedTeams(),
        this.state.currentTeamId,
      )
    },

    build() {
      const registry = this.state.registry
      const rtl = isRtl()
      preparePage(registry)
      createBackHeader(
        registry,
        t('my_teams'),
        () => this.returnToCurrentClub(),
      )
      const rows = this.state.teams.map((team) => {
        const current = team.id === this.state.currentTeamId
        return {
          type_id: current ? 2 : 1,
          accent: hexToNumber(
            readableAccent(team.color, team.alternateColor),
          ),
          logo: team.localLogoPath || ASSETS.fallbackCrest,
          name: team.name,
          league: leagueLabel(team.leagueCode),
          indicator: current
            ? 'check.png'
            : rtl
              ? 'chevron-left.png'
              : 'chevron-right.png',
        }
      })
      rows.push({
        type_id: 3,
        logo: 'add.png',
        name: t('add_team'),
        indicator: rtl ? 'chevron-left.png' : 'chevron-right.png',
      })
      const typeConfig = rows.map((row, index) => ({
        start: index,
        end: index,
        type_id: row.type_id,
      }))

      registry.add(
        createWidget(widget.SCROLL_LIST, {
          x: SIDE_PADDING,
          y: 76,
          w: LIST_WIDTH,
          h: SCREEN_HEIGHT - 76,
          item_space: 8,
          item_config: [
            teamConfig(1, false, rtl),
            teamConfig(2, true, rtl),
            addConfig(rtl),
          ],
          item_config_count: 3,
          data_array: rows,
          data_count: rows.length,
          data_type_config: typeConfig,
          data_type_config_count: typeConfig.length,
          auto_rtl: false,
          enable_scroll_bar: true,
          item_click_func: (_list, index) => this.selectRow(index),
        }),
      )
    },

    selectRow(index) {
      if (index === this.state.teams.length) {
        pushRoute(ROUTES.leagues, { mode: 'add' })
        return
      }
      const team = this.state.teams[index]
      if (!team) return
      setLastViewedTeamId(team.id)
      replaceRoute(ROUTES.club, { teamId: team.id })
    },

    returnToCurrentClub() {
      const teamId = getLastViewedTeamId()
      if (teamId) {
        replaceRoute(ROUTES.club, { teamId })
        return
      }
      goBack()
    },

    onResume() {
      if (getFollowedTeams().length === 0) {
        replaceRoute(ROUTES.leagues)
      }
    },

    onDestroy() {
      this.state.registry?.clear()
    },
})
