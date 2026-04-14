import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MediaInfo, NoticeInfo } from '@shared/types'

// 岛的全部可能状态（添加新状态在这里扩展即可）
export type IslandMode = 'COMPACT' | 'MUSIC' | 'NOTIFICATION' | 'TIMER'

// 各状态对应的岛尺寸（展开后）
const SIZE_MAP: Record<IslandMode, { width: number; height: number }> = {
  COMPACT:      { width: 240, height: 72  },
  MUSIC:        { width: 360, height: 135 },
  NOTIFICATION: { width: 340, height: 80  },
  TIMER:        { width: 260, height: 60  },
}

const COMPACT_SIZE       = { width: 210, height: 36 }
/** 音乐播放中但未展开：小丸子稍宽，显示播放图标 */
const MUSIC_COMPACT_SIZE = { width: 280, height: 36 }
/** 静默模式：极细横条吸在顶部 */
const SILENT_BAR_SIZE    = { width: 120, height: 6  }

// 通知自动收回延迟（ms）
const NOTIFICATION_TIMEOUT_MS = 5000

export const useIslandStore = defineStore('island', () => {
  // ── 状态 ─────────────────────────────────────────────────
  const mode      = ref<IslandMode>('COMPACT')
  const isExpanded = ref(false)
  /** 用户点击锁定展开，鼠标离开后不收起 */
  const isPinned   = ref(false)
  const mediaInfo  = ref<MediaInfo | null>(null)
  const notification = ref<NoticeInfo | null>(null)
  /** 当前播放位置（秒） */
  const position   = ref(0)
  /** 总时长（秒） */
  const duration   = ref(0)

  // ── 静默模式状态 ──────────────────────────────────────────
  const isSilent          = ref(false)
  const silentModeEnabled = ref(false)
  const silentModeDelay   = ref(0)   // 秒，0 = 不自动

  let _noticeTimer: ReturnType<typeof setTimeout> | null = null
  /** 媒体停止/无会话时，延迟 3s 才收起岛，避免换曲间简短闪断导致抖闪 */
  let _mediaResetTimer: ReturnType<typeof setTimeout> | null = null
  /** 自动静默定时器：播放 N 秒后进入静默 */
  let _silentTimer: ReturnType<typeof setTimeout> | null = null

  // ── 计算属性 ──────────────────────────────────────────────
  /**
   * 当前岛的目标尺寸：
   * - 静默模式：极细横条
   * - 未展开时固定为 COMPACT_SIZE
   * - 展开时根据 mode 动态计算
   */
  const islandSize = computed(() => {
    if (isSilent.value) return SILENT_BAR_SIZE
    if (!isExpanded.value) {
      if (mode.value === 'MUSIC') return MUSIC_COMPACT_SIZE
      return COMPACT_SIZE
    }
    return SIZE_MAP[mode.value]
  })

  // ── 动作 ──────────────────────────────────────────────────

  function expand(): void {
    isExpanded.value = true
  }

  function collapse(): void {
    // 已锁定时不收起
    if (isPinned.value) return
    // 非紧凑模式（音乐/通知/计时器）由各自逻辑控制收起，鼠标离开不收起
    if (mode.value !== 'COMPACT') return
    isExpanded.value = false
  }

  /** 点击切换展开/收起 */
  function togglePin(): void {
    if (isExpanded.value) {
      // 卡片 → 岛：收起卡片，计时器等鼠标移出时由 useIslandMouse 恢复
      isExpanded.value = false
      isPinned.value   = false
    } else {
      // 岛 → 卡片：展开，暂停静默倒计时（鼠标在岛内，useIslandMouse 已暂停；双重保险）
      _clearSilentTimer()
      isExpanded.value = true
      isPinned.value   = true
    }
  }

  /** 鼠标移出岛时收起（无论模式和锁定状态） */
  function mouseLeave(): void {
    isExpanded.value = false
    isPinned.value   = false
    // 注意：静默计时器的恢复由 useIslandMouse 统一管理，此处不重复启动
  }

  // ── 静默模式 ──────────────────────────────────────────────

  function _clearSilentTimer(): void {
    if (_silentTimer) { clearTimeout(_silentTimer); _silentTimer = null }
  }

  function _startSilentTimer(): void {
    if (!silentModeEnabled.value || silentModeDelay.value <= 0) return
    if (_silentTimer) return  // 已在倒计时中
    _silentTimer = setTimeout(() => {
      _silentTimer = null
      enterSilent()
    }, silentModeDelay.value * 1000)
  }

  /** 进入静默模式：岛收起为极细横条 */
  function enterSilent(): void {
    if (!silentModeEnabled.value) return
    // 卡片展开期间不进入静默，守护阐置状态机错误
    if (isExpanded.value) return
    isSilent.value   = true
    isExpanded.value = false
    isPinned.value   = false
  }

  /** 退出静默模式：岛恢复正常收起态，再点击才展开卡片 */
  function exitSilent(): void {
    _clearSilentTimer()
    isSilent.value   = false
    isExpanded.value = false
    isPinned.value   = false
    // 直接启动自动静默倒计时，_startSilentTimer 内部有条件守护
    _startSilentTimer()
  }

  /** 接收媒体更新，切换到音乐模式 */
  function applyMediaUpdate(info: MediaInfo): void {
    mediaInfo.value = info
    if (info.position !== undefined) position.value = info.position
    if (info.duration !== undefined) duration.value = info.duration
    if (info.playbackStatus === 'stopped' || info.playbackStatus === 'unknown') {
      // 停止播放：清除自动静默计时器
      _clearSilentTimer()
      // 安排延迟重置而不是立即重置，避免换曲间短暂丢失会话导致抖闪
      if (mode.value === 'MUSIC' && !_mediaResetTimer) {
        _mediaResetTimer = setTimeout(() => {
          _mediaResetTimer = null
          const s = mediaInfo.value?.playbackStatus
          if (s === 'stopped' || s === 'unknown' || !s) {
            mode.value       = 'COMPACT'
            isExpanded.value = false
            isPinned.value   = false
          }
        }, 3000)
      }
      return
    }
    // 有媒体播放：清除延迟定时并切换到音乐模式，不自动展开
    if (_mediaResetTimer) { clearTimeout(_mediaResetTimer); _mediaResetTimer = null }
    mode.value = 'MUSIC'
    // 若静默模式已开启且计时器尚未运行，则启动（有 _silentTimer 守护，换曲不会重置倒计时）
    _startSilentTimer()
  }

  /** 接收系统通知，临时切换到通知模式，5 秒后自动收回 */
  function applyNotification(notice: NoticeInfo): void {
    notification.value = notice
    mode.value = 'NOTIFICATION'
    isExpanded.value = true // 通知强制展开

    if (_noticeTimer) clearTimeout(_noticeTimer)
    _noticeTimer = setTimeout(() => {
      mode.value = isExpanded.value ? (mediaInfo.value?.playbackStatus === 'playing' ? 'MUSIC' : 'COMPACT') : 'COMPACT'
      notification.value = null
      _noticeTimer = null
    }, NOTIFICATION_TIMEOUT_MS)
  }

  /** 切换到计时模式 */
  function activateTimer(): void {
    mode.value = 'TIMER'
    isExpanded.value = true
  }

  /**
   * 初始化 IPC 订阅（在 App.vue 的 onMounted 中调用一次）
   * 返回清理函数，onUnmounted 时调用
   */
  function init(): () => void {
    // 读取初始设置（静默模式配置）
    window.electron.getSettings().then(({ settings }) => {
      silentModeEnabled.value = settings.silentMode
      silentModeDelay.value   = settings.silentModeDelay
    })

    const offSettings = window.electron.onSettingsChanged((s) => {
      silentModeEnabled.value = s.silentMode
      silentModeDelay.value   = s.silentModeDelay
      if (!s.silentMode) {
        // 静默模式被关闭：清除计时器，退出横条态
        _clearSilentTimer()
        if (isSilent.value) {
          isSilent.value   = false
          isExpanded.value = false
          isPinned.value   = false
        }
      } else if (mode.value === 'MUSIC' && !isSilent.value) {
        // 静默模式刚被启用且音乐正在播放：立即开始倒计时（重新从 0 计）
        _clearSilentTimer()
        _startSilentTimer()
      }
    })

    const offMedia    = window.electron.onMediaUpdate(applyMediaUpdate)
    const offPosition = window.electron.onMediaPosition((pos) => {
      position.value = pos.position
      duration.value = pos.duration
    })
    const offNotice = window.electron.onNotification(applyNotification)
    const offBlur   = window.electron.onWindowBlur(() => {
      // blur 作为保底兜底，主要靠 App.vue 背景点击收起
      isPinned.value   = false
      isExpanded.value = false
    })
    return () => {
      offSettings()
      offMedia()
      offPosition()
      offNotice()
      offBlur()
      if (_noticeTimer) clearTimeout(_noticeTimer)
      if (_mediaResetTimer) clearTimeout(_mediaResetTimer)
      _clearSilentTimer()
    }
  }

  return {
    // state
    mode,
    isExpanded,
    isPinned,
    isSilent,
    silentModeEnabled,
    mediaInfo,
    notification,
    position,
    duration,
    // computed
    islandSize,
    // actions
    expand,
    collapse,
    togglePin,
    mouseLeave,
    enterSilent,
    exitSilent,
    pauseSilentTimer:  _clearSilentTimer,
    resumeSilentTimer: _startSilentTimer,
    applyMediaUpdate,
    applyNotification,
    activateTimer,
    init,
  }
})
