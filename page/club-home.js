import { BasePage } from '@zeppos/zml/base-page'
import { align, createWidget, prop, text_style, widget } from '@zos/ui'
import {
  fixtureRefreshReason,
  rollFixtureCacheForward,
  shouldRefreshFixtureCache,
} from '../shared/cache-policy.js'
import { readableAccent, hexToNumber } from '../shared/color.js'
import {
  ASSETS,
  COLORS,
  LIVE_POLL_INTERVAL_MS,
  MANUAL_REFRESH_COOLDOWN_MS,
  SUSPENDED_POLL_INTERVAL_MS,
} from '../shared/constants.js'
import { opponentFor } from '../shared/fixture-utils.js'
import {
  formatCompactDayTime,
  formatLastUpdated,
  formatLocalDayDate,
  formatLocalTime,
  formatScore,
  isRtl,
  localizeDigits,
  localizedStatus,
  t,
} from '../device/locale.js'
import { receiveDynamicLogo } from '../device/logo-receiver.js'
import {
  parseRouteParams,
  pushRoute,
  replaceRoute,
  ROUTES,
} from '../device/navigation.js'
import {
  cancelLogicalRequest,
  isRequestInFlight,
  requestSide,
} from '../device/request-client.js'
import {
  getFixtureCache,
  getFollowedTeams,
  getLastViewedTeamId,
  getLaunchRouteState,
  getTeam,
  hasValidLocalLogo,
  registerDynamicLogo,
  setFixtureCache,
  setLastViewedTeamId,
} from '../device/storage.js'
import {
  createClubHeader,
  preparePage,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  setImageAlpha,
  SIDE_PADDING,
  WidgetRegistry,
} from '../device/ui.js'

const LIST_WIDTH = SCREEN_WIDTH - SIDE_PADDING * 2

function mainValue(fixture) {
  if (!fixture) return '—'
  if (fixture.status === 'scheduled') {
    return formatLocalTime(fixture.startTimeUtc)
  }
  if (
    fixture.status === 'postponed' ||
    fixture.status === 'suspended' ||
    fixture.status === 'cancelled'
  ) {
    return '—'
  }
  return formatScore(fixture)
}

function statusBadgeColor(fixture) {
  if (fixture?.status === 'live') return COLORS.live
  if (fixture?.status === 'halftime') return COLORS.halftime
  return 0x2c2c2e
}

function centerDetail(fixture) {
  if (fixture?.status === 'live' && fixture.minute) {
    return localizeDigits(`${fixture.minute}′`)
  }
  return ''
}

function accentFrame(height) {
  return [
    {
      x: 0,
      y: 0,
      w: LIST_WIDTH / 2,
      h: 4,
      key: 'primaryAccent',
      radius: 2,
    },
    {
      x: LIST_WIDTH / 2,
      y: 0,
      w: LIST_WIDTH / 2,
      h: 4,
      key: 'secondaryAccent',
      radius: 2,
    },
    {
      x: 0,
      y: height - 4,
      w: LIST_WIDTH / 2,
      h: 4,
      key: 'primaryAccent',
      radius: 2,
    },
    {
      x: LIST_WIDTH / 2,
      y: height - 4,
      w: LIST_WIDTH / 2,
      h: 4,
      key: 'secondaryAccent',
      radius: 2,
    },
    {
      x: 0,
      y: 0,
      w: 4,
      h: height,
      key: 'primaryAccent',
      radius: 2,
    },
    {
      x: LIST_WIDTH - 4,
      y: 0,
      w: 4,
      h: height,
      key: 'secondaryAccent',
      radius: 2,
    },
  ]
}

function errorTitle(error) {
  const key = {
    PHONE_DISCONNECTED: 'error_phone_disconnected',
    NETWORK_ERROR: 'error_network',
    TIMEOUT: 'error_timeout',
    HTTP_ERROR: 'error_http',
    INVALID_RESPONSE: 'error_invalid_response',
  }[error && error.code]
  return t(key || 'update_failed')
}

