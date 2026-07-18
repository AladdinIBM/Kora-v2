import { align, createWidget, prop, text_style, widget } from '@zos/ui'
import { ASSETS, COLORS, LEAGUES } from '../shared/constants.js'
import { isRtl, t } from '../device/locale.js'
import {
  goBack,
  replaceRoute,
  ROUTES,
} from '../device/navigation.js'
import {
  getFollowedTeams,
  getLastViewedTeamId,
  unfollowTeam,
} from '../device/storage.js'
import {
  createBackHeader,
  preparePage,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  showConfirmation,
  SIDE_PADDING,
  WidgetRegistry,
} from '../device/ui.js'

const LIST_WIDTH = SCREEN_WIDTH - SIDE_PADDING * 2

function leagueLabel(code) {
  return LEAGUES.find((league) => league.code === code)?.abbreviation || code
}

function rowConfig(rtl) {
  return {
    type_id: 1,
    item_height: 72,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 16,
    image_view: [
      {
        x: rtl ? 282 : 14,
        y: 14,
        w: 44,
        h: 44,
        key: 'logo',
      },
      {
        x: rtl ? 12 : 290,
        y: 16,
        w: 40,
        h: 40,
        key: 'trash',
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
        text_size: 18,
        align_h: rtl ? align.RIGHT : align.LEFT,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: rtl ? 62 : 72,
        y: 40,
        w: 204,
        h: 24,
        key: 'league',
        color: COLORS.textMuted,
        text_size: 14,
        align_h: rtl ? align.RIGHT : align.LEFT,
      },
    ],
    text_view_count: 2,
  }
}

Page({
    state: {
      registry: null,
      teams: [],
      list: null,
    },

    onInit() {
      this.state.registry = new WidgetRegistry()
      this.state.teams = getFollowedTeams()
    },

    build() {
      preparePage(this.state.registry)
      createBackHeader(this.state.registry, t('manage_teams'), goBack)
      this.renderList(false)
    },

    renderList(keepPosition) {
      const rtl = isRtl()
      const rows = this.state.teams.map((team) => ({
        logo: team.localLogoPath || ASSETS.fallbackCrest,
        name: team.name,
        league: leagueLabel(team.leagueCode),
        trash: 'trash.png',
      }))
      if (this.state.list) {
        this.state.list.setProperty(prop.UPDATE_DATA, {
          data_array: rows,
          data_count: rows.length,
          data_type_config: rows.length
            ? [{ start: 0, end: rows.length - 1, type_id: 1 }]
            : [],
          data_type_config_count: rows.length ? 1 : 0,
          on_page: keepPosition ? 1 : 0,
        })
        return
      }
      this.state.list = this.state.registry.add(
        createWidget(widget.SCROLL_LIST, {
          x: SIDE_PADDING,
          y: 76,
          w: LIST_WIDTH,
          h: SCREEN_HEIGHT - 76,
          item_space: 8,
          item_config: [rowConfig(rtl)],
          item_config_count: 1,
          data_array: rows,
          data_count: rows.length,
          data_type_config: rows.length
            ? [{ start: 0, end: rows.length - 1, type_id: 1 }]
            : [],
          data_type_config_count: rows.length ? 1 : 0,
          auto_rtl: false,
          enable_scroll_bar: true,
          item_click_func: (_list, index, dataKey) => {
            if (dataKey === 'trash') {
              this.confirmDelete(index)
            }
          },
        }),
      )
    },

    confirmDelete(index) {
      const team = this.state.teams[index]
      if (!team) return
      showConfirmation({
        title: t('delete_team_title'),
        text: t('delete_team_text'),
        onConfirm: () => {
          const wasCurrent = team.id === getLastViewedTeamId()
          const result = unfollowTeam(team.id)
          if (result.onboardingRequired) {
            replaceRoute(ROUTES.leagues)
            return
          }
          this.state.teams = result.followedTeams
          this.renderList(true)
          if (wasCurrent) {
            console.log(
              `[ClubPulse] current team changed to ${result.lastViewedTeamId}`,
            )
          }
        },
      })
    },

    onDestroy() {
      this.state.registry?.clear()
    },
})
