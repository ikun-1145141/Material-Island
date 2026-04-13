import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { request } from 'http'
import type { AppSettings } from '../shared/types'

// 岛的最大尺寸
export const ISLAND_MAX_WIDTH  = 440
export const ISLAND_MAX_HEIGHT = 180

/**
 * 展开时将窗口扩展到全屏（捕获岛外点击），收起时恢复小窗口
 */
export function setIslandExpanded(win: BrowserWindow, expanded: boolean, settings: { topOffset: number; displayId: number; scale: number }): void {
  const displays = screen.getAllDisplays()
  const display = displays.find((d) => d.id === settings.displayId) ?? screen.getPrimaryDisplay()
  const { x: dx, y: dy, width: dw, height: dh } = display.bounds

  if (expanded) {
    // 全屏覆盖，使背景区域点击可被捕获
    win.setBounds({ x: dx, y: dy, width: dw, height: dh })
  } else {
    // 恢复小窗口
    const scaledW = Math.round(ISLAND_MAX_WIDTH  * settings.scale)
    const scaledH = Math.round(ISLAND_MAX_HEIGHT * settings.scale)
    win.setBounds({
      x: dx + Math.round(dw / 2 - scaledW / 2),
      y: dy + settings.topOffset,
      width:  scaledW,
      height: scaledH,
    })
  }
}

export function createIslandWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const { width: sw } = display.bounds

  const win = new BrowserWindow({
    width: ISLAND_MAX_WIDTH,
    height: ISLAND_MAX_HEIGHT,
    x: Math.round(sw / 2 - ISLAND_MAX_WIDTH / 2),
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    loadDevUrl(win, process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

export function applySettingsToIsland(win: BrowserWindow, settings: AppSettings): void {
  // 设置变更时始终按收起状态设置窗口大小
  setIslandExpanded(win, false, settings)
}

export function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 520,
    height: 500,
    minWidth: 420,
    minHeight: 420,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    show: false,
    backgroundColor: '#1c1b1f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#settings')
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'settings' })
  }

  return win
}

/**
 * 用 HTTP HEAD 请求探测 Vite dev server 是否就绪
 * 比 loadURL 重试更可靠，且不会产生多余的导航记录
 */
function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    const parsed = new URL(url)

    function probe(): void {
      const req = request(
        { hostname: parsed.hostname, port: parsed.port, path: '/', method: 'HEAD', timeout: 500 },
        () => resolve(),
      )
      req.on('error', () => {
        if (Date.now() >= deadline) {
          reject(new Error(`Dev server not ready after ${timeoutMs}ms`))
          return
        }
        setTimeout(probe, 300)
      })
      req.end()
    }

    probe()
  })
}

async function loadDevUrl(win: BrowserWindow, url: string): Promise<void> {
  await waitForServer(url)
  await win.loadURL(url)
}
