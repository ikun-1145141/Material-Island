<template>
  <div class="timer-view">
    <Transition name="fade" mode="out-in">
      <div v-if="!store.isExpanded" class="timer-compact">
        <span class="icon">⏱</span>
        <span class="display">{{ formatted }}</span>
      </div>
      <div v-else class="timer-expanded">
        <span class="display-large">{{ formatted }}</span>
        <div class="controls">
          <button class="btn" @click="toggle">
            {{ running ? '暂停' : (elapsed > 0 ? '继续' : '开始') }}
          </button>
          <button class="btn btn-secondary" @click="reset">重置</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { useIslandStore } from '@renderer/store/island'

const store   = useIslandStore()
const running = ref(false)
const elapsed = ref(0) // 已过去的毫秒数

let _start    = 0
let _offset   = 0
let _raf: number | null = null

function tick(now: number): void {
  if (!running.value) return
  elapsed.value = _offset + (now - _start)
  _raf = requestAnimationFrame(tick)
}

function toggle(): void {
  if (running.value) {
    running.value = false
    _offset = elapsed.value
    if (_raf) { cancelAnimationFrame(_raf); _raf = null }
  } else {
    running.value = true
    _start = performance.now()
    _raf = requestAnimationFrame(tick)
  }
}

function reset(): void {
  running.value = false
  elapsed.value = 0
  _offset = 0
  if (_raf) { cancelAnimationFrame(_raf); _raf = null }
}

const formatted = computed(() => {
  const ms  = Math.floor(elapsed.value)
  const s   = Math.floor(ms / 1000)
  const min = Math.floor(s / 60)
  const sec = s % 60
  const h   = Math.floor(min / 60)
  const m   = min % 60
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(sec)}`
  }
  return `${pad(m)}:${pad(sec)}`
})

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

onUnmounted(() => {
  if (_raf) cancelAnimationFrame(_raf)
})
</script>

<style scoped>
.timer-view {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 14px;
}

.timer-compact {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon {
  font-size: 13px;
}
.display {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--md-sys-color-on-surface, #e6e1e5);
}

.timer-expanded {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.display-large {
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  letter-spacing: 0.04em;
}

.controls {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 4px 14px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  background: var(--md-sys-color-primary, #d0bcff);
  color: var(--md-sys-color-on-primary, #21005d);
  transition: opacity 0.15s;
}
.btn:hover { opacity: 0.88; }
.btn:active { opacity: 0.76; }
.btn-secondary {
  background: var(--md-sys-color-surface-variant, #49454f);
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
