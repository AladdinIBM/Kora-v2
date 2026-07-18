import { BaseApp } from '@zeppos/zml/base-app'

const globalData = {
  messaging: null,
  fileTransferLib: null,
}

App(
  BaseApp({
    globalData,

    onCreate() {
      console.log('[ClubPulse] app created with ZML messaging')
    },

    onDestroy() {
      console.log('[ClubPulse] app destroyed')
    },
  }),
)
