import { BasePage } from '@zeppos/zml/base-page'
import {
  align,
  createWidget,
  deleteWidget,
  text_style,
  widget,
} from '@zos/ui'
import {
  fixtureRefreshReason,
  rollFixtureCacheForward,
  shouldRefreshFixtureCache,
} from '../shared/cache-policy.js'
import {
  CLUB_HOME_LAYOUT,
  CLUB_HOME_UPCOMING_LIMIT,
  deriveScheduledClubHomeView,
} from '../shared/club-home-view.js'
import { hexToNumber } from '../shared/color.js'
import {
  ASSETS,
  COLORS,
  LIVE_POLL_INTERVAL_MS,
  MANUAL_REFRESH_COOLDOWN_MS,
  SUSPENDED_POLL_INTERVAL_MS,
} from '../shared/constants.js'
import { opponentFor } from '../shared/fixture-utils.js'
import { teamBorderColors } from '../shared/team-selection.js'
import {
  formatCompactDayTime,
  formatLocalTime,
  formatMatchDayDate,
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
  getLastViewedTeamId,
  getLaunchRouteState,
  getTeam,
  hasValidLocalLogo,
  registerDynamicLogo,
  setFixtureCache,
  setLastViewedTeamId,
  setSelectedTeam,
} from '../device/storage.js'
import {
  createClubHeader,
  preparePage,
  setImageAlpha,
  WidgetRegistry,
} from '../device/ui.js'

const DISPLAY_WIDTH = CLUB_HOME_LAYOUT.display.width
const DISPLAY_HEIGHT = CLUB_HOME_LAYOUT.display.height
const DISPLAY_SURFACE = 0x121212
const DISPLAY_BORDER = 0x292929
const UPCOMING_SURFACE = 0x171717
const SKELETON_COLOR = 0x2a2a2a

function createChild(container, type, options) {
  return container.createWidget(type, options)
}

function childText(
  container,
  {
    x,
    y,
    w,
    h,
    text,
    color = COLORS.textPrimary,
    size = 18,
    alignH = align.LEFT,
    alignV = align.CENTER_V,
    style = text_style.ELLIPSIS,
  },
) {
  return createChild(container, widget.TEXT, {
    x,
    y,
    w,
    h,
    text,
    color,
    text_size: size,
    align_h: alignH,
    align_v: alignV,
    text_style: style,
  })
}

function childImage(container, { x, y, w, h, src }) {
  return createChild(container, widget.IMG, {
    x,
    y,
    w,
    h,
    src: src || ASSETS.teamPlaceholder,
    auto_scale: true,
    auto_scale_obj_fit: false,
  })
}

function childRect(
  container,
  { x, y, w, h, color, radius = 0 },
) {
  return createChild(container, widget.FILL_RECT, {
    x,
    y,
    w,
    h,
    color,
    radius,
    angle: 0,
  })
}

function displaySurface(container) {
  childRect(container, {
    x: 0,
    y: 0,
    w: DISPLAY_WIDTH,
    h: DISPLAY_HEIGHT,
    color: DISPLAY_SURFACE,
    radius: CLUB_HOME_LAYOUT.display.radius,
  })
}

function displayChrome(container, accents) {
  const half = Math.ceil(DISPLAY_WIDTH / 2)
  const cornerRadius = CLUB_HOME_LAYOUT.display.radius
  const accentRadius = cornerRadius - 2
  const arcSize = accentRadius * 2
  const arcY = DISPLAY_HEIGHT - cornerRadius - accentRadius
  const leftArcX = cornerRadius - accentRadius
  const rightArcX =
    DISPLAY_WIDTH - cornerRadius - accentRadius
  const leftJoinX = cornerRadius
  const rightJoinX = DISPLAY_WIDTH - cornerRadius
  const accentY =
    DISPLAY_HEIGHT - CLUB_HOME_LAYOUT.display.accentHeight

  createChild(container, widget.ARC, {
    x: leftArcX,
    y: arcY + 2,
    w: arcSize,
    h: arcSize,
    radius: accentRadius,
    start_angle: 90,
    end_angle: 180,
    line_width: CLUB_HOME_LAYOUT.display.accentHeight,
    color: accents.primary,
  })
  childRect(container, {
    x: leftJoinX- 4,
    y: accentY,
    w: half - leftJoinX + 4,
    h: CLUB_HOME_LAYOUT.display.accentHeight,
    color: accents.primary,
  })
  childRect(container, {
    x: half,
    y: accentY,
    w: rightJoinX - half + 4,
    h: CLUB_HOME_LAYOUT.display.accentHeight,
    color: accents.secondary,
  })
  createChild(container, widget.ARC, {
    x: rightArcX,
    y: arcY + 2,
    w: arcSize,
    h: arcSize,
    radius: accentRadius,
    start_angle: 0,
    end_angle: 90,
    line_width: CLUB_HOME_LAYOUT.display.accentHeight ,
    color: accents.secondary,
  })
  createChild(container, widget.STROKE_RECT, {
    id: 'club-home-display-border',
    x: 0,
    y: 0,
    w: DISPLAY_WIDTH,
    h: DISPLAY_HEIGHT,
    color: DISPLAY_BORDER,
    radius: CLUB_HOME_LAYOUT.display.radius,
    line_width: CLUB_HOME_LAYOUT.display.borderWidth,
    angle: 0,
  })
}

