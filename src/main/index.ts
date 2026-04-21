import { app, ipcMain, BrowserWindow, screen } from 'electron'
import { createIslandWindow, createSettingsWindow, applySettingsToIsland, setIslandExpanded, ISLAND_MAX_WIDTH, ISLAND_MAX_HEIGHT } from './window'
import { createTray } from './tray'
import { loadSettings, saveSettings } from './settings-store'
import { mediaProvider } from './providers/media'
import { notifyProvider } from './providers/notify'
import { httpNotifyProvider } from './providers/http-server'
import { lyricsProvider } from './providers/lyrics'
import { IPC } from '../shared/types'
import type { AppSettings } from '../shared/types'

let win: BrowserWindow
let settingsWin: BrowserWindow | null = null
let currentSettings: AppSettings

// ── 应用生命周期 ───────────────────────────────────────────

app.whenReady().then(() => {
  currentSettings = loadSettings()
  win = createIslandWindow()
  applySettingsToIsland(win, currentSettings)

  createTray(openSettings)
  registerIpcHandlers()
  startProviders()

  // Windows：单实例锁
  app.on('second-instance', () => {
    openSettings()
  })
})

app.on('window-all-closed', () => {
  stopProviders()
  app.quit()
})

// ── 设置窗口 ───────────────────────────────────────────────

function openSettings(): void {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus()
    return
  }
  settingsWin = createSettingsWindow()
  settingsWin.on('closed', () => { settingsWin = null })
}

// ── IPC 注册 ───────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.on(IPC.MEDIA_CONTROL, (_, action: string) => {
    if (['prev', 'next', 'toggle'].includes(action)) {
      mediaProvider.sendControl(action as 'prev' | 'next' | 'toggle')
    }
  })

  ipcMain.on(IPC.MEDIA_SEEK, (_, seconds: number) => {
    const s = Number(seconds)
    if (isFinite(s) && s >= 0) mediaProvider.sendSeek(s)
  })

  ipcMain.on(IPC.ISLAND_CLICKTHROUGH, (_, enable: boolean) => {
    win?.setIgnoreMouseEvents(enable, { forward: true })
  })

  // 岛展开/收起时调整窗口大小
  ipcMain.on(IPC.ISLAND_EXPANDED, (_, expanded: boolean) => {
    if (!win) return
    setIslandExpanded(win, expanded, currentSettings)
    // 展开时禁止穿透，收起时恢复穿透
    win.setIgnoreMouseEvents(!expanded, { forward: true })
  })

  // 记录最近一次 pin 的时间戳，blur 防抗用：
  // Windows 透明窗口 focus 后就立即 blur 是已知 quirk
  let _lastPinTime = 0

  ipcMain.on(IPC.ISLAND_PIN, () => {
    if (!win) return
    _lastPinTime = Date.now()
    win.setFocusable(true)
    win.focus()
  })

  win.on('blur', () => {
    if (!win) return
    win.setFocusable(false)
    // 如果 pin 后 500ms 内就收到 blur，认为是 Window quirk，忽略
    if (Date.now() - _lastPinTime < 500) return
    win.webContents.send(IPC.ISLAND_BLUR)
  })

  // 设置页打开指令（渲染层发出）
  ipcMain.on(IPC.SETTINGS_OPEN, () => openSettings())

  // 渲染层读取当前设置
  ipcMain.handle(IPC.SETTINGS_GET, () => {
    // 附带可用显示器列表
    const displays = screen.getAllDisplays().map((d) => ({
      id: d.id,
      label: `${d.size.width}×${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ' (主屏)' : ''}`,
    }))
    return { settings: currentSettings, displays }
  })

  // 渲染层提交新设置
  ipcMain.on(IPC.SETTINGS_SET, (_, next: AppSettings) => {
    // 基本校验
    const validated: AppSettings = {
      scale:           Math.min(2.0, Math.max(0.5, Number(next.scale)     || 1.0)),
      topOffset:       Math.min(200, Math.max(0,   Math.round(Number(next.topOffset) || 0))),
      displayId:       Number(next.displayId) || -1,
      silentMode:      Boolean(next.silentMode),
      silentModeDelay: Math.min(3600, Math.max(0, Math.round(Number(next.silentModeDelay) || 0))),
      httpEnabled:     Boolean(next.httpEnabled),
      httpPort:        Math.min(65535, Math.max(1024, Math.round(Number(next.httpPort) || 19198))),
      httpToken:       String(next.httpToken ?? '').slice(0, 256),
      lyricsEnabled:   Boolean(next.lyricsEnabled),
      lyricsSource:    ['lrclib', '163'].includes(String(next.lyricsSource)) ? String(next.lyricsSource) : 'lrclib',
      lyricsFallback:  Boolean(next.lyricsFallback),
      lyricsDelay:     Math.min(5000, Math.max(-5000, Math.round(Number(next.lyricsDelay) || 0))),
    }
    currentSettings = validated
    saveSettings(validated)
    applySettingsToIsland(win, validated)
    // 动态重启 HTTP 服务（端口或 Token 变更立即生效）
    if (validated.httpEnabled) {
      httpNotifyProvider.start(validated.httpPort, validated.httpToken)
    } else {
      httpNotifyProvider.stop()
    }
    // 歌词配置热更新
    lyricsProvider.setEnabled(validated.lyricsEnabled)
    lyricsProvider.setSource(validated.lyricsSource)
    lyricsProvider.setFallback(validated.lyricsFallback)
    // 通知 island 渲染层更新 CSS 缩放
    win.webContents.send(IPC.SETTINGS_CHANGED, validated)
  })
}

// ── 系统数据 Provider 启动 ─────────────────────────────────

function startProviders(): void {
  // 媒体信息：轮询 Windows SMTC，有变化时推送到渲染层
  mediaProvider.on('update', (info) => {
    win?.webContents.send(IPC.MEDIA_UPDATE, info)
    lyricsProvider.handleMediaUpdate(info)
  })
  mediaProvider.on('position', (pos) => {
    win?.webContents.send(IPC.MEDIA_POSITION, pos)
  })
  mediaProvider.start()

  // 歌词行推送
  lyricsProvider.on('data', (lines, durationSec: number) => {
    win?.webContents.send(IPC.LYRICS_DATA, lines, durationSec ?? 0)
  })
  lyricsProvider.setEnabled(currentSettings.lyricsEnabled)
  lyricsProvider.setSource(currentSettings.lyricsSource)
  lyricsProvider.setFallback(currentSettings.lyricsFallback)

  // 系统通知：轮询通知数据库，有新条目时推送
  notifyProvider.on('new', (notice) => {
    win?.webContents.send(IPC.NOTIFY_NEW, notice)
  })
  notifyProvider.start(3000)

  // HTTP 消息接收服务：启动时按设置决定是否开启
  httpNotifyProvider.on('new', (notice) => {
    win?.webContents.send(IPC.NOTIFY_NEW, notice)
  })
  if (currentSettings.httpEnabled) {
    httpNotifyProvider.start(currentSettings.httpPort, currentSettings.httpToken)
  }
}

function stopProviders(): void {
  mediaProvider.stop()
  notifyProvider.stop()
  httpNotifyProvider.stop()
  lyricsProvider.removeAllListeners()
}
