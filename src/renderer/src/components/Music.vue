<template>
  <div class="music-view">

    <!-- 紧凑态 -->
    <div v-if="!store.isExpanded" class="music-pill">
      <button class="pill-btn" @click.stop="ctrl('toggle')">
        <svg v-if="isPlaying" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </button>
      <div class="pill-art">
        <img v-if="info.thumbnailDataUrl" :src="info.thumbnailDataUrl" alt="" />
        <span v-else>♫</span>
      </div>
      <template v-if="store.lyricsEnabled && store.currentLyric">
        <transition name="lyric-fade" mode="out-in">
          <span class="pill-lyric" :key="store.currentLyric">{{ store.currentLyric }}</span>
        </transition>
      </template>
      <template v-else>
        <span class="pill-title">{{ info.title || '未知曲目' }}</span>
        <span v-if="info.artist" class="pill-sep"> · </span>
        <span v-if="info.artist" class="pill-artist">{{ info.artist }}</span>
      </template>
      <div class="spectrum">
        <span class="bar" :class="{ active: isPlaying }"></span>
        <span class="bar" :class="{ active: isPlaying }" style="animation-delay:.15s"></span>
        <span class="bar" :class="{ active: isPlaying }" style="animation-delay:.3s"></span>
        <span class="bar" :class="{ active: isPlaying }" style="animation-delay:.08s"></span>
      </div>
    </div>

    <!-- 展开态 -->
    <div v-else class="music-expanded">
      <div class="art">
        <img v-if="info.thumbnailDataUrl" :src="info.thumbnailDataUrl" alt="" />
        <span v-else class="art-fallback">♫</span>
      </div>
      <!-- art 占位，flex 撑高已由 .art 固定高度控制 -->
      <div class="info-col">
        <span v-if="info.source" class="source-badge">{{ info.source }}</span>
        <!-- 歌词优先：有歌词时替换标题/艺术家显示 -->
        <template v-if="store.lyricsEnabled && store.currentLyric">
          <transition name="lyric-fade" mode="out-in">
            <p class="exp-title exp-lyric" :key="store.currentLyric">{{ store.currentLyric }}</p>
          </transition>
          <p class="exp-artist">{{ info.title || '未知曲目' }}</p>
        </template>
        <template v-else>
          <p class="exp-title">{{ info.title || '未知曲目' }}</p>
          <p class="exp-artist">{{ info.artist || '未知艺术家' }}</p>
        </template>
        <div class="progress-area">
          <div
            class="progress-bar"
            :class="{ dragging: isDragging }"
            @mousedown.stop="onProgressMousedown"
          >
            <div class="progress-fill" :style="{ width: displayPct + '%' }"></div>
            <div class="progress-thumb" :style="{ left: displayPct + '%' }"></div>
          </div>
          <div class="time-row">
            <span>{{ fmt(safePos) }}</span>
            <span>{{ fmt(safeDur) }}</span>
          </div>
        </div>
        <div class="controls">
          <button class="ctrl-btn" @click.stop="ctrl('prev')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
          </button>
          <button class="ctrl-btn primary" @click.stop="ctrl('toggle')">
            <svg v-if="isPlaying" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="ctrl-btn" @click.stop="ctrl('next')">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6z"/></svg>
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useIslandStore } from '@renderer/store/island'
import type { MediaInfo } from '@shared/types'

const store = useIslandStore()

const info = computed<MediaInfo>(() =>
  store.mediaInfo ?? { title: '', artist: '', album: '', playbackStatus: 'unknown' },
)

const isPlaying  = computed(() => info.value.playbackStatus === 'playing')

// 防御：后端 elapsed 偶尔溢出，前端二次钳位
const safeDur = computed(() => Math.max(0, store.duration))
const safePos = computed(() => {
  const d = safeDur.value
  const p = Math.max(0, store.position)
  return d > 0 ? Math.min(p, d) : p
})

const progressPct = computed(() => {
  const d = safeDur.value
  if (d <= 0) return 0
  return Math.min(100, (safePos.value / d) * 100)
})

function fmt(sec: number): string {
  if (!sec || sec <= 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m + ':' + String(s).padStart(2, '0')
}

const isDragging   = ref(false)
const dragPct      = ref(0)   // 0~100
let   _dragBarRect: DOMRect | null = null

const displayPct = computed(() =>
  isDragging.value ? dragPct.value : progressPct.value
)

function onProgressMousedown(e: MouseEvent): void {
  if (safeDur.value <= 0) return
  e.preventDefault()
  _dragBarRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  isDragging.value = true
  dragPct.value = clampPct(e, _dragBarRect)
  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent): void {
  if (!_dragBarRect) return
  dragPct.value = clampPct(e, _dragBarRect)
}

function onDragEnd(e: MouseEvent): void {
  if (!_dragBarRect) return
  const pct = clampPct(e, _dragBarRect)
  dragPct.value = pct
  isDragging.value = false
  _dragBarRect = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  window.electron.mediaSeek((pct / 100) * safeDur.value)
}

function clampPct(e: MouseEvent, rect: DOMRect): number {
  return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
})

