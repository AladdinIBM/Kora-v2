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
  createImage(registry, {
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
    accent,
    secondaryAccent = accent,
    refreshing,
    onOpenTeams,
    onRefresh,
    onSettings,
  },
) {
  const rtl = isRtl()
  createImage(registry, {
    x: rtl ? 318 : 24,
    y: 13,
    w: 48,
    h: 48,
    src: team.localLogoPath || ASSETS.fallbackCrest,
    onClick: onOpenTeams,
  })
  createText(registry, {
    x: rtl ? 132 : 82,
    y: 9,
    w: 174,
    h: 58,
    text: team.name,
    size: 24,
    alignH: rtl ? align.RIGHT : align.LEFT,
    onClick: onOpenTeams,
  })
  const refresh = createImage(registry, {
    x: rtl ? 76 : 266,
    y: 17,
    w: 42,
    h: 42,
    src: 'refresh.png',
    alpha: refreshing ? 100 : 255,
    onClick: onRefresh,
  })
  const settings = createImage(registry, {
    x: rtl ? 22 : 326,
    y: 17,
    w: 42,
    h: 42,
    src: 'settings.png',
    onClick: onSettings,
  })
  createRect(registry, {
    x: SIDE_PADDING,
    y: 76,
    w: (SCREEN_WIDTH - SIDE_PADDING * 2) / 2,
    h: 4,
    color: accent,
    radius: 2,
  })
  createRect(registry, {
    x: SIDE_PADDING + (SCREEN_WIDTH - SIDE_PADDING * 2) / 2,
    y: 76,
    w: (SCREEN_WIDTH - SIDE_PADDING * 2) / 2,
    h: 4,
    color: secondaryAccent,
    radius: 2,
  })
  return { refresh, settings }
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
