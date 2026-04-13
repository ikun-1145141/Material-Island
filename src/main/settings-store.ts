import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import type { AppSettings } from '../shared/types'
import { DEFAULT_SETTINGS } from '../shared/types'

const settingsPath = join(app.getPath('userData'), 'settings.json')

export function loadSettings(): AppSettings {
  try {
    if (!existsSync(settingsPath)) return { ...DEFAULT_SETTINGS }
    const raw = readFileSync(settingsPath, 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (e) {
    console.error('[Settings] Failed to save:', e)
  }
}
