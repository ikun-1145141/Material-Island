import { EventEmitter } from 'events'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import type { NoticeInfo } from '../../shared/types'

// 通过监听 Windows 通知数据库变更来捕获系统通知
// Windows 通知存储在 %LOCALAPPDATA%\Microsoft\Windows\Notifications\wpndatabase.db
// 此实现通过 PowerShell 轮询最新通知记录
const NOTIFY_SCRIPT = `
try {
  $dbPath = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Notifications\\wpndatabase.db"
  if (!(Test-Path $dbPath)) { exit }
  Add-Type -Path "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1" -ErrorAction SilentlyContinue
  $conn = New-Object System.Data.SQLite.SQLiteConnection("Data Source=$dbPath;Version=3;Read Only=True;") -ErrorAction Stop
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = "SELECT Id, HandlerID, Title, Message FROM Notification ORDER BY CreatedTime DESC LIMIT 1"
  $reader = $cmd.ExecuteReader()
  if ($reader.Read()) {
    Write-Output "$($reader['Id'])|$($reader['HandlerID'])|$($reader['Title'])|$($reader['Message'])"
  }
  $conn.Close()
} catch {
  Write-Output "|||"
}
`.trim()

class NotifyProvider extends EventEmitter {
  private _timer: ReturnType<typeof setInterval> | null = null
  private _lastId = ''

  /**
   * 启动通知监听
   * 注意：Windows 通知数据库需要 SQLite 驱动。
   * 此实现为轮询骨架，生产环境建议改用 node-ffi-napi 绑定 WinRT 通知 API。
   */
  start(intervalMs = 3000): void {
    this._timer = setInterval(() => this._poll(), intervalMs)
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
  }

  /**
   * 手动推送一条通知（供测试或主进程其他模块调用）
   */
  push(notice: Omit<NoticeInfo, 'id' | 'timestamp'>): void {
    this.emit('new', {
      ...notice,
      id: randomUUID(),
      timestamp: Date.now(),
    } satisfies NoticeInfo)
  }

  private _poll(): void {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', NOTIFY_SCRIPT],
      { timeout: 4000 },
      (err, stdout) => {
        if (err) return
        const raw = stdout.trim()
        if (!raw || raw === '|||') return

        const [id = '', appName = '', title = '', body = ''] = raw.split('|')
        if (!id || id === this._lastId) return
        this._lastId = id

        const notice: NoticeInfo = {
          id,
          appName,
          title,
          body,
          timestamp: Date.now(),
        }

        this.emit('new', notice)
      },
    )
  }
}

export const notifyProvider = new NotifyProvider()
