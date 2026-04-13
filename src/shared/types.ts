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

// ── IPC 频道名称常量（避免魔法字符串）────────────────────
export const IPC = {
  ISLAND_RESIZE:        'island:resize',
  ISLAND_CLICKTHROUGH:  'island:set-clickthrough',
  ISLAND_PIN:           'island:pin',
  ISLAND_BLUR:          'island:blur',
  MEDIA_UPDATE:         'media:update',
  MEDIA_POSITION:       'media:position',
  MEDIA_CONTROL:        'media:control',
  NOTIFY_NEW:           'notify:new',
} as const