function ctrl(action: 'prev' | 'next' | 'toggle'): void {
  window.electron.mediaControl(action)
}
</script>

<style scoped>
.music-view {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 紧凑态 */
.music-pill {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 0 10px 0 6px;
  gap: 7px;
}
.pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--md-sys-color-primary, #d0bcff);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: transform 0.1s;
}
.pill-btn:active { transform: scale(0.85); }
.pill-btn svg { width: 16px; height: 16px; }
.pill-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.pill-sep {
  font-size: 11px;
  color: var(--md-sys-color-outline, #938f99);
  flex-shrink: 0;
}
.pill-artist {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  max-width: 38%;
}

/* 展开态 */
.music-expanded {
  display: flex;
  align-items: stretch;
  width: 100%;
  height: 100%;
  padding: 9px 12px 9px 10px;
  gap: 11px;
}
.art {
  width: 58px;
  height: 58px;
  flex-shrink: 0;
  border-radius: 10px;
  overflow: hidden;
  background: var(--md-sys-color-surface-variant, #49454f);
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: center;
}
.art img { width: 100%; height: 100%; object-fit: cover; }
.art-fallback { font-size: 22px; color: var(--md-sys-color-on-surface-variant, #cac4d0); }
.info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.source-badge {
  font-size: 10px;
  color: var(--md-sys-color-outline, #938f99);
  background: color-mix(in srgb, var(--md-sys-color-on-surface, #e6e1e5) 8%, transparent);
  padding: 1px 7px;
  border-radius: 99px;
  align-self: flex-start;
}
.exp-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  line-height: 1.2;
}
.exp-artist {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  line-height: 1.2;
}
/* 歌词 */
.pill-lyric {
  font-size: 12px;
  font-weight: 500;
  color: var(--md-sys-color-primary, #d0bcff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.exp-lyric {
  color: var(--md-sys-color-primary, #d0bcff) !important;
  font-weight: 500;
}
.lyric-fade-enter-active,
.lyric-fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.lyric-fade-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
.lyric-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
.progress-area {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}
.progress-bar {
  height: 4px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--md-sys-color-on-surface, #e6e1e5) 12%, transparent);
  overflow: visible;
  position: relative;
  cursor: pointer;
}
.progress-bar.dragging { opacity: 0.9; }
.progress-fill {
  height: 100%;
  border-radius: 99px;
  background: var(--md-sys-color-primary, #d0bcff);
  pointer-events: none;
}
.progress-bar.dragging .progress-fill { transition: none; }
.progress-thumb {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--md-sys-color-primary, #d0bcff);
  transform: translate(-50%, -50%) scale(0);
  transition: transform 0.15s;
  pointer-events: none;
}
.progress-bar:hover .progress-thumb,
.progress-bar.dragging .progress-thumb {
  transform: translate(-50%, -50%) scale(1);
}
.time-row {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: var(--md-sys-color-outline, #938f99);
}
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: auto;
}
.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, transform 0.1s;
}
.ctrl-btn svg { width: 17px; height: 17px; }
.ctrl-btn:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface, #e6e1e5) 8%, transparent); }
.ctrl-btn:active { transform: scale(0.88); }
.ctrl-btn.primary {
  width: 32px;
  height: 32px;
  background: var(--md-sys-color-primary-container, #4a4458);
  color: var(--md-sys-color-on-primary-container, #e8def8);
}
.ctrl-btn.primary svg { width: 19px; height: 19px; }
.ctrl-btn.primary:hover { background: var(--md-sys-color-primary, #d0bcff); color: #1c1b1f; }

/* 紧凑态封面 */
.pill-art {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: var(--md-sys-color-surface-variant, #49454f);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
}
.pill-art img { width: 100%; height: 100%; object-fit: cover; }

/* 频谱 */
.spectrum {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
  flex-shrink: 0;
}
.bar {
  width: 3px;
  height: 3px;
  border-radius: 2px;
  background: var(--md-sys-color-primary, #d0bcff);
}
.bar.active {
  animation: spectrum-bounce 0.8s ease-in-out infinite alternate;
}
.bar:nth-child(1) { animation-duration: 0.70s; }
.bar:nth-child(2) { animation-duration: 0.50s; }
.bar:nth-child(3) { animation-duration: 0.90s; }
.bar:nth-child(4) { animation-duration: 0.60s; }

@keyframes spectrum-bounce {
  from { height: 3px; }
  to   { height: 16px; }
}
</style>