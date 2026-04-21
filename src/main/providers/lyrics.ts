import { EventEmitter } from 'events'
import type { MediaInfo, LyricLine } from '../../shared/types'

/**
 * 歌词 Provider
 *
 * 职责：
 *   1. 监听 MediaInfo 变化，曲目切换时异步拉取 LRC 歌词（lrclib / 网易云 163）
 *   2. 拉取成功后 emit('data', lines) 将完整 LyricLine[] 传给主进程
 *   3. 主进程把数据转发给渲染层；渲染层用 RAF 插值位置做二分搜索（更准确、更流畅）
 *
 * 数据源优先级（可配置）：
 *   - lrclib.net：开放 API，国际歌曲覆盖好，无需 Key
 *   - 网易云 163：中文歌曲覆盖好，非官方接口
 */
export class LyricsProvider extends EventEmitter {
  private _lastTitle    = ''
  private _lastArtist   = ''
  private _lastDuration = 0
  private _source: 'lrclib' | '163' = 'lrclib'
  private _fallback     = true
  /** 递增 ID，用于丢弃过期的异步 fetch 结果（换曲时） */
  private _fetchId      = 0
  private _enabled      = false

  // ── 配置 ─────────────────────────────────────────────────

  setEnabled(v: boolean): void {
    this._enabled = v
    if (!v) {
      this._clearState()
    } else if (this._lastTitle) {
      this._refetch()
    }
  }

  setSource(source: string): void {
    if (source === '163' || source === 'lrclib') {
      if (source !== this._source) {
        this._source = source
        this._refetch()
      }
    }
  }

  setFallback(v: boolean): void { this._fallback = v }

  // ── 外部驱动 ─────────────────────────────────────────────

  /** 主进程在收到 media:update 时调用 */
  handleMediaUpdate(info: MediaInfo): void {
    if (!this._enabled) return

    const stopped = info.playbackStatus === 'stopped' || info.playbackStatus === 'unknown'
    if (stopped) {
      this._clearState()
      return
    }

    const songChanged = info.title !== this._lastTitle || info.artist !== this._lastArtist
    if (songChanged) {
      this._lastTitle    = info.title
      this._lastArtist   = info.artist
      this._lastDuration = info.duration ?? 0
      this._clearState()
      if (info.title) {
        const id = ++this._fetchId
        this._fetchLyrics(info.title, info.artist, this._lastDuration, id)
      }
    }
  }

  // ── 私有 ─────────────────────────────────────────────────

  private _clearState(): void {
    this.emit('data', [] as LyricLine[], 0)
  }

  private _refetch(): void {
    if (this._lastTitle) {
      const id = ++this._fetchId
      this._clearState()
      this._fetchLyrics(this._lastTitle, this._lastArtist, this._lastDuration, id)
    }
  }

  // ── 私有：网络请求 ────────────────────────────────────────

  private async _fetchLyrics(
    title: string,
    artist: string,
    duration: number,
    id: number,
  ): Promise<void> {
    let result: { lines: LyricLine[]; durationSec: number } | null = null

    // 提取第一位艺术家（多艺术家如 "Lost Sky、Chris Linton" → "Lost Sky"）
    const primaryArtist = artist.split(/[、,，&×xX]|\bfeat\.?\b|\bft\.?\b/i)[0].trim()

    if (this._source === 'lrclib') {
      result = await this._fetchLrclib(title, artist, duration)
      if (!result && primaryArtist !== artist) {
        result = await this._fetchLrclib(title, primaryArtist, duration)
      }
      if (!result && this._fallback) {
        result = await this._fetch163(title, artist)
      }
    } else {
      result = await this._fetch163(title, artist)
      if (!result && this._fallback) {
        result = await this._fetchLrclib(title, artist, duration)
        if (!result && primaryArtist !== artist) {
          result = await this._fetchLrclib(title, primaryArtist, duration)
        }
      }
    }

    if (id !== this._fetchId) return

    if (result && result.lines.length > 0) {
      this.emit('data', result.lines, result.durationSec)
    } else {
      console.warn(`[Lyrics] no lyrics found for "${title}" / "${artist}"`)
    }
  }

