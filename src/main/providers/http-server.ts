import { EventEmitter } from 'events'
import * as http from 'http'
import { randomUUID } from 'crypto'
import type { NoticeInfo } from '../../shared/types'

const MAX_BODY_BYTES = 65536 // 64 KB

/**
 * 本地 HTTP 消息接收服务
 *
 * 安全边界：
 * - 仅绑定 127.0.0.1，拒绝所有外网连接
 * - 支持可选 Bearer Token 鉴权
 * - 请求体上限 64 KB
 *
 * API：
 *   POST /notify
 *   Content-Type: application/json
 *   Authorization: Bearer <token>   （httpToken 非空时必须）
 *
 *   Body: { title: string, body?: string, app?: string }
 *   → 200 { ok: true }
 *   → 400 / 401 / 404 / 405
 */
export class HttpNotifyProvider extends EventEmitter {
  private _server: http.Server | null = null
  private _port = 19198
  private _token = ''

  start(port: number, token: string): void {
    // 先停掉旧实例（配置变更时热重载）
    this.stop()

    this._port  = port
    this._token = token

    this._server = http.createServer((req, res) => {
      this._handleRequest(req, res)
    })

    this._server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[HttpNotify] Port ${port} already in use`)
      } else {
        console.error('[HttpNotify] Server error:', err.message)
      }
    })

    // 仅绑定本地回环，禁止外网访问
    this._server.listen(port, '127.0.0.1', () => {
      console.log(`[HttpNotify] Listening on http://127.0.0.1:${port}/notify`)
    })
  }

  stop(): void {
    if (this._server) {
      this._server.close()
      this._server = null
      console.log('[HttpNotify] Server stopped')
    }
  }

  get isRunning(): boolean {
    return this._server !== null && this._server.listening
  }

  private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // 只接受 POST /notify
    if (req.url !== '/notify') {
      this._send(res, 404, { error: 'not found' })
      return
    }
    if (req.method !== 'POST') {
      this._send(res, 405, { error: 'method not allowed' })
      return
    }

    // Bearer Token 鉴权
    if (this._token) {
      const auth = (req.headers['authorization'] ?? '').trim()
      if (auth !== `Bearer ${this._token}`) {
        this._send(res, 401, { error: 'unauthorized' })
        return
      }
    }

    // 读取并限制 body 大小
    let body = ''
    let aborted = false

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
      if (body.length > MAX_BODY_BYTES) {
        aborted = true
        req.destroy()
        this._send(res, 400, { error: 'request body too large' })
      }
    })

    req.on('end', () => {
      if (aborted) return
      this._processBody(body, res)
    })

    req.on('error', () => {
      // 连接被中断，忽略
    })
  }

  private _processBody(raw: string, res: http.ServerResponse): void {
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(raw)
    } catch {
      this._send(res, 400, { error: 'invalid JSON' })
      return
    }

    const title = String(payload['title'] ?? '').trim()
    if (!title) {
      this._send(res, 400, { error: '"title" is required' })
      return
    }

    const notice: NoticeInfo = {
      id:        randomUUID(),
      appName:   String(payload['app'] ?? 'HTTP').trim() || 'HTTP',
      title,
      body:      String(payload['body'] ?? '').trim(),
      timestamp: Date.now(),
    }

    this.emit('new', notice)
    this._send(res, 200, { ok: true })
  }

  private _send(res: http.ServerResponse, status: number, body: object): void {
    const json = JSON.stringify(body)
    // 防止已发送过头部（body 超大时可能先 writeHead 再 destroy）
    if (res.headersSent) return
    res.writeHead(status, {
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(json),
    })
    res.end(json)
  }
}

export const httpNotifyProvider = new HttpNotifyProvider()
