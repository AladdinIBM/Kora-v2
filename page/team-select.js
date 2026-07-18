import { BasePage } from '@zeppos/zml/base-page'
import {
  align,
  createWidget,
  deleteWidget,
  event,
  text_style,
  widget,
} from '@zos/ui'
import { isLeagueCacheFresh } from '../shared/cache-policy.js'
import { hexToNumber } from '../shared/color.js'
import { ASSETS, COLORS, LEAGUES } from '../shared/constants.js'
import {
  normalizeSelectedTeam,
  restoreSelectedTeam,
  teamBorderColors,
} from '../shared/team-selection.js'
import { reconcileTeamLists } from '../shared/team-list.js'
import { isRtl, t } from '../device/locale.js'
import { receiveDynamicLogo } from '../device/logo-receiver.js'
import {
  goBack,
  parseRouteParams,
  replaceRoute,
  ROUTES,
} from '../device/navigation.js'
import { requestSide } from '../device/request-client.js'
import {
  followTeam,
  getBundledTeams,
  getLeagueCache,
  getSelectedLeagueCode,
  getSelectedTeam,
  hasValidLocalLogo,
  registerDynamicLogo,
  resolveTeamLogo,
  setLeagueCache,
  setSelectedLeagueCode,
  setSelectedTeam,
} from '../device/storage.js'
import {
  createImage,
  createText,
  preparePage,
  SCREEN_WIDTH,
  WidgetRegistry,
} from '../device/ui.js'

const LIST_X = 40
const LIST_Y = 83
const LIST_WIDTH = 310
const LIST_HEIGHT = 367
const ROW_HEIGHT = 71
const ROW_STEP = 76
const ROW_COLOR = 0x161617
const ROW_PRESSED_COLOR = 0x202020
const BORDER_WIDTH = 2
const NAVIGATION_DELAY_MS = 120

function leagueByCode(code) {
  return LEAGUES.find((league) => league.code === code) || LEAGUES[0]
}

function validLeagueCode(code) {
  return LEAGUES.some((league) => league.code === code) ? code : null
}

function teamRowY(index) {
  return index < 4 ? index * ROW_STEP : 303 + (index - 4) * ROW_STEP
}

function leagueLabel(league) {
  return league.code === 'eng.1' ? t('premier_league') : t('la_liga')
}

function leagueHeaderLogo(league) {
  return league.code === 'esp.1'
    ? 'la-liga-symbol.png'
    : league.localLogoPath
}

function addClick(instance, onClick) {
  instance.addEventListener(event.CLICK_DOWN, onClick)
  return instance
}

function createChild(container, type, options, onClick = null) {
  const instance = container.createWidget(type, options)
  return onClick ? addClick(instance, onClick) : instance
}

function createSelectionBorder(container, y, team, onClick) {
  const colors = teamBorderColors(team)
  const primary = hexToNumber(colors.primary, 0x5b5b60)
  const alternate = hexToNumber(colors.alternate, primary)
  const half = LIST_WIDTH / 2
  const segments = [
    { x: 0, y, w: half, h: BORDER_WIDTH, color: primary },
    {
      x: 0,
      y: y + ROW_HEIGHT - BORDER_WIDTH,
      w: half,
      h: BORDER_WIDTH,
      color: primary,
    },
    { x: 0, y, w: BORDER_WIDTH, h: ROW_HEIGHT, color: primary },
    { x: half, y, w: half, h: BORDER_WIDTH, color: alternate },
    {
      x: half,
      y: y + ROW_HEIGHT - BORDER_WIDTH,
      w: half,
      h: BORDER_WIDTH,
      color: alternate,
    },
    {
      x: LIST_WIDTH - BORDER_WIDTH,
      y,
      w: BORDER_WIDTH,
      h: ROW_HEIGHT,
      color: alternate,
    },
  ]

  for (const segment of segments) {
    createChild(
      container,
      widget.FILL_RECT,
      { ...segment, radius: 1, angle: 0 },
      onClick,
    )
  }
}

