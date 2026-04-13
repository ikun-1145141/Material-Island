import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { request } from 'http'

// 岛的最大尺寸，窗口固定为此大小，视觉内容在内部动画
const ISLAND_MAX_WIDTH = 440
const ISLAND_MAX_HEIGHT = 180
const ISLAND_TOP_OFFSET = 0 // 贴近屏幕顶部

export function createIslandWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: ISLAND_MAX_WIDTH,
    height: ISLAND_MAX_HEIGHT,
    x: Math.round(screenWidth / 2 - ISLAND_MAX_WIDTH / 2),
    y: ISLAND_TOP_OFFSET,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    // focusable: false 确保岛不抢占其他窗口焦点
    focusable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // screen-saver 级别确保在全屏应用上方仍可见
  win.setAlwaysOnTop(true, 'screen-saver')

  // 默认穿透鼠标 — forward:true 保证 mousemove 事件仍能到达渲染层
  // 渲染层检测到鼠标进入岛区域后，通过 IPC 关闭穿透
  win.setIgnoreMouseEvents(true, { forward: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    loadDevUrl(win, process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
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
