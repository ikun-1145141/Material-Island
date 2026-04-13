import type { MediaInfo, NoticeInfo, MediaPosition, AppSettings } from '../shared/types'

export interface ElectronAPI {
  setClickThrough: (enable: boolean) => void
  setIslandExpanded: (expanded: boolean) => void
  pin: () => void
  onWindowBlur: (cb: () => void) => () => void
  mediaControl: (action: 'prev' | 'next' | 'toggle') => void
  mediaSeek: (seconds: number) => void
  onMediaPosition: (cb: (pos: MediaPosition) => void) => () => void
  onMediaUpdate: (cb: (info: MediaInfo) => void) => () => void
  onNotification: (cb: (notice: NoticeInfo) => void) => () => void
  openSettings: () => void
  getSettings: () => Promise<{ settings: AppSettings; displays: { id: number; label: string }[] }>
  setSettings: (settings: AppSettings) => void
  onSettingsChanged: (cb: (s: AppSettings) => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
