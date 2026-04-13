<template>
  <!-- 透明全覆盖容器，pointer-events:none 让鼠标事件落到桌面 -->
  <!-- IslandShell 内部再设 pointer-events:auto，只在岛上拦截事件 -->
  <div class="app-root">
    <IslandShell />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import IslandShell from './components/IslandShell.vue'
import { useIslandStore } from './store/island'
import { useM3Theme } from './composables/useM3Theme'

const store = useIslandStore()

// 应用 M3 动态配色（随系统深色模式自动切换）
useM3Theme('#6750A4')

// 初始化 IPC 订阅，组件卸载时自动清理
let cleanup: (() => void) | undefined
onMounted(() => {
  cleanup = store.init()
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
  /* 父容器穿透，只有岛本身拦截鼠标事件 */
  pointer-events: none;
}
</style>