function primaryConfig(rtl) {
  return {
    type_id: 1,
    item_height: 238,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 22,
    fill_view: [
      ...accentFrame(238),
      {
        x: rtl ? 12 : LIST_WIDTH - 92,
        y: 12,
        w: 80,
        h: 30,
        key: 'statusBadge',
        radius: 8,
      },
    ],
    fill_view_count: 7,
    text_view: [
      {
        x: rtl ? 96 : 18,
        y: 11,
        w: 218,
        h: 32,
        key: 'competition',
        color: COLORS.textPrimary,
        text_size: 17,
        align_h: rtl ? align.RIGHT : align.LEFT,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: rtl ? 12 : LIST_WIDTH - 92,
        y: 11,
        w: 80,
        h: 31,
        key: 'status',
        color: COLORS.textPrimary,
        text_size: 13,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: 12,
        y: 124,
        w: 112,
        h: 40,
        key: 'homeName',
        color: COLORS.textPrimary,
        text_size: 17,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
      },
      {
        x: LIST_WIDTH - 124,
        y: 124,
        w: 112,
        h: 40,
        key: 'awayName',
        color: COLORS.textPrimary,
        text_size: 17,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
      },
      {
        x: 112,
        y: 58,
        w: 118,
        h: 64,
        key: 'mainValue',
        color: COLORS.textPrimary,
        text_size: 44,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: 116,
        y: 116,
        w: 110,
        h: 28,
        key: 'centerDetail',
        color: COLORS.textPrimary,
        text_size: 18,
        align_h: align.CENTER_H,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: 64,
        y: 199,
        w: LIST_WIDTH - 128,
        h: 28,
        key: 'dateLine',
        color: COLORS.textMuted,
        text_size: 14,
        align_h: align.CENTER_H,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: 22,
        y: 166,
        w: 90,
        h: 25,
        key: 'homeLabel',
        color: COLORS.textMuted,
        text_size: 13,
        align_h: align.CENTER_H,
      },
      {
        x: LIST_WIDTH - 112,
        y: 166,
        w: 90,
        h: 25,
        key: 'awayLabel',
        color: COLORS.textMuted,
        text_size: 13,
        align_h: align.CENTER_H,
      },
    ],
    text_view_count: 9,
    image_view: [
      { x: 34, y: 52, w: 66, h: 66, key: 'homeLogo' },
      { x: LIST_WIDTH - 100, y: 52, w: 66, h: 66, key: 'awayLogo' },
    ],
    image_view_count: 2,
  }
}

function sectionConfig(rtl) {
  return {
    type_id: 2,
    item_height: 52,
    item_bg_color: COLORS.background,
    item_bg_radius: 0,
    text_view: [
      {
        x: 6,
        y: 5,
        w: LIST_WIDTH - 12,
        h: 42,
        key: 'title',
        color: COLORS.textPrimary,
        text_size: 26,
        align_h: rtl ? align.RIGHT : align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      },
    ],
    text_view_count: 1,
  }
}

function upcomingConfig(rtl) {
  return {
    type_id: 3,
    item_height: 74,
    item_bg_color: COLORS.surfaceSecondary,
    item_bg_radius: 16,
    image_view: [
      {
        x: rtl ? 280 : 12,
        y: 12,
        w: 50,
        h: 50,
        key: 'opponentLogo',
      },
    ],
    image_view_count: 1,
    text_view: [
      {
        x: rtl ? 126 : 74,
        y: 7,
        w: rtl ? 138 : 142,
        h: 32,
        key: 'opponentName',
        color: COLORS.textPrimary,
        text_size: 19,
        align_h: rtl ? align.RIGHT : align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: rtl ? 126 : 74,
        y: 39,
        w: rtl ? 138 : 142,
        h: 25,
        key: 'competition',
        color: COLORS.textMuted,
        text_size: 14,
        align_h: rtl ? align.RIGHT : align.LEFT,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: rtl ? 32 : 220,
        y: 16,
        w: 90,
        h: 42,
        key: 'kickoff',
        color: COLORS.textPrimary,
        text_size: 15,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: rtl ? 4 : 310,
        y: 16,
        w: 28,
        h: 42,
        key: 'venue',
        color: COLORS.textPrimary,
        text_size: 18,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
      },
    ],
    text_view_count: 4,
  }
}

