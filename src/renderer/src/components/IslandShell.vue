<template>
  <!-- 岛的药丸容器，负责形状/尺寸动画，内容由子组件提供 -->
  <div
    ref="shellRef"
    class="island-shell"
    :class="{ pinned: store.isPinned }"
    :style="shellStyle"
    @click="store.togglePin()"
  >
    <component :is="activeComponent" :key="store.mode" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useIslandStore } from '@renderer/store/island'
import { useIslandMouse } from '@renderer/composables/useIslandMouse'
import type { IslandMode } from '@renderer/store/island'
import type { Component } from 'vue'
import CompactVue      from './Compact.vue'
import MusicVue        from './Music.vue'
import NotificationVue from './Notification.vue'
import TimerVue        from './Timer.vue'

const store = useIslandStore()
const shellRef = ref<HTMLElement | null>(null)

useIslandMouse(shellRef)

const componentMap: Record<IslandMode, Component> = {
  COMPACT:      CompactVue,
  MUSIC:        MusicVue,
  NOTIFICATION: NotificationVue,
  TIMER:        TimerVue,
}

const activeComponent = computed(() => componentMap[store.mode])

// 尺寸绑定：CSS transition 负责动画，此处只给目标值
const shellStyle = computed(() => ({
  width:  `${store.islandSize.width}px`,
  height: `${store.islandSize.height}px`,
}))
</script>

<style scoped>
.island-shell {
  position: relative;
  background: var(--md-sys-color-surface-container-high, #1c1b1f);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  /* M3 强调型弹出曲线，近似 Spring 效果 */
  transition:
    width  0.45s cubic-bezier(0.05, 0.7, 0.1, 1),
    height 0.45s cubic-bezier(0.05, 0.7, 0.1, 1),
    border-radius 0.3s ease,
    box-shadow 0.3s ease;
  /* 必须显式声明，否则 Electron 透明窗口下阴影穿模 */
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.45);
  /* 确保岛在透明父容器中可以接收鼠标事件 */
  pointer-events: auto;
}

/* 锁定展开时加一圈主色光圈提示 */
.island-shell.pinned {
  box-shadow:
    0 4px 24px rgba(0, 0, 0, 0.45),
    0 0 0 1.5px var(--md-sys-color-primary, #d0bcff);
}

/* ── 内容切换过渡 ── */
.island-content-enter-active,
.island-content-leave-active {
  transition: opacity var(--md-motion-duration-short, 150ms) var(--md-motion-easing-standard, ease);
}
.island-content-enter-from,
.island-content-leave-to {
  opacity: 0;
}
</style>
