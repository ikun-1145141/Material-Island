import { contextBridge, ipcRenderer } from 'electron'
import type { MediaInfo, NoticeInfo, MediaPosition, AppSettings } from '../shared/types'
import { IPC } from '../shared/types'

// 严格最小接口原则：只暴露渲染层实际需要的方法
// 所有参数类型均明确，杜绝注入风险

contextBridge.exposeInMainWorld('electron', {
  /**
   * 切换窗口鼠标穿透状态
   * enable=true  → 鼠标事件穿透到桌面（岛外区域）
   * enable=false → 正常接收鼠标事件（鼠标在岛上时）
   */
  setClickThrough: (enable: boolean): void => {
    if (typeof enable !== 'boolean') return
    ipcRenderer.send(IPC.ISLAND_CLICKTHROUGH, enable)
  },

  /** 通知主进程岛展开/收起，主进程调整窗口大小和穿透状态 */
  setIslandExpanded: (expanded: boolean): void => {
    ipcRenderer.send(IPC.ISLAND_EXPANDED, expanded)
  },

  /**
   * 请求主进程将窗口设为可聚焦并激活焦点
   * 失焦点后主进程自动恢复 not-focusable并推送 ISLAND_BLUR
   */
  pin: (): void => {
    ipcRenderer.send(IPC.ISLAND_PIN)
  },

  /**
   * 订阅窗口失焦点事件（用户点击了其他窗口）
   * 返回取消订阅函数
   */
  onWindowBlur: (cb: () => void): (() => void) => {
    const handler = (): void => cb()
    ipcRenderer.on(IPC.ISLAND_BLUR, handler)
    return () => ipcRenderer.off(IPC.ISLAND_BLUR, handler)
  },

  /**
   * 向主进程发送播放控制指令
   */
  mediaControl: (action: 'prev' | 'next' | 'toggle'): void => {
    if (!['prev', 'next', 'toggle'].includes(action)) return
    ipcRenderer.send(IPC.MEDIA_CONTROL, action)
  },

  mediaSeek: (seconds: number): void => {
    if (typeof seconds === 'number' && isFinite(seconds) && seconds >= 0)
      ipcRenderer.send(IPC.MEDIA_SEEK, seconds)
  },

  /**
   * 订阅高频播放进度更新（独立于完整 MediaInfo）
   * 返回取消订阅函数
   */
  onMediaPosition: (cb: (pos: MediaPosition) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, pos: MediaPosition): void => cb(pos)
    ipcRenderer.on(IPC.MEDIA_POSITION, handler)
    return () => ipcRenderer.off(IPC.MEDIA_POSITION, handler)
  },

  /**
   * 订阅媒体信息更新（主进程 → 渲染层）
   * 返回取消订阅函数
   */
  onMediaUpdate: (cb: (info: MediaInfo) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, info: MediaInfo): void => cb(info)
    ipcRenderer.on(IPC.MEDIA_UPDATE, handler)
    return () => ipcRenderer.off(IPC.MEDIA_UPDATE, handler)
  },

  /**
   * 订阅系统通知（主进程 → 渲染层）
   * 返回取消订阅函数
   */
  onNotification: (cb: (notice: NoticeInfo) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, notice: NoticeInfo): void => cb(notice)
    ipcRenderer.on(IPC.NOTIFY_NEW, handler)
    return () => ipcRenderer.off(IPC.NOTIFY_NEW, handler)
  },

  /** 打开设置窗口 */
  openSettings: (): void => {
    ipcRenderer.send(IPC.SETTINGS_OPEN)
  },

  /** 读取当前设置（含可用显示器列表） */
  getSettings: (): Promise<{ settings: AppSettings; displays: { id: number; label: string }[] }> => {
    return ipcRenderer.invoke(IPC.SETTINGS_GET)
  },

  /** 提交新设置 */
  setSettings: (settings: AppSettings): void => {
    ipcRenderer.send(IPC.SETTINGS_SET, settings)
  },

  /** 订阅设置变更（主进程应用后推送给 island 渲染层） */
  onSettingsChanged: (cb: (s: AppSettings) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, s: AppSettings): void => cb(s)
    ipcRenderer.on(IPC.SETTINGS_CHANGED, handler)
    return () => ipcRenderer.off(IPC.SETTINGS_CHANGED, handler)
  },
})
