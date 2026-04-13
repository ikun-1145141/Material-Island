import { app, ipcMain, BrowserWindow } from 'electron'
import { createIslandWindow } from './window'
import { mediaProvider } from './providers/media'
import { notifyProvider } from './providers/notify'
import { IPC } from '../shared/types'

let win: BrowserWindow

// ── 应用生命周期 ───────────────────────────────────────────

app.whenReady().then(() => {
  win = createIslandWindow()
  registerIpcHandlers()
  startProviders()

  // Windows：单实例锁
  app.on('second-instance', () => {
    if (win) {
      win.show()
      win.focus()
    }
  })
})

app.on('window-all-closed', () => {
  stopProviders()
  app.quit()
})

// ── IPC 注册 ───────────────────────────────────────────────

function registerIpcHandlers(): void {
  // 渲染层请求切换鼠标穿透状态
  ipcMain.on(IPC.ISLAND_CLICKTHROUGH, (_, enable: boolean) => {
    win?.setIgnoreMouseEvents(enable, { forward: true })
  })

  // 渲染层申请 pin：临时使窗口可聚焦并获取焦点
  // 当其他窗口获得焦点时 blur 事件会触发，送出 ISLAND_BLUR 通知渲染层自动解除 pin
  ipcMain.on(IPC.ISLAND_PIN, () => {
    if (!win) return
    win.setFocusable(true)
    win.focus()
  })

  win.on('blur', () => {
    if (!win) return
    // 恢复不可聚焦，否则窗口会抢占任务栏焦点
    win.setFocusable(false)
    win.webContents.send(IPC.ISLAND_BLUR)
  })
}

// ── 系统数据 Provider 启动 ─────────────────────────────────

function startProviders(): void {
  // 媒体信息：轮询 Windows SMTC，有变化时推送到渲染层
  mediaProvider.on('update', (info) => {
    win?.webContents.send(IPC.MEDIA_UPDATE, info)
  })
  mediaProvider.start()

  // 系统通知：轮询通知数据库，有新条目时推送
  notifyProvider.on('new', (notice) => {
    win?.webContents.send(IPC.NOTIFY_NEW, notice)
  })
  notifyProvider.start(3000)
}

function stopProviders(): void {
  mediaProvider.stop()
  notifyProvider.stop()
}