function messageConfig(typeId, height, color = COLORS.textMuted) {
  return {
    type_id: typeId,
    item_height: height,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 16,
    fill_view: [
      {
        x: 0,
        y: 0,
        w: 4,
        h: height,
        key: 'marker',
        radius: 2,
      },
    ],
    fill_view_count: 1,
    text_view: [
      {
        x: 14,
        y: 0,
        w: LIST_WIDTH - 28,
        h: height,
        key: 'message',
        color,
        text_size: 15,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
      },
    ],
    text_view_count: 1,
  }
}

function skeletonConfig() {
  return {
    type_id: 5,
    item_height: 238,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 22,
    fill_view: [
      ...accentFrame(238),
      { x: 22, y: 22, w: 150, h: 15, key: 'bar', radius: 7 },
      { x: 30, y: 62, w: 68, h: 68, key: 'bar', radius: 34 },
      { x: 244, y: 62, w: 68, h: 68, key: 'bar', radius: 34 },
      { x: 120, y: 82, w: 102, h: 32, key: 'bar', radius: 10 },
      { x: 90, y: 171, w: 162, h: 14, key: 'bar', radius: 7 },
    ],
    fill_view_count: 11,
    text_view: [
      {
        x: 20,
        y: 196,
        w: LIST_WIDTH - 40,
        h: 28,
        key: 'message',
        color: COLORS.textMuted,
        text_size: 15,
        align_h: align.CENTER_H,
      },
    ],
    text_view_count: 1,
  }
}

function errorConfig() {
  return {
    type_id: 6,
    item_height: 342,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 22,
    fill_view: [
      ...accentFrame(342),
      {
        x: 20,
        y: 216,
        w: LIST_WIDTH - 40,
        h: 52,
        key: 'retryAccent',
        radius: 16,
      },
    ],
    fill_view_count: 7,
    image_view: [{ x: 137, y: 22, w: 68, h: 68, key: 'teamLogo' }],
    image_view_count: 1,
    text_view: [
      {
        x: 18,
        y: 98,
        w: LIST_WIDTH - 36,
        h: 38,
        key: 'title',
        color: COLORS.textPrimary,
        text_size: 22,
        align_h: align.CENTER_H,
        text_style: text_style.ELLIPSIS,
      },
      {
        x: 24,
        y: 140,
        w: LIST_WIDTH - 48,
        h: 60,
        key: 'body',
        color: COLORS.textMuted,
        text_size: 15,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
      },
      {
        x: 20,
        y: 216,
        w: LIST_WIDTH - 40,
        h: 52,
        key: 'retry',
        color: COLORS.textPrimary,
        text_size: 18,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        action: true,
      },
      {
        x: 20,
        y: 278,
        w: LIST_WIDTH - 40,
        h: 50,
        key: 'back',
        color: COLORS.textPrimary,
        bg_color: COLORS.surfaceSecondary,
        bg_radius: 16,
        text_size: 17,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        action: true,
      },
    ],
    text_view_count: 4,
  }
}

function emptyConfig() {
  return {
    type_id: 7,
    item_height: 238,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 22,
    fill_view: accentFrame(238),
    fill_view_count: 6,
    image_view: [{ x: 131, y: 38, w: 80, h: 80, key: 'teamLogo' }],
    image_view_count: 1,
    text_view: [
      {
        x: 24,
        y: 136,
        w: LIST_WIDTH - 48,
        h: 54,
        key: 'message',
        color: COLORS.textPrimary,
        text_size: 22,
        align_h: align.CENTER_H,
        align_v: align.CENTER_V,
        text_style: text_style.WRAP,
      },
    ],
    text_view_count: 1,
  }
}

