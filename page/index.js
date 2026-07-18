import {
  getLaunchRouteState,
  initializeStorage,
} from '../device/storage.js'
import { replaceRoute, ROUTES } from '../device/navigation.js'
import { preparePage, WidgetRegistry } from '../device/ui.js'

Page({
    state: {
      registry: null,
      route: null,
    },

    onInit() {
      this.state.registry = new WidgetRegistry()
      initializeStorage()
      this.state.route = getLaunchRouteState()
    },

    build() {
      preparePage(this.state.registry)
      setTimeout(() => {
        if (this.state.route.onboardingRequired) {
          replaceRoute(ROUTES.leagues)
        } else {
          replaceRoute(ROUTES.club, {
            teamId: this.state.route.teamId,
          })
        }
      }, 0)
    },

    onDestroy() {
      this.state.registry?.clear()
    },
})
