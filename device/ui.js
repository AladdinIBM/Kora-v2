import { createModal, MODAL_CONFIRM } from '@zos/interaction'
import {
  align,
  createWidget,
  deleteWidget,
  event,
  prop,
  setStatusBarVisible,
  text_style,
  widget,
} from '@zos/ui'
import { CLUB_HOME_LAYOUT } from '../shared/club-home-view.js'
import { ASSETS, COLORS } from '../shared/constants.js'
import { isRtl } from './locale.js'

export const SCREEN_WIDTH = 390
export const SCREEN_HEIGHT = 450
export const SIDE_PADDING = 24

export class WidgetRegistry {
  constructor() {
    this.widgets = []
  }

  add(instance) {
    if (instance) {
      this.widgets.push(instance)
    }
    return instance
  }

  clear() {
    for (const instance of this.widgets) {
      try {
        deleteWidget(instance)
      } catch {
        // The runtime can dispose widgets before page teardown.
      }
    }
    this.widgets = []
  }
}

export function preparePage(registry) {
  setStatusBarVisible(false)
  return createRect(registry, {
    x: 0,
    y: 0,
    w: SCREEN_WIDTH,
    h: SCREEN_HEIGHT,
    color: COLORS.background,
    radius: 0,
  })
}

export function createRect(
  registry,
  { x, y, w, h, color, radius = 0, onClick = null },
) {
  const instance = registry.add(
    createWidget(widget.FILL_RECT, {
      x,
      y,
      w,
      h,
      color,
      radius,
      angle: 0,
    }),
  )
  if (onClick) {
    instance.addEventListener(event.CLICK_DOWN, onClick)
  }
  return instance
}

export function createStrokeRect(
  registry,
  { x, y, w, h, color, radius = 0, lineWidth = 1 },
) {
  return registry.add(
    createWidget(widget.STROKE_RECT, {
      id: `stroke-${x}-${y}-${w}-${h}`,
      x,
      y,
      w,
      h,
      color,
      radius,
      line_width: lineWidth,
      angle: 0,
    }),
  )
}

export function createText(
  registry,
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
    onClick = null,
  },
) {
  const instance = registry.add(
    createWidget(widget.TEXT, {
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
    }),
  )
  if (onClick) {
    instance.addEventListener(event.CLICK_DOWN, onClick)
  }
  return instance
}

export function createImage(
  registry,
  { x, y, w, h, src, alpha = 255, onClick = null },
) {
  const instance = registry.add(
    createWidget(widget.IMG, {
      x,
      y,
      w,
      h,
      src: src || ASSETS.fallbackCrest,
      alpha,
      auto_scale: true,
      auto_scale_obj_fit: false,
    }),
  )
  if (onClick) {
    instance.addEventListener(event.CLICK_DOWN, onClick)
  }
  return instance
}

export function createImageButton(
  registry,
  { x, y, w, h, src, alpha = 255, onClick, hitSize = 56 },
) {
  const targetSize = Math.max(hitSize, w, h)
  registry.add(
    createWidget(widget.BUTTON, {
      x: x - Math.floor((targetSize - w) / 2),
      y: y - Math.floor((targetSize - h) / 2),
      w: targetSize,
      h: targetSize,
      text: '',
      normal_color: COLORS.background,
      press_color: COLORS.surfaceSecondary,
      radius: Math.floor(targetSize / 2),
      click_func: onClick,
    }),
  )
  const image = createImage(registry, { x, y, w, h, src, alpha })
  image.setEnable(false)
  return image
}

export function createButton(
  registry,
  {
    x,
    y,
    w,
    h = 52,
    text,
    color = COLORS.textPrimary,
    background = COLORS.surfacePrimary,
    pressed = COLORS.surfaceSecondary,
    radius = 16,
    onClick,
  },
) {
  return registry.add(
    createWidget(widget.BUTTON, {
      x,
      y,
      w,
      h,
      text,
      text_size: 18,
      color,
      normal_color: background,
      press_color: pressed,
      radius,
      click_func: onClick,
    }),
  )
}