Page(
  BasePage({
    state: {
      registry: null,
      params: {},
      league: null,
      teams: [],
      listContainer: null,
      rowLogos: null,
      selectedTeamId: null,
      refreshFailed: false,
      navigationTimer: null,
      destroyed: false,
    },

    onInit(params) {
      this.state.registry = new WidgetRegistry()
      this.state.rowLogos = new Map()
      this.state.params = parseRouteParams(params)

      const routedLeague = validLeagueCode(this.state.params.leagueCode)
      const storedLeague = getSelectedLeagueCode()
      this.state.league = leagueByCode(routedLeague || storedLeague)
      setSelectedLeagueCode(this.state.league.code)

      const bundled = getBundledTeams(this.state.league.code)
      const cached = getLeagueCache(this.state.league.code)
      this.state.teams = cached
        ? reconcileTeamLists(bundled, cached.teams)
        : bundled

      const restored = restoreSelectedTeam(
        this.state.teams,
        getSelectedTeam(),
        this.state.league.code,
      )
      this.state.selectedTeamId = restored ? restored.id : null
    },

    build() {
      const registry = this.state.registry
      const rtl = isRtl()
      preparePage(registry)

      createImage(registry, {
        x: rtl ? 308 : 44,
        y: 25,
        w: 38,
        h: 42,
        src: rtl ? 'back-right.png' : 'back-left.png',
        onClick: goBack,
      })
      createImage(registry, {
        x: rtl ? 236 : 106,
        y: 20,
        w: 48,
        h: 48,
        src: leagueHeaderLogo(this.state.league),
      })
      createText(registry, {
        x: rtl ? 24 : 154,
        y: 13,
        w: 212,
        h: 37,
        text: t('choose_team'),
        size: 25,
        alignH: rtl ? align.RIGHT : align.LEFT,
      })
      createText(registry, {
        x: rtl ? 24 : 154,
        y: 47,
        w: 212,
        h: 30,
        text: leagueLabel(this.state.league),
        size: 18,
        color: COLORS.textMuted,
        alignH: rtl ? align.RIGHT : align.LEFT,
      })

      this.renderTeamList(false)
      this.refreshLeagueIfNeeded()
    },

    renderTeamList(keepPosition) {
      const rtl = isRtl()
      const previousPosition =
        keepPosition && this.state.listContainer
          ? Number(this.state.listContainer.pos_y) || 0
          : 0

      if (this.state.listContainer) {
        try {
          deleteWidget(this.state.listContainer)
        } catch {
          // The runtime may already have released a replaced container.
        }
      }

      const container = this.state.registry.add(
        createWidget(widget.VIEW_CONTAINER, {
          x: LIST_X,
          y: LIST_Y,
          w: LIST_WIDTH,
          h: LIST_HEIGHT,
          pos_y: previousPosition,
          scroll_enable: 1,
          bounce: 0,
        }),
      )
      this.state.listContainer = container
      this.state.rowLogos = new Map()

      if (!this.state.teams.length) {
        this.renderEmptyState(container)
        return
      }

      this.state.teams.forEach((team, index) => {
        const y = teamRowY(index)
        const onClick = () => this.selectTeam(index)

        createChild(
          container,
          widget.FILL_RECT,
          {
            x: 0,
            y,
            w: LIST_WIDTH,
            h: ROW_HEIGHT,
            color: ROW_COLOR,
            radius: 10,
            angle: 0,
          },
          onClick,
        )

        if (String(team.id) === this.state.selectedTeamId) {
          createSelectionBorder(container, y, team, onClick)
        }

        const logo = createChild(
          container,
          widget.IMG,
          {
            x: rtl ? 244 : 12,
            y: y + 8,
            w: 54,
            h: 54,
            src: team.localLogoPath || ASSETS.fallbackCrest,
            auto_scale: true,
            auto_scale_obj_fit: false,
          },
          onClick,
        )
        this.state.rowLogos.set(String(team.id), logo)

        createChild(
          container,
          widget.TEXT,
          {
            x: rtl ? 54 : 72,
            y,
            w: 184,
            h: ROW_HEIGHT,
            text: team.displayName || team.name,
            color: COLORS.textPrimary,
            text_size: 20,
            align_h: rtl ? align.RIGHT : align.LEFT,
            align_v: align.CENTER_V,
            text_style: text_style.ELLIPSIS,
          },
          onClick,
        )
        createChild(
          container,
          widget.IMG,
          {
            x: rtl ? 12 : 266,
            y: y + 20,
            w: 32,
            h: 32,
            src: rtl
              ? 'chevron-white-left.png'
              : 'chevron-white-right.png',
            auto_scale: true,
            auto_scale_obj_fit: false,
          },
          onClick,
        )
      })
    },

    renderEmptyState(container) {
      createChild(container, widget.TEXT, {
        x: 12,
        y: 38,
        w: LIST_WIDTH - 24,
        h: 42,
        text: this.state.refreshFailed ? t('update_failed') : t('loading'),
        color: COLORS.textMuted,
        text_size: 18,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.NONE,
      })

      if (this.state.refreshFailed) {
        createChild(container, widget.BUTTON, {
          x: 55,
          y: 94,
          w: 200,
          h: 50,
          text: t('retry'),
          text_size: 18,
          color: COLORS.textPrimary,
          normal_color: ROW_COLOR,
          press_color: ROW_PRESSED_COLOR,
          radius: 10,
          click_func: () => this.refreshLeague(true),
        })
      }
    },

    selectTeam(index) {
      const team = this.state.teams[index]
      const selected = normalizeSelectedTeam(team)
      if (!selected || this.state.destroyed) return

      this.state.selectedTeamId = selected.id
      setSelectedLeagueCode(this.state.league.code)
      setSelectedTeam(selected)
      followTeam(selected)
      this.renderTeamList(true)

      if (
        !selected.localLogoPath &&
        selected.logoUrl &&
        !hasValidLocalLogo(selected.id, selected.logoUrl)
      ) {
        requestSide(
          this,
          'logo.ensure',
          { teamId: selected.id, logoUrl: selected.logoUrl },
          `logo:${selected.id}`,
        ).catch(() => {})
      }

      if (this.state.navigationTimer) {
        clearTimeout(this.state.navigationTimer)
      }
      this.state.navigationTimer = setTimeout(() => {
        if (!this.state.destroyed) {
          replaceRoute(ROUTES.club, { teamId: selected.id })
        }
      }, NAVIGATION_DELAY_MS)
    },

    refreshLeagueIfNeeded() {
      const cache = getLeagueCache(this.state.league.code)
      if (isLeagueCacheFresh(cache)) {
        return
      }
      this.refreshLeague(false)
    },

    refreshLeague(force) {
      if (force) {
        this.state.refreshFailed = false
        this.renderTeamList(true)
      }

      requestSide(
        this,
        'clubs.get',
        { leagueCode: this.state.league.code },
        `clubs:${this.state.league.code}`,
      )
        .then((result) => {
          if (
            this.state.destroyed ||
            !result ||
            !Array.isArray(result.teams)
          ) {
            return
          }
          setLeagueCache(
            this.state.league.code,
            result.teams,
            result.fetchedAt || Date.now(),
          )
          this.state.teams = reconcileTeamLists(
            getBundledTeams(this.state.league.code),
            result.teams.map(resolveTeamLogo),
          )
          this.state.refreshFailed = false

          const restored = restoreSelectedTeam(
            this.state.teams,
            getSelectedTeam(),
            this.state.league.code,
          )
          this.state.selectedTeamId = restored ? restored.id : null
          this.renderTeamList(true)
          this.ensureMissingLogos()
        })
        .catch((error) => {
          if (this.state.destroyed) return
          this.state.refreshFailed = true
          if (!this.state.teams.length) {
            this.renderTeamList(true)
          }
          console.log(`[ClubPulse] league refresh failed: ${error.code}`)
        })
    },

    ensureMissingLogos() {
      const missing = this.state.teams
        .filter(
          (team) =>
            !team.localLogoPath &&
            team.logoUrl &&
            !hasValidLocalLogo(team.id, team.logoUrl),
        )
        .slice(0, 5)

      const next = (index) => {
        if (this.state.destroyed || index >= missing.length) return
        const team = missing[index]
        requestSide(
          this,
          'logo.ensure',
          { teamId: team.id, logoUrl: team.logoUrl },
          `logo:${team.id}`,
        )
          .catch(() => {})
          .finally(() => next(index + 1))
      }
      next(0)
    },

    onReceivedFile(file) {
      receiveDynamicLogo(file, ({ teamId, sourceUrl, localPath }) => {
        if (this.state.destroyed) return
        registerDynamicLogo(teamId, sourceUrl, localPath)
        this.state.teams = this.state.teams.map(resolveTeamLogo)
        const logo = this.state.rowLogos.get(String(teamId))
        if (logo) {
          logo.src = localPath
        }
      })
    },

    onDestroy() {
      this.state.destroyed = true
      if (this.state.navigationTimer) {
        clearTimeout(this.state.navigationTimer)
      }
      this.state.rowLogos?.clear()
      this.state.registry?.clear()
    },
  }),
)
