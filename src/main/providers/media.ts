import { EventEmitter } from 'events'
import { spawn, type ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { join } from 'path'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import type { MediaInfo, MediaPosition } from '../../shared/types'

// 开发时从 dotnet build 输出目录读取，生产时从 resources/ 读取
function resolveExePath(): string {
  if (is.dev) {
    const releasePath = join(
      __dirname,
      '../../sidecar/SmtcServer/bin/Release/net8.0-windows10.0.19041.0/SmtcServer.exe',
    )
    if (existsSync(releasePath)) return releasePath

    const debugPath = join(
      __dirname,
      '../../sidecar/SmtcServer/bin/Debug/net8.0-windows10.0.19041.0/SmtcServer.exe',
    )
    if (existsSync(debugPath)) return debugPath
  }
  // 生产：electron-builder 将 exe 复制到 resources/
  return join(process.resourcesPath, 'SmtcServer.exe')
}

class MediaProvider extends EventEmitter {
  private _proc: ChildProcess | null = null
  private _restartTimer: ReturnType<typeof setTimeout> | null = null
  private _stopped = false

  start(): void {
    this._stopped = false
    this._spawn()
  }

  stop(): void {
    this._stopped = true
    if (this._restartTimer) {
      clearTimeout(this._restartTimer)
      this._restartTimer = null
    }
    this._proc?.kill()
    this._proc = null
  }

  private _spawn(): void {
    const exePath = resolveExePath()

    if (!existsSync(exePath)) {
      console.warn('[MediaProvider] SmtcServer.exe not found:', exePath)
      console.warn('[MediaProvider] Run: dotnet build sidecar/SmtcServer -c Release')
      return
    }

    try {
      this._proc = spawn(exePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (err) {
      console.error('[MediaProvider] Failed to spawn SmtcServer:', err)
      this._scheduleRestart()
      return
    }

    // 逐行读取 stdout，每行是一个 JSON 对象
    const rl = createInterface({ input: this._proc.stdout! })
    rl.on('line', (line) => {
      const trimmed = line.trim()
      if (!trimmed) return

      let parsed: Record<string, string>
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        return
      }

      if (parsed.status === 'no_session') {
        this.emit('update', {
          title: '', artist: '', album: '',
          playbackStatus: 'unknown',
        } satisfies MediaInfo)
        return
      }

      if (parsed.status === 'position') {
        // 高频进度更新，单独发出 position 事件
        this.emit('position', {
          position: Number(parsed.position) || 0,
          duration: Number(parsed.duration) || 0,
        } satisfies MediaPosition)
        return
      }

      if (parsed.status !== 'ok') return

      this.emit('update', {
        title:            parsed.title      ?? '',
        artist:           parsed.artist     ?? '',
        album:            parsed.album      ?? '',
        playbackStatus:   this._mapStatus(parsed.playback),
        thumbnailDataUrl: parsed.thumb
          ? this._toDataUrl(parsed.thumb)
          : undefined,
        position:    Number(parsed.position)   || 0,
        duration:    Number(parsed.duration)   || 0,
        source:      parsed.source             ?? '',
        deviceName:  parsed.deviceName         ?? '',
        deviceType:  this._mapDevice(parsed.deviceType),
      } satisfies MediaInfo)
    })

    this._proc.on('error', (err) => {
      console.error('[MediaProvider] Process error:', err)
      this._scheduleRestart()
    })

    this._proc.on('exit', (code) => {
      if (!this._stopped) {
        console.warn('[MediaProvider] SmtcServer exited with code', code, '— restarting...')
        this._scheduleRestart()
      }
    })
  }

  private _scheduleRestart(): void {
    if (this._stopped) return
    this._restartTimer = setTimeout(() => {
      this._restartTimer = null
      this._spawn()
    }, 3000)
  }

  /** 根据 base64 头部字节自动判断 MIME 类型 */
  private _toDataUrl(b64: string): string {
    // JPEG: /9j/  PNG: iVBO  GIF: R0lG  WebP: UklG
    let mime = 'image/jpeg'
    if (b64.startsWith('iVBO')) mime = 'image/png'
    else if (b64.startsWith('R0lG')) mime = 'image/gif'
    else if (b64.startsWith('UklG')) mime = 'image/webp'
    return `data:${mime};base64,${b64}`
  }

  /** 向 C# sidecar 发送控制命令（每行一条） */
  sendControl(action: 'prev' | 'next' | 'toggle'): void {
    if (this._proc?.stdin?.writable) {
      this._proc.stdin.write(action + '\n')
    }
  }

  private _mapDevice(s: string): MediaInfo['deviceType'] {
    if (s === 'headphone') return 'headphone'
    if (s === 'speaker')   return 'speaker'
    return 'unknown'
  }

  private _mapStatus(s: string): MediaInfo['playbackStatus'] {
    switch (s) {
      case 'playing': return 'playing'
      case 'paused':  return 'paused'
      case 'stopped': return 'stopped'
      default:        return 'unknown'
    }
  }
}

export const mediaProvider = new MediaProvider()