export function createBackHeader(registry, title, onBack) {
  const rtl = isRtl()
  const backX = rtl ? SCREEN_WIDTH - SIDE_PADDING - 44 : SIDE_PADDING
  createImageButton(registry, {
    x: backX,
    y: 18,
    w: 40,
    h: 40,
    src: rtl ? 'back-right.png' : 'back-left.png',
    onClick: onBack,
  })
  createText(registry, {
    x: rtl ? SIDE_PADDING : 76,
    y: 12,
    w: SCREEN_WIDTH - 2 * SIDE_PADDING - 52,
    h: 52,
    text: title,
    size: 27,
    alignH: rtl ? align.RIGHT : align.LEFT,
  })
}

export function createClubHeader(
  registry,
  {
    team,
    refreshing,
    onOpenTeams,
    onRefresh,
    onSettings,
  },
) {
  const rtl = isRtl()
  const header = CLUB_HOME_LAYOUT.header
  const mirrorX = (x, width) => SCREEN_WIDTH - x - width
  const positionedX = (x, width) => (rtl ? mirrorX(x, width) : x)
  const refreshTargetX =
    header.x + header.clubWidth + header.gap
  const settingsTargetX =
    refreshTargetX + header.actionSize + header.gap
  const actionIconInset = Math.floor(
    (header.actionSize - header.actionIconSize) / 2,
  )
  const clubTarget = registry.add(
    createWidget(widget.BUTTON, {
      x: positionedX(header.x, header.clubWidth),
      y: header.y,
      w: header.clubWidth,
      h: 40,
      text: '',
      normal_color: COLORS.background,
      press_color: 0x171717,
      radius: 20,
      click_func: onOpenTeams,
    }),
  )
  const logo = createImage(registry, {
    x: positionedX(header.x + 4, header.clubLogoSize),
    y: 9,
    w: header.clubLogoSize,
    h: header.clubLogoSize,
    src: team.localLogoPath || ASSETS.fallbackCrest,
  })
  const name = createText(registry, {
    x: positionedX(header.x + 42, 116),
    y: 4,
    w: 116,
    h: 40,
    text: team.displayName || team.name,
    size: 18,
    alignH: rtl ? align.RIGHT : align.LEFT,
  })
  const chevron = createImage(registry, {
    x: positionedX(header.x + 166, 12),
    y: 18,
    w: 12,
    h: 12,
    src: ASSETS.chevronDown,
  })
  logo.setEnable(false)
  name.setEnable(false)
  chevron.setEnable(false)

  const refresh = createImageButton(registry, {
    x: positionedX(
      refreshTargetX + actionIconInset,
      header.actionIconSize,
    ),
    y: 12,
    w: header.actionIconSize,
    h: header.actionIconSize,
    src: 'refresh.png',
    alpha: refreshing ? 100 : 255,
    onClick: onRefresh,
    hitSize: header.actionSize,
  })
  const settings = createImageButton(registry, {
    x: positionedX(
      settingsTargetX + actionIconInset,
      header.actionIconSize,
    ),
    y: 12,
    w: header.actionIconSize,
    h: header.actionIconSize,
    src: 'settings.png',
    onClick: onSettings,
    hitSize: header.actionSize,
  })
  return { clubTarget, refresh, settings }
}

export function setImageAlpha(image, alpha) {
  if (image) {
    image.setProperty(prop.ALPHA, alpha)
  }
}

export function showConfirmation({ title, text, onConfirm }) {
  return createModal({
    content: title,
    title,
    text,
    autoHide: true,
    onClick: ({ type }) => {
      if (type === MODAL_CONFIRM) {
        onConfirm()
      }
    },
  })
}

export function teamLogoPath(team) {
  return (team && team.localLogoPath) || ASSETS.fallbackCrest
}

export const uiTokens = Object.freeze({
  align,
  prop,
  text_style,
  widget,
  createWidget,
})
