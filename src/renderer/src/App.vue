<template>
  <!-- 设置页面 -->
  <Settings v-if="isSettings" />

  <!-- 岛主界面：透明全覆盖容器 -->
  <!-- 展开时不穿透，mousedown.self = 点中透明背景区域 → 收起 -->
  <div
    v-else
    class="app-root"
    :style="{ pointerEvents: store.isExpanded ? 'auto' : 'none' }"
    @mousedown.self="onBackdrop"
  >
    <IslandShell />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import IslandShell from './components/IslandShell.vue'
import Settings from './components/Settings.vue'
import { useIslandStore } from './store/island'
import { useM3Theme } from './composables/useM3Theme'

// 根据 URL hash 决定渲染哪个页面
const isSettings = ref(window.location.hash === '#settings')

const store = useIslandStore()
useM3Theme('#6750A4')

// 点击岛外透明区域 → 收起
function onBackdrop(): void {
  if (store.isExpanded) store.togglePin()
}

let cleanup: (() => void) | undefined
onMounted(() => {
  if (!isSettings.value) {
    cleanup = store.init()
  }
})
onUnmounted(() => {
  cleanup?.()
})
</script>

<style>
/* 全局重置 */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;
  overflow: hidden;
  font-family:
    'Segoe UI Variable',
    'Segoe UI',
    system-ui,
    -apple-system,
    sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* 将岛居中在透明容器窗口内 */
.app-root {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 8px;
}
</style>

<style scoped>
.app-root {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 8px;
  /* pointer-events 由 :style 动态控制，展开时 auto，收起时 none */
}
</style>
