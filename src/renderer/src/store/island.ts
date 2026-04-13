import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { MediaInfo, NoticeInfo } from '@shared/types'

// 岛的全部可能状态（添加新状态在这里扩展即可）
export type IslandMode = 'COMPACT' | 'MUSIC' | 'NOTIFICATION' | 'TIMER'

// 各状态对应的岛尺寸（展开后）
const SIZE_MAP: Record<IslandMode, { width: number; height: number }> = {
  COMPACT:      { width: 240, height: 72  },
  MUSIC:        { width: 360, height: 80  },
  NOTIFICATION: { width: 340, height: 80  },
  TIMER:        { width: 260, height: 60  },
}

const COMPACT_SIZE = { width: 210, height: 36 }

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

  let _noticeTimer: ReturnType<typeof setTimeout> | null = null

  // ── 计算属性 ──────────────────────────────────────────────
  /**
   * 当前岛的目标尺寸：
   * - 未展开时固定为 COMPACT_SIZE
   * - 展开时根据 mode 动态计算
   */
  const islandSize = computed(() =>
    isExpanded.value ? SIZE_MAP[mode.value] : COMPACT_SIZE,
  )

  // ── 动作 ──────────────────────────────────────────────────

  function expand(): void {
    isExpanded.value = true
  }

  function collapse(): void {
    // 已锁定时不收起
    if (isPinned.value) return
    isExpanded.value = false
  }

  /** 点击切换锁定展开状态 */
  function togglePin(): void {
    isPinned.value = !isPinned.value
    isExpanded.value = isPinned.value
    if (isPinned.value) {
      // 请求主进程激活窗口聚焦，就可监听失焦点（点击其他窗口）
      window.electron.pin()
    }
  }

  /** 接收媒体更新，切换到音乐模式 */
  function applyMediaUpdate(info: MediaInfo): void {
    mediaInfo.value = info
    if (info.playbackStatus === 'stopped' || info.playbackStatus === 'unknown') {
      // 无活跃媒体时回到紧凑态，并收起岛（除非用户 pin 住了）
      if (mode.value === 'MUSIC') {
        mode.value = 'COMPACT'
        if (!isPinned.value) isExpanded.value = false
      }
      return
    }
    // 有媒体在播放：切换到音乐模式并自动展开
    mode.value = 'MUSIC'
    isExpanded.value = true
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
    const offMedia  = window.electron.onMediaUpdate(applyMediaUpdate)
    const offNotice = window.electron.onNotification(applyNotification)
    // 窗口失焦点 → 自动解除 pin
    const offBlur   = window.electron.onWindowBlur(() => {
      isPinned.value   = false
      isExpanded.value = false
    })
    return () => {
      offMedia()
      offNotice()
      offBlur()
      if (_noticeTimer) clearTimeout(_noticeTimer)
    }
  }

  return {
    // state
    mode,
    isExpanded,
    isPinned,
    mediaInfo,
    notification,
    // computed
    islandSize,
    // actions
    expand,
    collapse,
    togglePin,
    applyMediaUpdate,
    applyNotification,
    activateTimer,
    init,
  }
})
