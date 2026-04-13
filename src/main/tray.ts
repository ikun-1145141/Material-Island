import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

let tray: Tray | null = null

export function createTray(onOpenSettings: () => void): Tray {
  // resources/tray-icon.png 开发时在项目根，打包后在 resources/
  const iconPath = is.dev
    ? join(process.cwd(), 'resources/music_cast.png')
    : join(process.resourcesPath, 'music_cast.png')

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('Material Island')

  const menu = Menu.buildFromTemplate([
    {
      label: '设置',
      click: onOpenSettings,
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => app.quit(),
    },
  ])

  tray.setContextMenu(menu)

  // 双击也打开设置
  tray.on('double-click', onOpenSettings)

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