Page(
  BasePage({
    state: {
      registry: null,
      team: null,
      cache: null,
      list: null,
      header: null,
      active: false,
      destroyed: false,
      loading: false,
      lastError: null,
      lastManualRefreshAt: 0,
      pollTimer: null,
      midnightTimer: null,
      requestSequence: 0,
      built: false,
    },

    onInit(params) {
      this.state.registry = new WidgetRegistry()
      const routeParams = parseRouteParams(params)
      const requestedTeam =
        getTeam(routeParams.teamId) ||
        getTeam(getLastViewedTeamId()) ||
        getTeam(getLaunchRouteState().teamId)
      if (!requestedTeam) {
        replaceRoute(ROUTES.leagues)
        return
      }
      this.state.team = requestedTeam
      setLastViewedTeamId(requestedTeam.id)
      this.state.cache = rollFixtureCacheForward(
        getFixtureCache(requestedTeam.id),
      )
    },

    build() {
      if (!this.state.team) return
      this.rebuildPage()
      this.state.built = true
      // Zepp OS does not call onResume for the initial presentation, so build
      // owns the first refresh. onResume handles later returns.
      this.state.active = true
      this.refreshIfRequired()
      this.configureForegroundTimers()
    },

    rebuildPage() {
      this.state.registry.clear()
      this.state.list = null
      preparePage(this.state.registry)
      const accents = this.teamAccents()
      this.state.header = createClubHeader(this.state.registry, {
        team: this.state.team,
        accent: accents.primary,
        secondaryAccent: accents.secondary,
        refreshing: this.state.loading,
        onOpenTeams: () => replaceRoute(ROUTES.myTeams),
        onRefresh: () => this.manualRefresh(),
        onSettings: () => pushRoute(ROUTES.settings),
      })
      this.renderContent(false)
    },

    teamAccent() {
      return hexToNumber(
        readableAccent(
          this.state.team.color,
          this.state.team.alternateColor,
        ),
      )
    },

    teamAccents() {
      const primary = hexToNumber(
        this.state.team.color,
        COLORS.fallbackAccent,
      )
      const secondary = hexToNumber(
        this.state.team.alternateColor,
        this.teamAccent(),
      )
      return { primary, secondary }
    },

    buildItems() {
      const cache = this.state.cache
      const accents = this.teamAccents()
      if (!cache) {
        if (this.state.lastError) {
          return [
            {
              type_id: 6,
              primaryAccent: accents.primary,
              secondaryAccent: accents.secondary,
              retryAccent: COLORS.fallbackAccent,
              teamLogo: this.state.team.localLogoPath || ASSETS.fallbackCrest,
              title: errorTitle(this.state.lastError),
              body: t('check_connections'),
              retry: t('retry'),
              back: t('back_to_teams'),
            },
          ]
        }
        return [
          {
            type_id: 5,
            primaryAccent: accents.primary,
            secondaryAccent: accents.secondary,
            bar: 0x2c2c2e,
            message: t('loading_matches'),
          },
        ]
      }

      if (!cache.primaryFixture) {
        return [
          {
            type_id: 7,
            primaryAccent: accents.primary,
            secondaryAccent: accents.secondary,
            teamLogo: this.state.team.localLogoPath || ASSETS.fallbackCrest,
            message: t('no_matches'),
          },
        ]
      }

      const primary = cache.primaryFixture
      const items = [
        {
          type_id: 1,
          primaryAccent: accents.primary,
          secondaryAccent: accents.secondary,
          statusBadge: statusBadgeColor(primary),
          competition:
            primary.competitionShortName || primary.competitionName || '—',
          status: localizedStatus(primary.status),
          homeLogo: primary.homeTeam.localLogoPath || ASSETS.fallbackCrest,
          awayLogo: primary.awayTeam.localLogoPath || ASSETS.fallbackCrest,
          homeName: primary.homeTeam.name,
          awayName: primary.awayTeam.name,
          mainValue: mainValue(primary),
          centerDetail: centerDetail(primary),
          dateLine: `${formatLocalDayDate(primary.startTimeUtc)} • ${formatLocalTime(
            primary.startTimeUtc,
          )}`,
          homeLabel: t('home'),
          awayLabel: t('away'),
        },
      ]

      if (this.state.lastError) {
        items.push({
          type_id: 4,
          marker: COLORS.warning,
          message: `${t('update_failed')} • ${t(
            'last_updated',
          )} ${formatLastUpdated(cache.fetchedAt)}`,
        })
      }

      if (cache.upcomingFixtures.length > 0) {
        items.push({ type_id: 2, title: t('upcoming_matches') })
      }

      for (const fixture of cache.upcomingFixtures.slice(0, 5)) {
        const opponent = opponentFor(fixture, this.state.team.id)
        if (!opponent) continue
        items.push({
          type_id: 3,
          opponentLogo:
            opponent.opponent.localLogoPath || ASSETS.fallbackCrest,
          opponentName: opponent.opponent.name,
          competition:
            fixture.competitionShortName || fixture.competitionName || '—',
          kickoff: formatCompactDayTime(fixture.startTimeUtc),
          venue: opponent.venue,
        })
      }
      return items
    },

    renderContent(keepPosition) {
      const rtl = isRtl()
      const items = this.buildItems()
      const typeConfig = items.map((item, index) => ({
        start: index,
        end: index,
        type_id: item.type_id,
      }))

      if (this.state.list) {
        this.state.list.setProperty(prop.UPDATE_DATA, {
          data_array: items,
          data_count: items.length,
          data_type_config: typeConfig,
          data_type_config_count: typeConfig.length,
          on_page: keepPosition ? 1 : 0,
        })
        return
      }

      this.state.list = this.state.registry.add(
        createWidget(widget.SCROLL_LIST, {
          x: SIDE_PADDING,
          y: 88,
          w: LIST_WIDTH,
          h: SCREEN_HEIGHT - 88,
          item_space: 10,
          item_config: [
            primaryConfig(rtl),
            sectionConfig(rtl),
            upcomingConfig(rtl),
            messageConfig(4, 38, COLORS.warning),
            skeletonConfig(),
            errorConfig(),
            emptyConfig(),
          ],
          item_config_count: 7,
          data_array: items,
          data_count: items.length,
          data_type_config: typeConfig,
          data_type_config_count: typeConfig.length,
          auto_rtl: false,
          enable_scroll_bar: true,
          item_click_func: (_list, index, dataKey) => {
            const item = items[index]
            if (!item || item.type_id !== 6) return
            if (dataKey === 'retry') {
              this.manualRefresh()
            } else if (dataKey === 'back') {
              replaceRoute(ROUTES.myTeams)
            }
          },
        }),
      )
    },

    onResume() {
      if (!this.state.team || this.state.destroyed) return
      if (getLaunchRouteState().onboardingRequired) {
        replaceRoute(ROUTES.leagues)
        return
      }
      this.state.active = true
      const selectedTeamId = getLastViewedTeamId()
      if (selectedTeamId && selectedTeamId !== this.state.team.id) {
        const nextTeam = getTeam(selectedTeamId)
        if (nextTeam) {
          this.switchTeam(nextTeam)
          return
        }
      }
      this.refreshIfRequired()
      this.configureForegroundTimers()
    },

    onPause() {
      this.state.active = false
      this.stopForegroundTimers()
      if (this.state.team) {
        cancelLogicalRequest(`schedule:${this.state.team.id}`)
      }
      this.state.requestSequence += 1
      this.state.loading = false
      setImageAlpha(this.state.header?.refresh, 255)
    },

    switchTeam(team) {
      this.stopForegroundTimers()
      this.state.requestSequence += 1
      this.state.team = team
      this.state.cache = rollFixtureCacheForward(getFixtureCache(team.id))
      this.state.lastError = null
      this.state.loading = false
      setLastViewedTeamId(team.id)
      if (this.state.built) {
        this.rebuildPage()
      }
      this.refreshIfRequired()
      this.configureForegroundTimers()
    },

    refreshIfRequired() {
      const reason = fixtureRefreshReason(this.state.cache)
      if (reason) {
        this.refreshSchedule(false)
      }
    },

    manualRefresh() {
      const now = Date.now()
      if (
        now - this.state.lastManualRefreshAt < MANUAL_REFRESH_COOLDOWN_MS ||
        this.state.loading ||
        isRequestInFlight(`schedule:${this.state.team.id}`)
      ) {
        return
      }
      this.state.lastManualRefreshAt = now
      this.refreshSchedule(true)
    },

    refreshSchedule(manual) {
      if (
        !this.state.active ||
        !this.state.team ||
        (!manual &&
          !shouldRefreshFixtureCache(this.state.cache, { nowMs: Date.now() }))
      ) {
        return
      }

      const teamId = this.state.team.id
      const sequence = ++this.state.requestSequence
      this.state.loading = true
      setImageAlpha(this.state.header?.refresh, 100)
      if (!this.state.cache) {
        this.renderContent(false)
      }

      requestSide(
        this,
        'schedule.get',
        {
          teamId,
          nowMs: Date.now(),
          timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
        },
        `schedule:${teamId}`,
      )
        .then((result) => {
          if (
            this.state.destroyed ||
            !this.state.active ||
            sequence !== this.state.requestSequence ||
            teamId !== this.state.team.id ||
            !result ||
            String(result.teamId) !== teamId ||
            !Array.isArray(result.upcomingFixtures) ||
            !Object.prototype.hasOwnProperty.call(result, 'primaryFixture')
          ) {
            return
          }
          setFixtureCache(teamId, result, result.fetchedAt || Date.now())
          this.state.cache = getFixtureCache(teamId)
          this.state.lastError = null
          this.renderContent(true)
          this.ensureFixtureLogos()
        })
        .catch((error) => {
          if (
            this.state.destroyed ||
            sequence !== this.state.requestSequence ||
            teamId !== this.state.team.id
          ) {
            return
          }
          this.state.lastError = error
          this.renderContent(true)
          console.log(`[ClubPulse] schedule refresh failed: ${error.code}`)
        })
        .finally(() => {
          if (
            !this.state.destroyed &&
            sequence === this.state.requestSequence &&
            teamId === this.state.team.id
          ) {
            this.state.loading = false
            setImageAlpha(this.state.header?.refresh, 255)
            this.configureForegroundTimers()
          }
        })
    },

    ensureFixtureLogos() {
      const cache = this.state.cache
      if (!cache) return
      const participants = new Map()
      const fixtures = [
        cache.primaryFixture,
        ...cache.upcomingFixtures,
      ].filter(Boolean)
      for (const fixture of fixtures) {
        participants.set(fixture.homeTeam.id, fixture.homeTeam)
        participants.set(fixture.awayTeam.id, fixture.awayTeam)
      }
      const missing = [...participants.values()].filter(
        (team) =>
          !team.localLogoPath &&
          team.logoUrl &&
          !hasValidLocalLogo(team.id, team.logoUrl),
      )
      const next = (index) => {
        if (
          this.state.destroyed ||
          !this.state.active ||
          index >= missing.length
        ) {
          return
        }
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
        this.state.team = getTeam(this.state.team.id) || this.state.team
        this.state.cache = rollFixtureCacheForward(
          getFixtureCache(this.state.team.id),
        )
        this.renderContent(true)
      })
    },

    configureForegroundTimers() {
      this.stopForegroundTimers()
      if (!this.state.active || !this.state.cache?.primaryFixture) return
      const status = this.state.cache.primaryFixture.status
      if (status === 'live' || status === 'halftime') {
        this.state.pollTimer = setInterval(
          () => this.refreshSchedule(true),
          LIVE_POLL_INTERVAL_MS,
        )
      } else if (status === 'suspended') {
        this.state.pollTimer = setInterval(
          () => this.refreshSchedule(true),
          SUSPENDED_POLL_INTERVAL_MS,
        )
      } else if (status === 'finished') {
        const now = new Date()
        const midnight = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          0,
          0,
          1,
          0,
        )
        this.state.midnightTimer = setTimeout(
          () => {
            this.state.cache = rollFixtureCacheForward(this.state.cache)
            this.renderContent(true)
            this.refreshSchedule(true)
          },
          Math.max(1000, midnight.getTime() - now.getTime()),
        )
      }
    },

    stopForegroundTimers() {
      if (this.state.pollTimer !== null) {
        clearInterval(this.state.pollTimer)
        this.state.pollTimer = null
      }
      if (this.state.midnightTimer !== null) {
        clearTimeout(this.state.midnightTimer)
        this.state.midnightTimer = null
      }
    },

    onDestroy() {
      this.state.destroyed = true
      this.state.active = false
      this.state.requestSequence += 1
      this.stopForegroundTimers()
      if (this.state.team) {
        cancelLogicalRequest(`schedule:${this.state.team.id}`)
      }
      this.state.registry?.clear()
    },
  }),
)
