// src/shared/types.ts
// 所有模块共享的类型契约 — 这是跨层通信的唯一数据规范

// ── 媒体信息 ──────────────────────────────────────────────
export interface MediaInfo {
  title: string
  artist: string
  album: string
  playbackStatus: 'playing' | 'paused' | 'stopped' | 'unknown'
  thumbnailDataUrl?: string  // base64 封面图
  position?: number          // 当前播放位置（秒）
  duration?: number          // 总时长（秒）
  source?: string            // 播放来源应用名称
  deviceName?: string        // 音频输出设备名称
  deviceType?: 'speaker' | 'headphone' | 'unknown'
}

// ── 进度更新（高频，独立于完整 MediaInfo）──────────────────
export interface MediaPosition {
  position: number
  duration: number
}

// ── 系统通知 ──────────────────────────────────────────────
export interface NoticeInfo {
  id: string
  appName: string
  title: string
  body: string
  timestamp: number
  iconUrl?: string
}

// ── 窗口调整指令 ──────────────────────────────────────────
export interface ResizePayload {
  width: number
  height: number
}

// ── 应用设置 ──────────────────────────────────────────────
export interface AppSettings {
  scale: number          // 岛的缩放倍数，0.5~2.0，默认 1.0
  topOffset: number      // 距屏幕顶部偏移像素，默认 0
  displayId: number      // 显示器 ID，-1 表示主屏
}

export const DEFAULT_SETTINGS: AppSettings = {
  scale: 1.0,
  topOffset: 0,
  displayId: -1,
}

// ── IPC 频道名称常量（避免魔法字符串）────────────────────
export const IPC = {
  ISLAND_RESIZE:        'island:resize',
  ISLAND_CLICKTHROUGH:  'island:set-clickthrough',
  ISLAND_PIN:           'island:pin',
  ISLAND_BLUR:          'island:blur',
  MEDIA_UPDATE:         'media:update',
  MEDIA_POSITION:       'media:position',
  MEDIA_CONTROL:        'media:control',
  MEDIA_SEEK:           'media:seek',
  NOTIFY_NEW:           'notify:new',
  ISLAND_EXPANDED:      'island:expanded',
  SETTINGS_OPEN:        'settings:open',
  SETTINGS_GET:         'settings:get',
  SETTINGS_SET:         'settings:set',
  SETTINGS_CHANGED:     'settings:changed',
} as const