function mainValue(fixture) {
  if (!fixture) return '—'
  if (fixture.status === 'scheduled') {
    return 'VS'
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

function centerDetail(fixture) {
  if (fixture?.status === 'live' && fixture.minute) {
    return localizeDigits(`${fixture.minute}′ ${t('played')}`)
  }
  return localizedStatus(fixture?.status)
}

function teamLogo(team) {
  return team?.localLogoPath || ASSETS.teamPlaceholder
}

function competitionName(fixture) {
  return (
    fixture?.competitionName ||
    fixture?.competitionShortName ||
    '—'
  )
}

function competitionShortName(fixture) {
  return (
    fixture?.competitionShortName ||
    fixture?.competitionName ||
    '—'
  )
}

function mirrorX(x, width) {
  return DISPLAY_WIDTH - x - width
}

function logicalX(x, width, rtl) {
  return rtl ? mirrorX(x, width) : x
}

function renderMatchDisplay(
  container,
  fixture,
  accents,
  { scheduled = false } = {},
) {
  const rtl = isRtl()
  displaySurface(container)

  childText(container, {
    x: 14,
    y: 14,
    w: 323,
    h: 19,
    text: competitionName(fixture),
    size: 16,
    alignH: rtl ? align.RIGHT : align.LEFT,
  })
  childText(container, {
    x: 14,
    y: 36,
    w: 323,
    h: 16,
    text: formatMatchDayDate(fixture.startTimeUtc),
    color: COLORS.textMuted,
    size: 12,
    alignH: align.CENTER_H,
  })
  childText(container, {
    x: 14,
    y: 51,
    w: 323,
    h: 31,
    text: formatLocalTime(fixture.startTimeUtc),
    size: 25,
    alignH: align.CENTER_H,
  })

  childImage(container, {
    x: 38,
    y: 111,
    w: 82,
    h: 82,
    src: teamLogo(fixture.homeTeam),
  })
  childImage(container, {
    x: 231,
    y: 111,
    w: 82,
    h: 82,
    src: teamLogo(fixture.awayTeam),
  })
  childText(container, {
    x: 14,
    y: 195,
    w: 130,
    h: 22,
    text: fixture.homeTeam?.name || '—',
    size: 17,
    alignH: align.CENTER_H,
  })
  childText(container, {
    x: 207,
    y: 195,
    w: 130,
    h: 22,
    text: fixture.awayTeam?.name || '—',
    size: 17,
    alignH: align.CENTER_H,
  })
  childText(container, {
    x: 146,
    y: 126,
    w: 59,
    h: 52,
    text: scheduled ? 'VS' : mainValue(fixture),
    size: scheduled ? 28 : 23,
    alignH: align.CENTER_H,
  })

  if (scheduled) {
    childText(container, {
      x: 70,
      y: 254,
      w: 211,
      h: 18,
      text: fixture.venueName || '',
      size: 12,
      alignH: align.CENTER_H,
    })
    childText(container, {
      x: 70,
      y: 277,
      w: 211,
      h: 19,
      text: t('next_match'),
      color: COLORS.textMuted,
      size: 13,
      alignH: align.CENTER_H,
    })
  } else {
    childText(container, {
      x: 55,
      y: 264,
      w: 241,
      h: 24,
      text: centerDetail(fixture),
      color:
        fixture.status === 'live'
          ? COLORS.textPrimary
          : COLORS.textMuted,
      size: fixture.status === 'live' ? 16 : 13,
      alignH: align.CENTER_H,
    })
  }

  if (fixture.status === 'live') {
    childRect(container, {
      x: logicalX(285, 52, rtl),
      y: 13,
      w: 52,
      h: 22,
      color: 0xff3344,
      radius: 7,
    })
    childText(container, {
      x: logicalX(285, 52, rtl),
      y: 13,
      w: 52,
      h: 22,
      text: t('status_live'),
      size: 12,
      alignH: align.CENTER_H,
    })
  }

  displayChrome(container, accents)
}

function renderStateDisplay(
  container,
  accents,
  { icon, title, body = '' },
) {
  displaySurface(container)
  childImage(container, {
    x: 151,
    y: 112,
    w: 49,
    h: 49,
    src: icon,
  })
  childText(container, {
    x: 32,
    y: 170,
    w: 287,
    h: 27,
    text: title,
    size: 19,
    alignH: align.CENTER_H,
  })
  if (body) {
    childText(container, {
      x: 33,
      y: 202,
      w: 285,
      h: 38,
      text: body,
      color: COLORS.textMuted,
      size: 12,
      alignH: align.CENTER_H,
      style: text_style.WRAP,
    })
  }
  displayChrome(container, accents)
}

function renderUpcomingHeading(container) {
  childText(container, {
    x: 0,
    y: CLUB_HOME_LAYOUT.upcoming.y,
    w: DISPLAY_WIDTH,
    h: CLUB_HOME_LAYOUT.upcoming.headingHeight,
    text: t('upcoming_matches'),
    size: 18,
    alignH: isRtl() ? align.RIGHT : align.LEFT,
  })
}

function renderUpcomingRows(container, fixtures, selectedTeamId) {
  const rtl = isRtl()
  renderUpcomingHeading(container)
  let rendered = 0

  for (const fixture of fixtures.slice(0, CLUB_HOME_UPCOMING_LIMIT)) {
    const opponent = opponentFor(fixture, selectedTeamId)
    if (!opponent) continue
    const rowY =
      CLUB_HOME_LAYOUT.upcoming.firstRowY +
      rendered *
        (CLUB_HOME_LAYOUT.upcoming.rowHeight +
          CLUB_HOME_LAYOUT.upcoming.rowGap)
    childRect(container, {
      x: 0,
      y: rowY,
      w: DISPLAY_WIDTH,
      h: CLUB_HOME_LAYOUT.upcoming.rowHeight,
      color: UPCOMING_SURFACE,
      radius: 9,
    })
    childImage(container, {
      x: logicalX(8, 23, rtl),
      y: rowY + 3,
      w: 23,
      h: 23,
      src: teamLogo(opponent.opponent),
    })
    childText(container, {
      x: logicalX(42, 132, rtl),
      y: rowY,
      w: 132,
      h: CLUB_HOME_LAYOUT.upcoming.rowHeight,
      text: opponent.opponent.name,
      size: 12,
      alignH: rtl ? align.RIGHT : align.LEFT,
    })
    childText(container, {
      x: logicalX(178, 54, rtl),
      y: rowY,
      w: 54,
      h: CLUB_HOME_LAYOUT.upcoming.rowHeight,
      text: competitionShortName(fixture),
      color: COLORS.textMuted,
      size: 9,
      alignH: rtl ? align.RIGHT : align.LEFT,
    })
    childText(container, {
      x: logicalX(237, 80, rtl),
      y: rowY,
      w: 80,
      h: CLUB_HOME_LAYOUT.upcoming.rowHeight,
      text: formatCompactDayTime(fixture.startTimeUtc),
      size: 11,
      alignH: align.CENTER_H,
    })
    childText(container, {
      x: logicalX(327, 16, rtl),
      y: rowY,
      w: 16,
      h: CLUB_HOME_LAYOUT.upcoming.rowHeight,
      text: opponent.venue,
      color: COLORS.textMuted,
      size: 11,
      alignH: align.CENTER_H,
    })
    rendered += 1
  }

  if (rendered === 0) {
    childText(container, {
      x: 20,
      y: CLUB_HOME_LAYOUT.upcoming.firstRowY + 20,
      w: DISPLAY_WIDTH - 40,
      h: 48,
      text: t('no_upcoming_matches'),
      color: COLORS.textMuted,
      size: 13,
      alignH: align.CENTER_H,
    })
  }
}

function renderSkeletonRows(container) {
  renderUpcomingHeading(container)
  for (let index = 0; index < CLUB_HOME_UPCOMING_LIMIT; index += 1) {
    const rowY =
      CLUB_HOME_LAYOUT.upcoming.firstRowY +
      index *
        (CLUB_HOME_LAYOUT.upcoming.rowHeight +
          CLUB_HOME_LAYOUT.upcoming.rowGap)
    childRect(container, {
      x: 0,
      y: rowY,
      w: DISPLAY_WIDTH,
      h: CLUB_HOME_LAYOUT.upcoming.rowHeight,
      color: UPCOMING_SURFACE,
      radius: 9,
    })
    childRect(container, {
      x: 8,
      y: rowY + 3,
      w: 22,
      h: 22,
      color: SKELETON_COLOR,
      radius: 11,
    })
    childRect(container, {
      x: 42,
      y: rowY + 11,
      w: 132,
      h: 7,
      color: SKELETON_COLOR,
      radius: 4,
    })
    childRect(container, {
      x: 237,
      y: rowY + 11,
      w: 60,
      h: 7,
      color: SKELETON_COLOR,
      radius: 4,
    })
  }
}

Page(
  BasePage({
    state: {
      registry: null,
      team: null,
      cache: null,
      contentContainer: null,
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
      this.state.team = setSelectedTeam(requestedTeam) || requestedTeam
      setLastViewedTeamId(requestedTeam.id)
      this.state.cache = rollFixtureCacheForward(
        getFixtureCache(requestedTeam.id),
      )
    },

    build() {
      if (!this.state.team) return
      this.rebuildPage()
      this.state.built = true
      this.state.active = true
      this.refreshIfRequired()
      this.ensureFixtureLogos()
      this.configureForegroundTimers()
    },

    rebuildPage() {
      this.state.registry.clear()
      this.state.contentContainer = null
      preparePage(this.state.registry)
      this.state.header = createClubHeader(this.state.registry, {
        team: this.state.team,
        refreshing: this.state.loading,
        onOpenTeams: () => replaceRoute(ROUTES.myTeams),
        onRefresh: () => this.manualRefresh(),
        onSettings: () => pushRoute(ROUTES.settings),
      })
      this.renderContent(false)
    },

    teamAccents() {
      const colors = teamBorderColors(this.state.team)
      const primary = hexToNumber(colors.primary, 0x5b5b60)
      const secondary = hexToNumber(colors.alternate, primary)
      return { primary, secondary }
    },

    renderContent(keepPosition) {
      const previousPosition =
        keepPosition && this.state.contentContainer
          ? Number(this.state.contentContainer.pos_y) || 0
          : 0

      if (this.state.contentContainer) {
        try {
          deleteWidget(this.state.contentContainer)
        } catch {
          // The runtime may already have released a replaced container.
        }
      }

      const scroll = CLUB_HOME_LAYOUT.scroll
      const container = this.state.registry.add(
        createWidget(widget.VIEW_CONTAINER, {
          x: scroll.x,
          y: scroll.y,
          w: scroll.width,
          h: scroll.height,
          pos_y: previousPosition,
          scroll_enable: 1,
          bounce: 0,
        }),
      )
      this.state.contentContainer = container

      const accents = this.teamAccents()
      const scheduledView = deriveScheduledClubHomeView(
        this.state.cache,
        Date.now(),
      )
      if (scheduledView) {
        renderMatchDisplay(
          container,
          scheduledView.primaryFixture,
          accents,
          { scheduled: true },
        )
        renderUpcomingRows(
          container,
          scheduledView.upcomingFixtures,
          this.state.team.id,
        )
        return
      }

      if (!this.state.cache) {
        if (this.state.lastError) {
          renderStateDisplay(container, accents, {
            icon: ASSETS.connectionOff,
            title: t('unable_to_load_matches'),
            body: t('check_connections'),
          })
        } else {
          renderStateDisplay(container, accents, {
            icon: ASSETS.teamPlaceholder,
            title: t('loading_matches'),
          })
        }
        renderSkeletonRows(container)
        return
      }

      const primary = this.state.cache.primaryFixture
      if (!primary) {
        renderStateDisplay(container, accents, {
          icon: ASSETS.calendarMatch,
          title: t('no_matches'),
          body: t('no_matches_body'),
        })
        renderUpcomingRows(container, [], this.state.team.id)
        return
      }

      renderMatchDisplay(container, primary, accents)
      const upcoming = this.state.cache.upcomingFixtures
        .filter((fixture) => fixture?.id !== primary.id)
        .slice(0, CLUB_HOME_UPCOMING_LIMIT)
      renderUpcomingRows(container, upcoming, this.state.team.id)
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
      this.ensureFixtureLogos()
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
      this.state.team = setSelectedTeam(team) || team
      this.state.cache = rollFixtureCacheForward(getFixtureCache(team.id))
      this.state.lastError = null
      this.state.loading = false
      setLastViewedTeamId(team.id)
      if (this.state.built) {
        this.rebuildPage()
      }
      this.refreshIfRequired()
      this.ensureFixtureLogos()
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
        now - this.state.lastManualRefreshAt <
          MANUAL_REFRESH_COOLDOWN_MS ||
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
          !shouldRefreshFixtureCache(this.state.cache, {
            nowMs: Date.now(),
          }))
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
            !Object.prototype.hasOwnProperty.call(
              result,
              'primaryFixture',
            )
          ) {
            return
          }
          setFixtureCache(
            teamId,
            result,
            result.fetchedAt || Date.now(),
          )
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
          console.log(
            `[ClubPulse] schedule refresh failed: ${error.code}`,
          )
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
        setSelectedTeam(this.state.team)
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
