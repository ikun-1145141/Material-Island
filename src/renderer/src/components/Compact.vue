<template>
  <!-- 紧凑态：默认显示时钟 -->
  <div class="compact-view">
    <Transition name="fade" mode="out-in">
      <div v-if="!store.isExpanded" class="compact-pill">
        <span class="time">{{ time }}</span>
      </div>
      <div v-else class="compact-expanded">
        <span class="time-large">{{ time }}</span>
        <span class="date">{{ date }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useNow, useDateFormat } from '@vueuse/core'
import { useIslandStore } from '@renderer/store/island'

const store = useIslandStore()

const now  = useNow({ interval: 1000 })
const time = useDateFormat(now, 'HH:mm:ss')
const date = useDateFormat(now, 'YYYY年M月D日 ddd')
</script>

<style scoped>
.compact-view {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0 14px;
}

.compact-pill {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time {
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  font-variant-numeric: tabular-nums;
}

.compact-expanded {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  height: 100%;
  padding: 12px 16px;
}

.time-large {
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  font-variant-numeric: tabular-nums;
}

.date {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
}

/* 展开/收起内部切换 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
