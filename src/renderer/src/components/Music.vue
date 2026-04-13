<template>
  <div class="music-view">
    <Transition name="fade" mode="out-in">

      <!-- 紧凑态：封面 + 频谱 -->
      <div v-if="!store.isExpanded" class="music-compact">
        <div class="album-art-compact">
          <img v-if="info.thumbnailDataUrl" :src="info.thumbnailDataUrl" alt="封面" />
          <span v-else class="album-placeholder-compact">♫</span>
        </div>
        <Spectrum :playing="isPlaying" />
      </div>

      <!-- 展开态：封面 + 歌曲信息 + 频谱 -->
      <div v-else class="music-expanded">
        <div class="album-art-expanded">
          <img v-if="info.thumbnailDataUrl" :src="info.thumbnailDataUrl" alt="封面" />
          <span v-else class="album-placeholder-expanded">♫</span>
        </div>
        <div class="track-info">
          <p class="track-title">{{ info.title || '未知曲目' }}</p>
          <p class="track-artist">{{ info.artist || '未知艺术家' }}</p>
          <p class="track-album">{{ info.album }}</p>
        </div>
        <Spectrum :playing="isPlaying" :bars="7" />
      </div>

    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h } from 'vue'
import { useIslandStore } from '@renderer/store/island'
import type { MediaInfo } from '@shared/types'

const store = useIslandStore()

const info = computed<MediaInfo>(() =>
  store.mediaInfo ?? { title: '', artist: '', album: '', playbackStatus: 'unknown' },
)

const isPlaying = computed(() => info.value.playbackStatus === 'playing')

// ── 频谱组件（内联，避免多余文件） ────────────────────────
const Spectrum = defineComponent({
  props: {
    playing: { type: Boolean, default: false },
    bars:    { type: Number,  default: 5 },
  },
  setup(props) {
    // 每根柱子的动画延迟，制造参差感
    const delays = [0, 0.3, 0.15, 0.45, 0.1, 0.35, 0.2]

    return () =>
      h('div', { class: 'spectrum' },
        Array.from({ length: props.bars }, (_, i) =>
          h('span', {
            class: ['bar', props.playing ? 'active' : 'idle'],
            style: { animationDelay: `${delays[i % delays.length]}s` },
          }),
        ),
      )
  },
})
</script>

<style scoped>
.music-view {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* ── 紧凑态 ── */
.music-compact {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: 0 14px 0 8px;
  gap: 12px;
}

.album-art-compact {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--md-sys-color-surface-variant, #49454f);
  display: flex;
  align-items: center;
  justify-content: center;
}
.album-art-compact img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.album-placeholder-compact {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
}

/* ── 展开态 ── */
.music-expanded {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 10px 14px 10px 10px;
  gap: 12px;
}

.album-art-expanded {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--md-sys-color-surface-variant, #49454f);
  display: flex;
  align-items: center;
  justify-content: center;
}
.album-art-expanded img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.album-placeholder-expanded {
  font-size: 22px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
}

.track-info {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.track-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}
.track-artist {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}
.track-album {
  font-size: 10px;
  color: var(--md-sys-color-outline, #938f99);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

/* ── 频谱 ── */
:deep(.spectrum) {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
  flex-shrink: 0;
}

:deep(.bar) {
  width: 3px;
  border-radius: 2px;
  background: var(--md-sys-color-primary, #d0bcff);
  transform-origin: bottom;
}

/* 播放中：各柱子独立弹跳 */
:deep(.bar.active) {
  animation: spectrum-bounce 0.8s ease-in-out infinite alternate;
}
:deep(.bar.active:nth-child(1)) { animation-duration: 0.7s; }
:deep(.bar.active:nth-child(2)) { animation-duration: 0.5s; }
:deep(.bar.active:nth-child(3)) { animation-duration: 0.9s; }
:deep(.bar.active:nth-child(4)) { animation-duration: 0.6s; }
:deep(.bar.active:nth-child(5)) { animation-duration: 0.75s; }
:deep(.bar.active:nth-child(6)) { animation-duration: 0.55s; }
:deep(.bar.active:nth-child(7)) { animation-duration: 0.85s; }

/* 暂停：固定矮柱 */
:deep(.bar.idle) {
  height: 4px;
  transition: height 0.4s ease;
}

@keyframes spectrum-bounce {
  from { height: 4px;  opacity: 0.7; }
  to   { height: 20px; opacity: 1;   }
}

/* ── 内容切换 ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
