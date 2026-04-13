import type { MediaInfo, NoticeInfo, MediaPosition } from '../shared/types'

// 将 window.electron 的类型注入全局 Window 接口
// 渲染层所有文件均可直接使用 window.electron.* 并获得类型提示

export interface ElectronAPI {
  setClickThrough: (enable: boolean) => void
  pin: () => void
  onWindowBlur: (cb: () => void) => () => void
  mediaControl: (action: 'prev' | 'next' | 'toggle') => void
  onMediaPosition: (cb: (pos: MediaPosition) => void) => () => void
  onMediaUpdate: (cb: (info: MediaInfo) => void) => () => void
  onNotification: (cb: (notice: NoticeInfo) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
