import { contextBridge, ipcRenderer } from 'electron'
import type { MediaInfo, NoticeInfo, MediaPosition } from '../shared/types'
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
})