  private async _fetchLrclib(
    title: string,
    artist: string,
    duration: number,
  ): Promise<{ lines: LyricLine[]; durationSec: number } | null> {
    try {
      type LrclibItem = { syncedLyrics?: string; duration?: number }
      if (duration > 0) {
        const url =
          `https://lrclib.net/api/get` +
          `?track_name=${encodeURIComponent(title)}` +
          `&artist_name=${encodeURIComponent(artist)}` +
          `&duration=${Math.round(duration)}`
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        if (res.ok) {
          const data = await res.json() as LrclibItem
          if (data.syncedLyrics) {
            const lines = this._parseLrc(data.syncedLyrics)
            if (lines.length) return { lines, durationSec: data.duration ?? 0 }
          }
        }
      }

      const q = encodeURIComponent(`${title} ${artist}`.trim())
      const sres = await fetch(`https://lrclib.net/api/search?q=${q}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!sres.ok) return null
      const results = await sres.json() as LrclibItem[]
      for (const r of results) {
        if (r.syncedLyrics) {
          const lines = this._parseLrc(r.syncedLyrics)
          if (lines.length) return { lines, durationSec: r.duration ?? 0 }
        }
      }
      return null
    } catch {
      return null
    }
  }

  private async _fetch163(title: string, artist: string): Promise<{ lines: LyricLine[]; durationSec: number } | null> {
    try {
      const q    = encodeURIComponent(`${title} ${artist}`.trim())
      const surl = `https://music.163.com/api/search/get/web?s=${q}&type=1&offset=0&limit=10`
      const sres = await fetch(surl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer':    'https://music.163.com/',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!sres.ok) return null

      const sdata = await sres.json() as {
        result?: { songs?: Array<{ id: number; duration?: number; artists: Array<{ name: string }> }> }
      }
      const songs = sdata.result?.songs
      if (!songs?.length) return null

      const primaryArtist = artist.split(/[、,，&×]|\bfeat\.?\b|\bft\.?\b/i)[0].trim()
      const matched =
        songs.find((s) =>
          s.artists.some(
            (a) =>
              a.name.toLowerCase() === artist.toLowerCase() ||
              a.name.toLowerCase() === primaryArtist.toLowerCase(),
          ),
        ) ?? songs[0]

      const durationSec = matched.duration ? matched.duration / 1000 : 0

      const lurl = `https://music.163.com/api/song/lyric?id=${matched.id}&lv=1&kv=1&tv=-1`
      const lres = await fetch(lurl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer':    'https://music.163.com/',
        },
        signal: AbortSignal.timeout(8000),
      })
      if (!lres.ok) return null

      const ldata = await lres.json() as {
        lrc?: { lyric?: string }
        tlyric?: { lyric?: string }
      }
      const lrc  = ldata.lrc?.lyric  ?? ''
      const tlrc = ldata.tlyric?.lyric ?? ''
      if (!lrc) return null
      return { lines: this._parseLrc(lrc, tlrc || undefined), durationSec }
    } catch {
      return null
    }
  }

  // ── 私有：LRC 解析 ────────────────────────────────────────

  private _parseLrc(lrc: string, tlrc?: string): LyricLine[] {
    const map = new Map<number, string>()

    const parseText = (text: string, isTranslation: boolean): void => {
      const re = /\[(\d{1,2}):(\d{2})[.:](\d{1,3})\]([^\[]*)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        const min = parseInt(m[1])
        const sec = parseInt(m[2])
        const raw = m[3]
        const ms  = raw.length === 1 ? parseInt(raw) * 100
                  : raw.length === 2 ? parseInt(raw) * 10
                  : parseInt(raw)
        const timeMs = min * 60_000 + sec * 1_000 + ms
        const txt = m[4].trim()
        if (!txt) continue

        if (isTranslation) {
          const existing = map.get(timeMs)
          if (existing && !existing.includes('\n')) {
            map.set(timeMs, `${existing}\n${txt}`)
          }
        } else {
          if (!map.has(timeMs)) map.set(timeMs, txt)
        }
      }
    }

    parseText(lrc, false)
    if (tlrc) parseText(tlrc, true)

    return Array.from(map.entries())
      .map(([timeMs, text]) => ({ timeMs, text }))
      .sort((a, b) => a.timeMs - b.timeMs)
  }
}

export const lyricsProvider = new LyricsProvider()
