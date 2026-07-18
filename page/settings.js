import { align, createWidget, text_style, widget } from '@zos/ui'
import { COLORS } from '../shared/constants.js'
import { formatLastUpdated, isRtl, t } from '../device/locale.js'
import {
  goBack,
  pushRoute,
  replaceRoute,
  ROUTES,
} from '../device/navigation.js'
import {
  getFollowedTeams,
  getLastSyncAt,
  resetClubPulseStorage,
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

function rowConfig(typeId, rtl, destructive = false) {
  return {
    type_id: typeId,
    item_height: 68,
    item_bg_color: COLORS.surfacePrimary,
    item_bg_radius: 16,
    image_view: [
      {
        x: rtl ? 14 : 296,
        y: 18,
        w: 32,
        h: 32,
        key: 'indicator',
        action: true,
      },
    ],
    image_view_count: 1,
    text_view: [
      {
        x: rtl ? 112 : 16,
        y: 0,
        w: 214,
        h: 68,
        key: 'label',
        color: destructive ? COLORS.destructive : COLORS.textPrimary,
        text_size: 18,
        align_h: rtl ? align.RIGHT : align.LEFT,
        text_style: text_style.ELLIPSIS,
        action: true,
      },
      {
        x: rtl ? 50 : 210,
        y: 0,
        w: 116,
        h: 68,
        key: 'value',
        color: COLORS.textMuted,
        text_size: 14,
        align_h: rtl ? align.LEFT : align.RIGHT,
        text_style: text_style.ELLIPSIS,
      },
    ],
    text_view_count: 2,
  }
}

Page({
    state: {
      registry: null,
      rows: [],
    },

    onInit() {
      this.state.registry = new WidgetRegistry()
    },

    build() {
      const registry = this.state.registry
      const rtl = isRtl()
      preparePage(registry)
      createBackHeader(registry, t('settings'), goBack)
      this.state.rows = [
        {
          type_id: 1,
          action: 'add',
          label: t('add_team'),
          value: '',
          indicator: rtl ? 'chevron-left.png' : 'chevron-right.png',
        },
        {
          type_id: 1,
          action: 'manage',
          label: t('manage_teams'),
          value: '',
          indicator: rtl ? 'chevron-left.png' : 'chevron-right.png',
        },
        {
          type_id: 1,
          action: null,
          label: t('language'),
          value: t('system'),
          indicator: 'blank.png',
        },
        {
          type_id: 1,
          action: null,
          label: t('last_sync'),
          value: formatLastUpdated(getLastSyncAt()),
          indicator: 'blank.png',
        },
        {
          type_id: 1,
          action: null,
          label: t('data_source'),
          value: t('espn'),
          indicator: 'blank.png',
        },
        {
          type_id: 2,
          action: 'reset',
          label: t('reset_app'),
          value: '',
          indicator: 'blank.png',
        },
      ]
      const types = this.state.rows.map((row, index) => ({
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
            rowConfig(1, rtl, false),
            rowConfig(2, rtl, true),
          ],
          item_config_count: 2,
          data_array: this.state.rows,
          data_count: this.state.rows.length,
          data_type_config: types,
          data_type_config_count: types.length,
          auto_rtl: false,
          enable_scroll_bar: true,
          item_click_func: (_list, index) => this.handleRow(index),
        }),
      )
    },

    handleRow(index) {
      const action = this.state.rows[index]?.action
      if (action === 'add') {
        pushRoute(ROUTES.leagues, { mode: 'add' })
      } else if (action === 'manage') {
        pushRoute(ROUTES.manageTeams)
      } else if (action === 'reset') {
        showConfirmation({
          title: t('reset_confirm_title'),
          text: t('reset_confirm_text'),
          onConfirm: () => {
            resetClubPulseStorage()
            replaceRoute(ROUTES.leagues)
          },
        })
      }
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
